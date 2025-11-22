import { GalaxySession, IGalaxySession } from '../../models/logh/GalaxySession.model';
import {
  GalaxySessionClock,
  IGalaxyLoopStats,
  IGalaxySessionClock,
} from '../../models/logh/GalaxySessionClock.model';
import { GalaxyOperation } from '../../models/logh/GalaxyOperation.model';
import { Planet } from '../../models/logh/Planet.model';
import { StarSystem } from '../../models/logh/StarSystem.model';
import { Fleet } from '../../models/logh/Fleet.model';
import { SessionStateService } from '../sessionState.service';
import { logger } from '../../common/logger';
import { emitGin7Alert } from './Gin7DaemonAlert.service';

const HOUR_MS = 60 * 60 * 1000;
const MAX_OPERATION_DURATION_MS = 30 * 24 * HOUR_MS; // Chapter3 작전 계획 30일 제한
const TIME_LIMIT = new Date(Date.UTC(801, 6, 27, 0, 0, 0)); // gin7manual.txt:444-448

const CAPITAL_HOME_MAP: Record<string, 'empire' | 'alliance'> = {
  odin: 'empire',
  heinessen: 'alliance',
};

export interface VictorySnapshot {
  gameTime: Date;
  capitalConqueror: 'empire' | 'alliance' | null;
  starSystemCounts: Record<'empire' | 'alliance', number>;
  populationShare: Record<'empire' | 'alliance', number>;
  fleetShips: Record<'empire' | 'alliance', number>;
}

export interface VictoryDecision {
  shouldEnd: boolean;
  winner?: 'empire' | 'alliance';
  type?: 'decisive' | 'limited' | 'local' | 'defeat';
  reason?: string;
}

export function evaluateVictoryState(snapshot: VictorySnapshot): VictoryDecision {
  if (snapshot.capitalConqueror) {
    const winner = snapshot.capitalConqueror;
    const loser = winner === 'empire' ? 'alliance' : 'empire';
    const populationAdvantage = snapshot.populationShare[winner];
    const shipRatio =
      snapshot.fleetShips[loser] === 0
        ? Infinity
        : snapshot.fleetShips[winner] / Math.max(1, snapshot.fleetShips[loser]);

    if (populationAdvantage >= 0.9 && shipRatio >= 10) {
      return {
        shouldEnd: true,
        winner,
        type: 'decisive',
        reason: '수도 함락과 함께 압도적 전력 우위를 달성했습니다 (gin7manual.txt:453-458).',
      };
    }

      return {
        shouldEnd: true,
        winner,
        type: 'limited',
        reason: '수도는 함락했지만 결정적 승리 조건을 충족하지 못했습니다.',
      };

  }

  if (snapshot.starSystemCounts.empire <= 3) {
    return {
      shouldEnd: true,
      winner: 'alliance',
      type: 'limited',
      reason: '제국의 성계 수가 임계값 아래로 붕괴했습니다 (gin7manual.txt:446-448).',
    };
  }

  if (snapshot.starSystemCounts.alliance <= 3) {
    return {
      shouldEnd: true,
      winner: 'empire',
      type: 'limited',
      reason: '동맹의 성계 수가 임계값 아래로 붕괴했습니다 (gin7manual.txt:446-448).',
    };
  }

  if (snapshot.gameTime >= TIME_LIMIT) {
    const empireShare = snapshot.populationShare.empire;
    const allianceShare = snapshot.populationShare.alliance;

    if (empireShare === allianceShare) {
      return {
        shouldEnd: true,
        winner: 'alliance',
        type: 'local',
        reason: '시간 제한에 도달했고 인구가 동률이므로 매뉴얼 467-468행에 따라 동맹이 우선합니다.',
      };
    }

    const winner = empireShare > allianceShare ? 'empire' : 'alliance';
    return {
      shouldEnd: true,
      winner,
      type: 'local',
      reason: '시간 제한에 도달했지만 결정적 승리를 달성하지 못했습니다 (gin7manual.txt:444-468).',
    };
  }

  return { shouldEnd: false };
}

export class Gin7StrategicLoopService {
  private interval: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly alertThresholdMs: number;

  constructor() {
    this.intervalMs = Number(process.env.GIN7_LOOP_INTERVAL_MS || 5000);
    this.alertThresholdMs = Number(process.env.GIN7_LOOP_ALERT_THRESHOLD_MS || 3500);
  }

  start() {
    if (this.interval) {
      return;
    }
    logger.info('[GIN7] Strategic loop started', { intervalMs: this.intervalMs });
    this.interval = setInterval(() => this.tickAllSessions(), this.intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('[GIN7] Strategic loop stopped');
    }
  }

