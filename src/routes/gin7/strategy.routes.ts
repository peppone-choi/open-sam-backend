import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { GalaxySession, IGalaxySession } from '../../models/logh/GalaxySession.model';
import { GalaxySessionClock, IGalaxySessionClock } from '../../models/logh/GalaxySessionClock.model';
import { StarSystem, IStarSystem } from '../../models/logh/StarSystem.model';
import { Fleet, IFleet } from '../../models/logh/Fleet.model';
import { GalaxyOperation, IGalaxyOperation } from '../../models/logh/GalaxyOperation.model';
import { tupleAll } from '../../services/logh/Gin7Frontend.service';
import { gin7CommandCatalog } from '../../config/gin7/catalog';

const router = Router();
router.use(autoExtractToken);

router.get('/sessions/:sessionId/map', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const [session, clock, starSystems, fleets, operations] = await tupleAll([
      GalaxySession.findOne({ session_id: sessionId }).lean<IGalaxySession>(),
      GalaxySessionClock.findOne({ session_id: sessionId }).lean<IGalaxySessionClock>(),
      StarSystem.find({ session_id: sessionId })
        .select('systemId systemName systemNameJa systemNumber faction gridCoordinates strategicValue territoryType warpRoutes description')
        .sort({ systemNumber: 1 })
        .lean<IStarSystem[]>(),
      Fleet.find({ session_id: sessionId })
        .select(
          'fleetId name faction status strategicPosition destination isMoving movementSpeed movementRange totalShips morale supplies fuel commanderName isInCombat tacticalMapId formation updatedAt'
        )
        .lean<IFleet[]>(),
      GalaxyOperation.find({
        session_id: sessionId,
        status: { $in: ['issued', 'executing'] },
      })
        .select('operationId code objectiveType status targetGrid timeline logistics authorCharacterId participants')
        .lean<IGalaxyOperation[]>(),
    ] satisfies readonly [
      Promise<IGalaxySession | null>,
      Promise<IGalaxySessionClock | null>,
      Promise<IStarSystem[]>,
      Promise<IFleet[]>,
      Promise<IGalaxyOperation[]>
    ]);

    if (!session) {
      return res.status(404).json({ success: false, message: `Session ${sessionId} not found` });
    }

    const mapMeta = buildMapMeta(starSystems);
    const fleetOverlay = buildFleetOverlay(fleets);
    const operationHotspots = buildOperationHotspots(operations);

    res.json({
      success: true,
      schemaVersion: '2025-11-22.strategy.2',
      meta: {
        commandCatalogVersion: gin7CommandCatalog.version,
      },
      data: {
        session: {
          sessionId: session.session_id,
          title: session.title,
          status: session.status,
        },
        clock: clock
          ? {
              phase: clock.phase,
              gameTime: clock.gameTime?.toISOString?.(),
              loopStats: clock.loopStats
                ? {
                    lastTickDurationMs: clock.loopStats.lastTickDurationMs,
                    avgTickDurationMs: clock.loopStats.avgTickDurationMs,
                    maxTickDurationMs: clock.loopStats.maxTickDurationMs,
                    consecutiveFailures: clock.loopStats.consecutiveFailures,
                    lastTickCompletedAt: clock.loopStats.lastTickCompletedAt?.toISOString?.(),
                    lastAlertAt: clock.loopStats.lastAlertAt?.toISOString?.(),
                    lastAlertReason: clock.loopStats.lastAlertReason,
                  }
                : undefined,
            }
          : null,
        map: {
          meta: mapMeta,
          starSystems: starSystems.map((system) => ({
            systemId: system.systemId,
            systemNumber: system.systemNumber,
            name: system.systemName,
            faction: system.faction,
            grid: system.gridCoordinates,
            strategicValue: system.strategicValue,
            territoryType: system.territoryType,
            warpRoutes: system.warpRoutes,
          })),
        },
        fleets: fleetOverlay,
        operationHotspots,
      },
      compliance: [
        {
          manualRef: 'gin7manual.txt:316-331',
          note: '은하 지도 그리드와 워프 경로 데이터를 Chapter2 규격으로 제공',
        },
        {
          manualRef: 'gin7manual.txt:1850-1898',
          note: '작전 계획 진행도(발령→실행)와 30일 제한 모니터링 피드를 API로 제공합니다.',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

function buildMapMeta(starSystems: IStarSystem[]) {
  const warpRouteCount = starSystems.reduce(
    (acc, system) => acc + (system.warpRoutes?.length ?? 0),
    0
  );

  return {
    width: 100,
    height: 50,
    systemCount: starSystems.length,
    warpRouteCount,
  };
}

function buildFleetOverlay(fleets: IFleet[]) {
  return fleets.map((fleet) => ({
    fleetId: fleet.fleetId,
    name: fleet.name,
    faction: fleet.faction,
    status: fleet.status,
    commanderName: fleet.commanderName,
    position: fleet.strategicPosition,
    destination: fleet.destination,
    isMoving: fleet.isMoving,
    movementSpeed: fleet.movementSpeed,
    movementRange: fleet.movementRange,
    totalShips: fleet.totalShips,
    morale: fleet.morale,
    supplies: fleet.supplies,
    fuel: fleet.fuel,
    formation: fleet.formation,
    inCombat: fleet.isInCombat,
    tacticalMapId: fleet.tacticalMapId,
    updatedAt: fleet.updatedAt?.toISOString?.(),
  }));
}

function buildOperationHotspots(operations: IGalaxyOperation[]) {
  return operations
    .slice()
    .sort(
      (a, b) =>
        (b.timeline?.issuedAt?.getTime() || 0) - (a.timeline?.issuedAt?.getTime() || 0)
    )
    .map((operation) => ({
      operationId: operation.operationId,
      code: operation.code,
      objectiveType: operation.objectiveType,
      status: operation.status,
      targetGrid: operation.targetGrid,
      waitHours: operation.timeline?.waitHours,
      executionHours: operation.timeline?.executionHours,
      issuedAt: operation.timeline?.issuedAt?.toISOString?.(),
      logistics: operation.logistics,
      authorCharacterId: operation.authorCharacterId,
      participants: (operation.participants || []).map((participant) => ({
        characterId: participant.characterId,
        role: participant.role,
        status: participant.status,
      })),
    }));
}

export default router;
