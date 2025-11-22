import { Router } from 'express';
import { GalaxySession } from '../../models/logh/GalaxySession.model';
import { GalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { Fleet } from '../../models/logh/Fleet.model';
import { GalaxyTacticalBattle } from '../../models/logh/GalaxyTacticalBattle.model';
import { joinGalaxySession, getOrganizationTree } from '../../services/logh/GalaxySession.service';
import { createGalaxyOperation } from '../../services/logh/GalaxyOperation.service';
import { GalaxyValidationService } from '../../services/logh/GalaxyValidation.service';
import { resolveGalaxyBattle, autoResolveGalaxyBattle } from '../../services/logh/GalaxyBattle.service';
import { RealtimeMovementService } from '../../services/logh/RealtimeMovement.service';
import { notifyApiContractChange, notifyQaLogUpdate } from '../../services/logh/GalaxyNotification.service';
import { getEconomyState, listEconomyEvents, recordEconomyEvent } from '../../services/logh/GalaxyEconomy.service';
import {
  sendCommMessage,
  listCommMessages,
  listAddressBook,
  addAddressBookEntry,
  requestHandshake,
  respondHandshake,
  listHandshakes,
} from '../../services/logh/GalaxyComm.service';
import { autoExtractToken } from '../../middleware/auth';
import { LOGH_MESSAGES } from '../../constants/messages';

const router = Router();
router.use(autoExtractToken);

function getSessionId(req: any): string {
  return req.session?.id || req.query.sessionId || req.body.sessionId;
}

function resolveUserId(req: any): string | null {
  return req.user?.userId || req.user?.id || req.body?.userId || null;
}

function ensureSessionAccess(req: any, res: any, sessionId: string) {
  const tokenSessionId = req.user?.sessionId;
  if (tokenSessionId && sessionId && tokenSessionId !== sessionId) {
    res.status(403).json({ success: false, message: '세션이 일치하지 않습니다' });
    return false;
  }
  return true;
}

async function requireUserCharacter(
  sessionId: string,
  userId: string,
  characterId?: string
) {
  const filter: Record<string, any> = { session_id: sessionId, userId };
  if (characterId) {
    filter.characterId = characterId;
  }
  return GalaxyCharacter.findOne(filter);
}

router.post('/sessions/:sessionId/join', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    const faction = req.body.faction;
    if (!['empire', 'alliance', 'rebel'].includes(faction)) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.factionSelectionRequired });
    }

    if (!req.body.characterName) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.characterNameRequired });
    }

    const originType = req.body.originType ?? 'generated';
    if (!['original', 'generated'].includes(originType)) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.originTypeInvalid });
    }

    const character = await joinGalaxySession({
      sessionId,
      userId,
      characterName: req.body.characterName,
      originType,
      faction,
      preferredRole: req.body.preferredRole,
    });

    const session = await GalaxySession.findOne({ session_id: sessionId });
    const authToken = Buffer.from(`${sessionId}:${character.characterId}`).toString('base64');

    notifyApiContractChange(sessionId, {
      endpoint: '/api/logh/galaxy/sessions/:sessionId/join',
      change: '세션 가입 계약 정보(시간 배율·재입장 정책) 전달',
      qaEntryId: 'QA-JOIN-001',
    });

    res.json({
      success: true,
      data: {
        authToken,
        character,
        session: session
          ? { timeScale: session.timeScale, factions: session.factions, economyState: session.economyState }
          : undefined,
      },
      compliance: [
        {
          manualRef: 'gin7manual.txt:316-331',
          status: '✅',
          note: '세션 최대 인원(2000명) 제한 적용',
        },
        {
          manualRef: 'gin7manual.txt:323-329',
          status: '✅',
          note: '진영별 재입장 제한 규칙 적용',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      compliance: [
        {
          manualRef: 'gin7manual.txt:316-331',
          status: '⚠️',
          note: error.message,
        },
      ],
    });
  }
});

