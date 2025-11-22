import { randomUUID } from 'crypto';
import { GalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { GalaxyOperation } from '../../models/logh/GalaxyOperation.model';
import {
  GalaxyValidationService,
  CommandPointCost,
} from './GalaxyValidation.service';
import { notifyApiContractChange, notifyQaLogUpdate } from './GalaxyNotification.service';

interface CreateOperationParams {
  sessionId: string;
  authorCharacterId: string;
  cardType: string;
  objectiveType: 'assault' | 'defense' | 'occupation' | 'sweep' | 'logistics' | 'escort' | 'resupply';
  targetGrid: { x: number; y: number };
  cpCost: CommandPointCost;
  timeline: { waitHours?: number; executionHours?: number };
  logistics: {
    fuelCrates: number;
    supplyHours: number;
    unitBatchLimit: number;
    planetsTouched: string[];
  };
  participants?: Array<{ characterId: string; fleetId?: string; role?: 'executor' | 'logistics' | 'observer' }>;
  requesterUserId: string;
}

interface IssueOperationParams {
  sessionId: string;
  operationId: string;
  issuerCharacterId?: string;
}

export async function createGalaxyOperation(
  params: CreateOperationParams
) {
  const {
    sessionId,
    authorCharacterId,
    cardType,
    objectiveType,
    targetGrid,
    cpCost,
    timeline,
    logistics,
    participants = [],
    requesterUserId,
  } = params;

  if (logistics.unitBatchLimit > 300) {
    throw new Error('Chapter3 그리드 규격상 unitBatchLimit은 300을 초과할 수 없습니다.');
  }

  const author = await GalaxyCharacter.findOne({
    session_id: sessionId,
    characterId: authorCharacterId,
  });

  if (!author) {
    throw new Error('작전 작성자를 찾을 수 없습니다.');
  }

  if (author.userId !== requesterUserId) {
    throw new Error('작전 작성자를 제어할 권한이 없습니다.');
  }

  const ownsCard = author.commandCards.some((card) => card.cardId === cardType || card.name === cardType);
  if (!ownsCard) {
    throw new Error('필요한 직무 카드가 없습니다.');
  }

  const terrainRisk = await GalaxyValidationService.assessTerrain(sessionId, targetGrid);
  if (terrainRisk.impassable) {
    throw new Error('작전 목표 지형이 항행 불가 지역입니다. 다른 좌표를 선택하세요.');
  }

  const resolvedTimeline = {
    waitHours: timeline.waitHours ?? 6,
    executionHours: timeline.executionHours ?? 720,
  };

  const cpResult = GalaxyValidationService.applyCommandPointCost(author, cpCost);
  await author.save();

  const operationId = randomUUID();
  const code = `OP-${targetGrid.x}-${targetGrid.y}-${Date.now()}`;

  const operation = await GalaxyOperation.create({
    session_id: sessionId,
    operationId,
    code,
    authorCharacterId,
    cardType,
    objectiveType,
    targetGrid,
    cpCost: { ...cpCost, substituted: cpResult.substituted },
    timeline: {
      waitHours: resolvedTimeline.waitHours,
      executionHours: resolvedTimeline.executionHours,
      issuedAt: new Date(),
    },
    logistics,
    terrainRisk,
    participants: [
      {
        characterId: authorCharacterId,
        role: 'author',
        status: 'approved',
      },
      ...participants.map((participant) => ({
        characterId: participant.characterId,
        fleetId: participant.fleetId,
        role: participant.role ?? 'executor',
        status: 'pending',
      })),
    ],
    auditTrail: [
      {
        note: 'API를 통해 작전이 작성되었습니다.',
        author: authorCharacterId,
        createdAt: new Date(),
      },
    ],
    status: 'draft',
  });

  notifyApiContractChange(sessionId, {
    endpoint: '/api/logh/galaxy/operations',
    change: 'OperationPlan schema v1 published',
    qaEntryId: 'QA-OPS-001',
    schemaVersion: '1.0.0',
  });

  return operation;
}

export async function issueGalaxyOperation(params: IssueOperationParams) {
  const { sessionId, operationId, issuerCharacterId } = params;
  const operation = await GalaxyOperation.findOne({ session_id: sessionId, operationId });
  if (!operation) {
    throw new Error('발령할 작전을 찾을 수 없습니다.');
  }

  if (operation.status !== 'draft') {
    throw new Error('기안 상태의 작전만 발령할 수 있습니다.');
  }

  operation.status = 'issued';
  operation.timeline = {
    waitHours: operation.timeline?.waitHours ?? 6,
    executionHours: operation.timeline?.executionHours ?? 720,
    issuedAt: new Date(),
  };
  operation.auditTrail.push({
    note: 'Chapter3 발령 흐름에 따라 작전을 발령했습니다.',
    author: issuerCharacterId || 'system',
    createdAt: new Date(),
  });

  await operation.save();

  notifyQaLogUpdate(sessionId, {
    section: 'OperationPlan',
    status: 'pass',
    note: `작전 ${operation.code}을(를) 발령했습니다.`,
  });

  return operation;
}