  private async tickAllSessions() {
    try {
      const sessions = await GalaxySession.find({ status: { $in: ['preparing', 'running'] } });
      for (const session of sessions) {
        const startedAt = Date.now();
        try {
          await this.tickSession(session);
        } catch (sessionError: any) {
          await this.handleSessionTickFailure(session, sessionError, Date.now() - startedAt);
        }
      }
    } catch (error: any) {
      logger.error('[GIN7] Strategic loop error', { error: error.message });
      await emitGin7Alert({
        level: 'error',
        code: 'tick-failure',
        message: '전략 루프 실행이 중단되었습니다.',
        detail: { error: error.message },
      });
    }
  }

  private async handleSessionTickFailure(
    session: IGalaxySession,
    error: any,
    durationMs: number
  ) {
    const message = error?.message || '원인을 알 수 없는 전략 루프 실패';
    logger.error('[GIN7] Session tick failure', {
      sessionId: session.session_id,
      error: message,
    });

    await emitGin7Alert({
      level: 'error',
      code: 'tick-failure',
      message: `전략 루프 틱이 세션 ${session.session_id}에서 실패했습니다`,
      sessionId: session.session_id,
      detail: {
        error: message,
        durationMs,
      },
    });

    const timeScaleFactor = session.timeScale
      ? session.timeScale.gameSeconds / Math.max(1, session.timeScale.realSeconds)
      : 24;

    await GalaxySessionClock.updateOne(
      { session_id: session.session_id },
      {
        $setOnInsert: {
          session_id: session.session_id,
          gameTime: new Date(),
          lastRealTickAt: new Date(),
          timeScaleFactor,
          phase: 'strategic',
          manuallyPaused: false,
        },
        $set: {
          'loopStats.lastAlertAt': new Date(),
          'loopStats.lastAlertReason': message,
          'loopStats.lastTickDurationMs': durationMs,
        },
        $inc: { 'loopStats.consecutiveFailures': 1 },
      },
      { upsert: true }
    );
  }

  private async tickSession(session: IGalaxySession) {
    const clock = await this.ensureClock(session);
    if (clock.manuallyPaused) {
      return;
    }

    const now = new Date();
    const deltaReal = (now.getTime() - clock.lastRealTickAt.getTime()) / 1000;
    if (deltaReal < 1) {
      return;
    }

    const tickStartedAt = Date.now();

    const sessionScale = session.timeScale
      ? session.timeScale.gameSeconds / Math.max(1, session.timeScale.realSeconds)
      : clock.timeScaleFactor;

    const deltaGameMs = deltaReal * sessionScale * 1000;
    clock.gameTime = new Date(clock.gameTime.getTime() + deltaGameMs);
    clock.lastRealTickAt = now;

    await this.syncSessionCalendar(session, clock.gameTime);
    await this.updateOperations(session.session_id, clock.gameTime);
    await this.evaluateVictory(session, clock.gameTime);

    const durationMs = Date.now() - tickStartedAt;
    this.applyLoopStats(clock, durationMs);

    if (durationMs > this.alertThresholdMs) {
      const alertReason = `Tick latency ${durationMs}ms exceeded ${this.alertThresholdMs}ms threshold`;
      const stats = clock.loopStats ?? this.createLoopStatsBaseline();
      clock.loopStats = {
        ...stats,
        lastAlertAt: new Date(),
        lastAlertReason: alertReason,
        consecutiveFailures: 0,
      };
      await emitGin7Alert({
        level: 'warn',
        code: 'tick-lag',
        message: alertReason,
        sessionId: session.session_id,
        detail: {
          durationMs,
          thresholdMs: this.alertThresholdMs,
        },
      });
    }

    await clock.save();
  }

  private async ensureClock(session: IGalaxySession) {
    const existing = await GalaxySessionClock.findOne({ session_id: session.session_id });
    if (existing) {
      return existing;
    }

    const sessionDoc: any = session;
    const seedYear = sessionDoc.year || sessionDoc?.data?.year || 796;
    const seedMonth = sessionDoc.month || sessionDoc?.data?.month || 1;

    return GalaxySessionClock.create({
      session_id: session.session_id,
      gameTime: new Date(Date.UTC(seedYear, seedMonth - 1, 1)),
      lastRealTickAt: new Date(),
      timeScaleFactor: session.timeScale?.gameSeconds
        ? session.timeScale.gameSeconds / Math.max(1, session.timeScale.realSeconds)
        : 24,
    });
  }

  private async syncSessionCalendar(session: IGalaxySession, gameTime: Date) {
    const sessionDoc: any = session;
    sessionDoc.year = gameTime.getUTCFullYear();
    sessionDoc.month = gameTime.getUTCMonth() + 1;
    sessionDoc.updatedAt = new Date();
    await session.save();
  }