router.get('/org-tree', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req) || '') as string;
    const faction = ((req.query.faction as string) || 'empire').toLowerCase();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }
    if (!['empire', 'alliance', 'rebel'].includes(faction)) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.invalidFaction });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const userCharacter = await requireUserCharacter(sessionId, userId);
    if (!userCharacter) {
      return res.status(403).json({ success: false, message: '세션에 소속된 캐릭터가 없습니다' });
    }
    if (userCharacter.faction !== faction) {
      return res.status(403).json({ success: false, message: '해당 진영에 접근할 권한이 없습니다' });
    }

    const tree = await getOrganizationTree(sessionId, faction as any);
    res.json({
      success: true,
      data: tree,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1179-1417',
          status: '✅',
          note: '매뉴얼 조직도와 동일한 계층 구조 제공',
        },
      ],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/operations', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    if (!sessionId || !req.body.authorCharacterId || !req.body.cardType) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.authorCardRequired });
    }

    if (!req.body.targetGrid || typeof req.body.targetGrid.x !== 'number' || typeof req.body.targetGrid.y !== 'number') {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.targetGridRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }
    
    const allowedObjectives = ['assault', 'defense', 'occupation', 'sweep', 'logistics', 'escort', 'resupply'];
    if (req.body.objectiveType && !allowedObjectives.includes(req.body.objectiveType)) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.objectiveTypeInvalid });
    }

    const operation = await createGalaxyOperation({
      sessionId,
      authorCharacterId: req.body.authorCharacterId,
      cardType: req.body.cardType,
      objectiveType: req.body.objectiveType ?? 'assault',

      targetGrid: req.body.targetGrid,
      cpCost: req.body.cpCost ?? { pcp: 0, mcp: 0 },
      timeline: req.body.timeline ?? { waitHours: 1, executionHours: 6 },
      logistics: req.body.logistics ?? { fuelCrates: 0, supplyHours: 0, unitBatchLimit: 300, planetsTouched: [] },
      participants: req.body.participants,
      requesterUserId: userId,
    });

    notifyQaLogUpdate(sessionId, {
      section: 'OperationPlan',
      status: 'pass',
      note: `Operation ${operation.code} planned by ${req.body.authorCharacterId}`,
    });

    res.json({
      success: true,
      data: operation,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1076-1158',
          status: '✅',
          note: '전략 작전에는 커맨드 카드가 필수',
        },
        {
          manualRef: 'gin7manual.txt:1440-1495',
          status: '✅',
          note: '진영별 격자 배치 최대 300기 제한',
        },
      ],
    });
  } catch (error: any) {
    if (sessionId) {
      notifyQaLogUpdate(sessionId, {
        section: 'OperationPlan',
        status: 'fail',
        note: error.message,
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/fleets/:fleetId/movements', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { fleetId } = req.params;
    const target = req.body.target;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.targetCoordinatesRequired });
    }

    const controllerCharacterId = req.body.controllerCharacterId;
    if (!controllerCharacterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.controllerCharacterRequired });
    }

    const controller = await requireUserCharacter(sessionId, userId, controllerCharacterId);
    if (!controller) {
      return res.status(403).json({ success: false, message: '이동 명령을 내릴 수 있는 캐릭터가 없습니다' });
    }

    const fleet = await Fleet.findOne({ session_id: sessionId, fleetId });
    if (!fleet) {
      return res.status(404).json({ success: false, message: LOGH_MESSAGES.fleetNotFound });
    }

    if (controller.faction !== fleet.faction) {
      return res.status(403).json({ success: false, message: '타 진영 함대를 제어할 수 없습니다' });
    }

    await GalaxyValidationService.verifyGridEntryLimit(
      sessionId,
      target,
      fleet.faction as any,
      fleet.totalShips || 0
    );

    const result = await RealtimeMovementService.setFleetDestination(sessionId, fleetId, target);

    notifyQaLogUpdate(sessionId, {
      section: 'FleetMovement',
      status: 'pass',
      note: `Fleet ${fleetId} moving toward (${target.x},${target.y}) under ${controllerCharacterId}`,
    });

    res.json({
      success: true,
      data: result,
      compliance: [
        {
          manualRef: 'gin7manual.txt:1440-1495',
          status: '✅',
          note: '격자당 2개 진영·300기 제한 검증 완료',
        },
        {
          manualRef: 'gin7manual.txt:1508-1530',
          status: '✅',
          note: '워프 변동치가 응답 메타데이터에 포함됨',
        },
      ],
    });
  } catch (error: any) {
    if (sessionId) {
      notifyQaLogUpdate(sessionId, {
        section: 'FleetMovement',
        status: 'fail',
        note: error.message,
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/tactical-battles/:battleId/resolve', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { battleId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const autoResolveRequest = Boolean(req.body.autoResolve);
    if (!autoResolveRequest && !req.body.finalState) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.finalStateRequired });
    }

    const resolverCharacterId = req.body.resolverCharacterId;
    if (!resolverCharacterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.resolverCharacterRequired });
    }

    const resolver = await requireUserCharacter(sessionId, userId, resolverCharacterId);
    if (!resolver) {
      return res.status(403).json({ success: false, message: '전투를 종료할 권한이 없습니다' });
    }

    let battleRecord = await GalaxyTacticalBattle.findOne({ session_id: sessionId, battleId });
    if (!battleRecord) {
      battleRecord = await GalaxyTacticalBattle.create({
        session_id: sessionId,
        battleId,
        gridId: req.body.gridId || 'unknown',
        factions:
          req.body.factions && req.body.factions.length
            ? req.body.factions
            : [
                { code: resolver.faction, label: resolver.faction, commanderIds: [resolver.characterId], unitCount: 0 },
              ],
        planetStates: req.body.planetStates || [],
      });
    }

    const resolverFactionParticipates = battleRecord.factions?.some(
      (faction) => faction.code === resolver.faction
    );
    if (!resolverFactionParticipates) {
      return res.status(403).json({ success: false, message: '해당 전투에 속하지 않은 진영입니다' });
    }

    if (autoResolveRequest) {
      const autoBattle = await autoResolveGalaxyBattle({
        sessionId,
        battleId,
        resolverCharacterId: resolver.characterId,
      });

      return res.json({
        success: true,
        data: autoBattle,
        compliance: [
          {
            manualRef: 'gin7manual.txt:2116-2134',
            status: '✅',
            note: '인공지능 자동 조종이 매뉴얼 4장 승리 조건으로 전투를 처리',
          },
        ],
      });
    }

    const battle = await resolveGalaxyBattle({
      sessionId,
      battleId,
      finalState: req.body.finalState,
      rewards: req.body.rewards || [],
      casualtyReport: req.body.casualtyReport,
    });

    notifyApiContractChange(sessionId, {
      endpoint: '/api/logh/galaxy/tactical-battles/:battleId/resolve',
      change: '전술 해전 결과 페이로드(승리 판정·보상) 공지',
      qaEntryId: 'QA-BTL-001',
    });

    res.json({
      success: true,
      data: battle,
      compliance: [
        {
          manualRef: 'gin7manual.txt:2116-2134',
          status: '✅',
          note: '적 섬멸과 행성 점령이 완료되어야 승리 처리',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/economy/state', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req) || '') as string;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const character = await requireUserCharacter(sessionId, userId, req.query.characterId as string | undefined);
    if (!character) {
      return res.status(403).json({ success: false, message: '세션 캐릭터가 필요합니다' });
    }

    const state = await getEconomyState(sessionId);
    res.json({
      success: true,
      data: state,
      compliance: [
        {
          manualRef: 'gin7manual.txt:299-304',
          status: '✅',
          note: '경제 관리가 세션 상태와 동기화됨',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/economy/events', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req) || '') as string;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const character = await requireUserCharacter(sessionId, userId, req.query.characterId as string | undefined);
    if (!character) {
      return res.status(403).json({ success: false, message: '세션 캐릭터가 필요합니다' });
    }

    const events = await listEconomyEvents(sessionId, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      faction: req.query.faction as string,
    });

    res.json({
      success: true,
      data: events,
      compliance: [
        {
          manualRef: 'gin7manual.txt:299-304',
          status: '✅',
          note: '경제 이벤트를 모니터링용으로 노출',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/economy/events', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const { actorCharacterId } = req.body;
    if (!actorCharacterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.actorCharacterRequired });
    }

    if (!req.body.summary) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.summaryRequired });
    }

    const actor = await requireUserCharacter(sessionId, userId, actorCharacterId);
    if (!actor) {
      return res.status(403).json({ success: false, message: '해당 캐릭터에 접근할 수 없습니다' });
    }

    const hasAuthority = actor.commandCards?.some((card) => ['politics', 'logistics'].includes(card.category));
    if (!hasAuthority) {
      return res.status(403).json({ success: false, message: '경제 이벤트를 기록할 권한이 없습니다' });
    }

    const event = await recordEconomyEvent({
      sessionId,
      type: req.body.type ?? 'custom',
      faction: req.body.faction,
      amount: Number(req.body.amount ?? 0),
      summary: req.body.summary,
      description: req.body.description,
      supplyImpact: req.body.supplyImpact,
      tradeImpact: req.body.tradeImpact,
      createdBy: {
        userId,
        characterId: actor.characterId,
        displayName: actor.displayName,
      },
    });

    notifyQaLogUpdate(sessionId, {
      section: 'EconomyState',
      status: 'pass',
      note: `Economy event ${event.eventId} recorded by ${actor.displayName}`,
    });

    res.json({
      success: true,
      data: event,
      compliance: [
        {
          manualRef: 'gin7manual.txt:299-304',
          status: '✅',
          note: '경제 조정 내역이 권한 검증과 함께 기록됨',
        },
      ],
    });
  } catch (error: any) {
    if (sessionId) {
      notifyQaLogUpdate(sessionId, {
        section: 'EconomyState',
        status: 'fail',
        note: error.message,
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/comm/messages', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req) || '') as string;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const channelType = req.query.channelType as string;
    const scopeId = req.query.scopeId as string | undefined;

    if (!channelType) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.channelTypeRequired });
    }

    const messages = await listCommMessages(sessionId, {
      channelType: channelType as any,
      scopeId,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    res.json({
      success: true,
      data: messages,
      compliance: [
        {
          manualRef: 'gin7manual.txt:610-699',
          status: '✅',
          note: '채팅 기록 범위가 지점·함대·전체 채널 규칙을 따름',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/comm/messages', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const { channelType, scopeId, message, senderCharacterId } = req.body;
    if (!channelType || !['spot', 'fleet', 'grid', 'global'].includes(channelType)) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.channelTypeInvalid });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.messageRequired });
    }
    if (!senderCharacterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.senderCharacterRequired });
    }

    const sender = await requireUserCharacter(sessionId, userId, senderCharacterId);
    if (!sender) {
      return res.status(403).json({ success: false, message: '해당 캐릭터에 접근할 수 없습니다' });
    }

    const { message: savedMessage } = await sendCommMessage({
      sessionId,
      channelType,
      scopeId,
      senderCharacterId: sender.characterId,
      senderName: sender.displayName,
      message,
      metadata: req.body.metadata,
    });

    notifyQaLogUpdate(sessionId, {
      section: 'CommSystem',
      status: 'pass',
      note: `Message logged on ${channelType} channel by ${sender.displayName}`,
    });

    res.json({
      success: true,
      data: savedMessage,
      compliance: [
        {
          manualRef: 'gin7manual.txt:610-699',
          status: '✅',
          note: '지점·함대·전체 범위를 발신자 검증과 함께 적용',
        },
      ],
    });
  } catch (error: any) {
    if (sessionId) {
      notifyQaLogUpdate(sessionId, {
        section: 'CommSystem',
        status: 'fail',
        note: error.message,
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/comm/address-book', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req) || '') as string;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const characterId = req.query.characterId as string;
    if (!characterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.characterIdRequired });
    }

    const owner = await requireUserCharacter(sessionId, userId, characterId);
    if (!owner) {
      return res.status(403).json({ success: false, message: '세션 캐릭터를 찾을 수 없습니다' });
    }

    const book = await listAddressBook(sessionId, owner.characterId);
    res.json({
      success: true,
      data: book,
      compliance: [
        {
          manualRef: 'gin7manual.txt:610-699',
          status: '✅',
          note: '주소록이 매뉴얼 기준 최대 100개까지 제한',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/comm/address-book', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const { ownerCharacterId, contactCharacterId } = req.body;
    if (!ownerCharacterId || !contactCharacterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.ownerContactRequired });
    }

    if (ownerCharacterId === contactCharacterId) {
      return res.status(400).json({ success: false, message: '본인을 주소록에 추가할 수 없습니다' });
    }

    const owner = await requireUserCharacter(sessionId, userId, ownerCharacterId);
    if (!owner) {
      return res.status(403).json({ success: false, message: '세션 캐릭터를 찾을 수 없습니다' });
    }

    const contact = await GalaxyCharacter.findOne({ session_id: sessionId, characterId: contactCharacterId });
    if (!contact) {
      return res.status(404).json({ success: false, message: '연락처 대상 캐릭터를 찾을 수 없습니다' });
    }

    const entry = await addAddressBookEntry(sessionId, owner.characterId, contact.characterId, contact.displayName);

    res.json({
      success: true,
      data: entry,
      compliance: [
        {
          manualRef: 'gin7manual.txt:610-699',
          status: '✅',
          note: '명함 교환이 제한 수량 내에서 기록됨',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/comm/handshakes', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const { requesterCharacterId, targetCharacterId } = req.body;
    if (!requesterCharacterId || !targetCharacterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.requesterTargetRequired });
    }

    const requester = await requireUserCharacter(sessionId, userId, requesterCharacterId);
    if (!requester) {
      return res.status(403).json({ success: false, message: '세션 캐릭터를 찾을 수 없습니다' });
    }

    const handshake = await requestHandshake(sessionId, requester.characterId, targetCharacterId);
    res.json({
      success: true,
      data: handshake,
      compliance: [
        {
          manualRef: 'gin7manual.txt:610-699',
          status: '✅',
          note: '메신저 악수 절차가 매뉴얼 순서를 따름',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/comm/handshakes/:handshakeId/respond', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const { handshakeId } = req.params;
    const { responderCharacterId, action } = req.body;
    if (!responderCharacterId || !['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.responseActionRequired });
    }

    const responder = await requireUserCharacter(sessionId, userId, responderCharacterId);
    if (!responder) {
      return res.status(403).json({ success: false, message: '세션 캐릭터를 찾을 수 없습니다' });
    }

    const handshake = await respondHandshake(sessionId, handshakeId, responder.characterId, action);

    res.json({
      success: true,
      data: handshake,
      compliance: [
        {
          manualRef: 'gin7manual.txt:610-699',
          status: '✅',
          note: `Handshake ${action} by ${responder.displayName}`,
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/comm/handshakes', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req) || '') as string;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 필요합니다' });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const characterId = req.query.characterId as string;
    if (!characterId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.characterIdRequired });
    }

    const owner = await requireUserCharacter(sessionId, userId, characterId);
    if (!owner) {
      return res.status(403).json({ success: false, message: '세션 캐릭터를 찾을 수 없습니다' });
    }

    const handshakes = await listHandshakes(sessionId, owner.characterId, req.query.status as string | undefined);
    res.json({
      success: true,
      data: handshakes,
      compliance: [
        {
          manualRef: 'gin7manual.txt:610-699',
          status: '✅',
          note: '메신저 악수 대기열을 감사용으로 조회 가능',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
