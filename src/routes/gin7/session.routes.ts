import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { GalaxySession, IGalaxySession } from '../../models/logh/GalaxySession.model';
import { GalaxySessionClock, IGalaxySessionClock } from '../../models/logh/GalaxySessionClock.model';
import { GalaxyAuthorityCard, IGalaxyAuthorityCard } from '../../models/logh/GalaxyAuthorityCard.model';
import { GalaxyCharacter, IGalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { tupleAll } from '../../services/logh/Gin7Frontend.service';
import { gin7CommandCatalog } from '../../config/gin7/catalog';

const router = Router();
router.use(autoExtractToken);

router.get('/sessions/:sessionId/overview', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const [session, clock, cards, characters] = await tupleAll([
      GalaxySession.findOne({ session_id: sessionId }).lean<IGalaxySession>(),
      GalaxySessionClock.findOne({ session_id: sessionId }).lean<IGalaxySessionClock>(),
      GalaxyAuthorityCard.find({ session_id: sessionId }).lean<IGalaxyAuthorityCard[]>(),
      GalaxyCharacter.find({ session_id: sessionId })
        .select('characterId displayName faction rank commandPoints commandCards organizationNodeId')
        .lean<IGalaxyCharacter[]>(),
    ] satisfies readonly [
      Promise<IGalaxySession | null>,
      Promise<IGalaxySessionClock | null>,
      Promise<IGalaxyAuthorityCard[]>,
      Promise<IGalaxyCharacter[]>
    ]);

    if (!session) {
      return res.status(404).json({ success: false, message: `Session ${sessionId} not found` });
    }

    const cardSummary = buildCardSummary(cards);
    const commandPoints = buildCommandPointSnapshot(characters);
    const shortcuts = cards
      .sort((a, b) => {
        if (a.status === b.status) {
          return (b.lastIssuedAt?.getTime() || 0) - (a.lastIssuedAt?.getTime() || 0);
        }
        if (a.status === 'assigned') {
          return -1;
        }
        if (b.status === 'assigned') {
          return 1;
        }
        return 0;
      })
      .slice(0, 12)
      .map((card) => ({
        cardId: card.cardId,
        title: card.title,
        category: card.category,
        status: card.status,
        commandGroups: card.commandGroups,
        commandCodes: card.commandCodes,
        holderCharacterId: card.holderCharacterId,
        lastIssuedAt: card.lastIssuedAt?.toISOString?.(),
      }));

    res.json({
      success: true,
      schemaVersion: '2025-11-22.session.2',
      meta: {
        commandCatalogVersion: gin7CommandCatalog.version,
        commandCatalogSource: gin7CommandCatalog.source,
      },
      data: {
        session: {
          sessionId: session.session_id,
          title: session.title,
          status: session.status,
          factions: session.factions,
          logisticWindowHours: session.logisticWindowHours,
          notifications: (session.notifications || []).slice(-5).map((entry) => ({
            message: entry.message,
            createdAt:
              entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
            manualRef: entry.manualRef,
          })),
        },
        clock: clock
          ? {
              gameTime: clock.gameTime?.toISOString?.(),
              lastRealTickAt: clock.lastRealTickAt?.toISOString?.(),
              phase: clock.phase,
              manuallyPaused: clock.manuallyPaused,
              loopStats: clock.loopStats
                ? {
                    ...clock.loopStats,
                    lastTickCompletedAt: clock.loopStats.lastTickCompletedAt?.toISOString?.(),
                    lastAlertAt: clock.loopStats.lastAlertAt?.toISOString?.(),
                  }
                : undefined,
            }
          : null,
        cards: cardSummary,
        commandPoints,
        shortcuts,
        commandCatalog: gin7CommandCatalog,
      },
      compliance: [
        {
          manualRef: 'gin7manual.txt:1076-1188',
          note: '직무 권한 카드 재고·상태와 명령 포인트 회복 규칙을 단일 엔드포인트에서 제공',
        },

        {
          manualRef: 'gin7manual.txt:1800-1898',
          note: '세션 시계/전략 루프 상태를 Chapter3 Schedule 규칙에 맞춰 제공',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

function buildCardSummary(cards: IGalaxyAuthorityCard[]) {
  const byStatus: Record<IGalaxyAuthorityCard['status'], number> = {
    available: 0,
    assigned: 0,
    locked: 0,
    revoked: 0,
  };
  const byCategory: Partial<Record<IGalaxyAuthorityCard['category'], number>> = {};

  for (const card of cards) {
    byStatus[card.status] += 1;
    byCategory[card.category] = (byCategory[card.category] || 0) + 1;
  }

  const recentAssignments = cards
    .filter((card) => card.lastIssuedAt)
    .sort((a, b) => (b.lastIssuedAt?.getTime() || 0) - (a.lastIssuedAt?.getTime() || 0))
    .slice(0, 5)
    .map((card) => ({
      cardId: card.cardId,
      title: card.title,
      holderCharacterId: card.holderCharacterId,
      lastIssuedAt: card.lastIssuedAt?.toISOString?.(),
    }));

  return {
    total: cards.length,
    byStatus,
    byCategory,
    recentAssignments,
  };
}

function buildCommandPointSnapshot(characters: IGalaxyCharacter[]) {
  const rosterSize = characters.length;
  const totals = characters.reduce(
    (acc, character) => {
      acc.pcp += character.commandPoints?.pcp || 0;
      acc.mcp += character.commandPoints?.mcp || 0;
      return acc;
    },
    { pcp: 0, mcp: 0 }
  );

  const lowCapacity = characters.filter((character) => (character.commandPoints?.pcp || 0) <= 3).length;
  const substitutionDebt = characters.filter(
    (character) => (character.commandPoints?.pcp || 0) === 0 && (character.commandPoints?.mcp || 0) > 0
  ).length;

  const lastRecoverySample = characters
    .filter((character) => character.commandPoints?.lastRecoveredAt)
    .sort(
      (a, b) =>
        (b.commandPoints?.lastRecoveredAt?.getTime() || 0) -
        (a.commandPoints?.lastRecoveredAt?.getTime() || 0)
    )
    .slice(0, 5)
    .map((character) => ({
      characterId: character.characterId,
      displayName: character.displayName,
      faction: character.faction,
      rank: character.rank,
      pcp: character.commandPoints?.pcp || 0,
      mcp: character.commandPoints?.mcp || 0,
      lastRecoveredAt: character.commandPoints?.lastRecoveredAt?.toISOString?.(),
    }));

  return {
    rosterSize,
    totals,
    average: {
      pcp: rosterSize ? Number((totals.pcp / rosterSize).toFixed(2)) : 0,
      mcp: rosterSize ? Number((totals.mcp / rosterSize).toFixed(2)) : 0,
    },
    lowCapacity,
    substitutionDebt,
    lastRecoverySample,
  };
}

export default router;