  private async updateOperations(sessionId: string, gameTime: Date) {
    const operations = await GalaxyOperation.find({
      session_id: sessionId,
      status: { $in: ['issued', 'executing'] },
    });

    for (const operation of operations) {
      const issuedAt = operation.timeline?.issuedAt;
      if (!issuedAt) {
        continue;
      }

      const startMs = issuedAt.getTime() + (operation.timeline?.waitHours ?? 0) * HOUR_MS;
      const nominalEnd = startMs + (operation.timeline?.executionHours ?? 720) * HOUR_MS;
      const hardEnd = issuedAt.getTime() + MAX_OPERATION_DURATION_MS;
      const endMs = Math.min(nominalEnd, hardEnd);

      if (operation.status === 'issued' && gameTime.getTime() >= startMs) {
        operation.status = 'executing';
        operation.auditTrail.push({
          note: 'Operation entered execution window (gin7manual.txt:1850-1866)',
          author: 'system',
          createdAt: new Date(),
        });
        await operation.save();
        continue;
      }

      if (operation.status === 'executing' && gameTime.getTime() >= endMs) {
        operation.status = 'completed';
        operation.auditTrail.push({
          note: 'Operation automatically completed after 30 game days limit',
          author: 'system',
          createdAt: new Date(),
        });
        await operation.save();
      }
    }
  }

  private async evaluateVictory(session: IGalaxySession, gameTime: Date) {
    const snapshot = await this.buildSnapshot(session.session_id, gameTime);
    const decision = evaluateVictoryState(snapshot);
    if (!decision.shouldEnd || !decision.winner || !decision.type) {
      return;
    }

    session.status = 'ended';
    session.victoryState = {
      type: decision.type,
      achievedAt: new Date(),
    };

    session.notifications = [
      ...(session.notifications || []),
      {
        message: `GIN7 session ended with ${decision.winner} ${decision.type} victory (${decision.reason || 'rule-based completion'})`,
        createdAt: new Date(),
        manualRef: 'gin7manual.txt:443-470',
      },
    ];

    await session.save();
    await SessionStateService.finishSession(session.session_id);
    logger.info('[GIN7] Session ended', {
      sessionId: session.session_id,
      victory: decision.type,
      winner: decision.winner,
      reason: decision.reason,
    });

    await emitGin7Alert({
      level: 'info',
      code: 'victory',
      message: `Session ${session.session_id} ended with ${decision.winner} ${decision.type} victory`,
      sessionId: session.session_id,
      detail: {
        winner: decision.winner,
        type: decision.type,
        reason: decision.reason,
      },
    });
  }

  private createLoopStatsBaseline(): IGalaxyLoopStats {
    return {
      lastTickDurationMs: 0,
      avgTickDurationMs: 0,
      maxTickDurationMs: 0,
      sampleCount: 0,
      consecutiveFailures: 0,
    };
  }

  private applyLoopStats(clock: IGalaxySessionClock, durationMs: number) {
    const stats: IGalaxyLoopStats = clock.loopStats ?? this.createLoopStatsBaseline();

    const sampleCount = Math.min((stats.sampleCount || 0) + 1, 10000);
    const avg =
      stats.sampleCount && stats.avgTickDurationMs
        ? stats.avgTickDurationMs + (durationMs - stats.avgTickDurationMs) / sampleCount
        : durationMs;

    clock.loopStats = {
      ...stats,
      lastTickDurationMs: durationMs,
      avgTickDurationMs: Math.round(avg),
      maxTickDurationMs: Math.max(stats.maxTickDurationMs || 0, durationMs),
      sampleCount,
      lastTickCompletedAt: new Date(),
      consecutiveFailures: 0,
    };
  }

  private async buildSnapshot(sessionId: string, gameTime: Date): Promise<VictorySnapshot> {
    const planets = await Planet.find({ session_id: sessionId }).lean();
    const starSystems = await StarSystem.find({ session_id: sessionId }).lean();
    const fleets = await Fleet.find({ session_id: sessionId }).lean();

    const population: Record<'empire' | 'alliance', number> = { empire: 0, alliance: 0 };
    let capitalConqueror: 'empire' | 'alliance' | null = null;

    for (const planet of planets) {
      if (planet.owner === 'empire' || planet.owner === 'alliance') {
        population[planet.owner] += planet.stats?.population || 0;
      }

      if (planet.isCapital) {
        const expected = CAPITAL_HOME_MAP[planet.planetId];
        if (expected && planet.owner !== expected && (planet.owner === 'empire' || planet.owner === 'alliance')) {
          capitalConqueror = planet.owner;
        }
      }
    }

    const totalPopulation = population.empire + population.alliance || 1;
    const populationShare: Record<'empire' | 'alliance', number> = {
      empire: population.empire / totalPopulation,
      alliance: population.alliance / totalPopulation,
    };

    const starSystemCounts: Record<'empire' | 'alliance', number> = { empire: 0, alliance: 0 };
    for (const system of starSystems) {
      if (system.faction === 'empire' || system.faction === 'alliance') {
        starSystemCounts[system.faction] += 1;
      }
    }

    const fleetShips: Record<'empire' | 'alliance', number> = { empire: 0, alliance: 0 };
    for (const fleet of fleets) {
      if (fleet.faction === 'empire' || fleet.faction === 'alliance') {
        fleetShips[fleet.faction] += fleet.totalShips || 0;
      }
    }

    return {
      gameTime,
      capitalConqueror,
      starSystemCounts,
      populationShare,
      fleetShips,
    };
  }
}
