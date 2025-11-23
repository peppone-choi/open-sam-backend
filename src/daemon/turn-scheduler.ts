import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { logger } from '../common/logger';
import { sessionRepository } from '../repositories/session.repository';
import { SessionStateService } from '../services/sessionState.service';

export interface TurnSchedulerOptions {
  pollIntervalMs?: number;
  maxConcurrentSessions?: number;
  jitterMs?: number;
}

interface StartOptions {
  runImmediately?: boolean;
}

interface ScheduledHandle {
  timer: NodeJS.Timeout;
  nextRun: number;
}

export class TurnScheduler {
  private readonly pollIntervalMs: number;
  private readonly maxConcurrentSessions: number;
  private readonly jitterMs: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly scheduledSessions = new Map<string, ScheduledHandle>();
  private readonly runningSessions = new Set<string>();
  private readonly pendingQueue: string[] = [];
  private stopped = true;

  constructor(options: TurnSchedulerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 30_000;
    this.maxConcurrentSessions = Math.max(1, options.maxConcurrentSessions ?? 3);
    this.jitterMs = Math.max(0, options.jitterMs ?? 5_000);
  }

  async start(opts: StartOptions = {}): Promise<void> {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;

    await this.refreshSessions(opts.runImmediately === true);
    this.pollTimer = setInterval(() => {
      void this.refreshSessions(false);
    }, this.pollIntervalMs);
    logger.info('[TurnScheduler] started', {
      pollIntervalMs: this.pollIntervalMs,
      maxConcurrent: this.maxConcurrentSessions,
    });
  }

  stop(): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const handle of this.scheduledSessions.values()) {
      clearTimeout(handle.timer);
    }
    this.scheduledSessions.clear();
    this.runningSessions.clear();
    this.pendingQueue.length = 0;
    logger.info('[TurnScheduler] stopped');
  }

  trigger(sessionId: string, runImmediately = false): void {
    const existing = this.scheduledSessions.get(sessionId);
    if (existing) {
      clearTimeout(existing.timer);
      this.scheduledSessions.delete(sessionId);
    }
    if (runImmediately) {
      this.enqueue(sessionId);
    } else {
      this.scheduleSession(sessionId, new Date());
    }
  }

  private async refreshSessions(runImmediately: boolean): Promise<void> {
    if (this.stopped) {
      return;
    }
    try {
      const sessions = await sessionRepository.findAllActive();
      const resolvedStates = await Promise.all(
        sessions.map(async (session) => {
          const sessionId = session.session_id;
          const state = await SessionStateService.getSessionState(sessionId);
          return { session, sessionId, state };
        })
      );

      for (const { session, sessionId, state } of resolvedStates) {
        if (!state) {
          logger.warn('[TurnScheduler] skip scheduling due to missing session state', { sessionId });
          continue;
        }

        if (state.status !== 'running') {
          logger.debug('[TurnScheduler] skip non-running session', { sessionId, status: state.status });
          continue;
        }

        if (state.isLocked) {
          logger.debug('[TurnScheduler] skip locked session until daemon releases', { sessionId });
          continue;
        }

        if (runImmediately) {
          this.enqueue(sessionId);
        }

        const turntime = state.turntime || session.data?.turntime || session.turntime;
        this.scheduleSession(sessionId, turntime);
        logger.debug('[TurnScheduler] scheduled session via cache hierarchy', {
          sessionId,
          cachedTurntime: turntime instanceof Date ? turntime.toISOString() : turntime,
        });
      }
    } catch (error: any) {
      logger.error('[TurnScheduler] refresh failed', { error: error?.message });
    }
  }

  private scheduleSession(sessionId: string, turntime?: string | Date | null): void {
    if (this.stopped) {
      return;
    }
    const target = this.resolveNextRun(turntime);
    const jitter = this.jitterMs > 0 ? Math.floor(Math.random() * this.jitterMs) : 0;
    const delay = Math.max(0, target - Date.now() + jitter);

    const previous = this.scheduledSessions.get(sessionId);
    if (previous) {
      clearTimeout(previous.timer);
    }

    const timer = setTimeout(() => {
      this.scheduledSessions.delete(sessionId);
      this.enqueue(sessionId);
    }, delay);

    this.scheduledSessions.set(sessionId, { timer, nextRun: target });
  }

  private resolveNextRun(turntime?: string | Date | null): number {
    if (!turntime) {
      return Date.now() + this.pollIntervalMs;
    }
    const date = typeof turntime === 'string' ? new Date(turntime) : turntime;
    if (Number.isNaN(date.getTime())) {
      return Date.now() + this.pollIntervalMs;
    }
    return date.getTime();
  }

  private enqueue(sessionId: string): void {
    if (this.runningSessions.size >= this.maxConcurrentSessions) {
      if (!this.pendingQueue.includes(sessionId)) {
        this.pendingQueue.push(sessionId);
      }
      return;
    }
    void this.executeSession(sessionId).catch((error) => {
      logger.error('[TurnScheduler] execution failed', { sessionId, error: error?.message });
    });
  }

  private async executeSession(sessionId: string): Promise<void> {
    if (this.runningSessions.has(sessionId) || this.stopped) {
      return;
    }
    this.runningSessions.add(sessionId);
    try {
      const result = await ExecuteEngineService.execute({ session_id: sessionId });
      if (result?.updated) {
        try {
          await SessionStateService.invalidateCache(sessionId);
          logger.debug('[TurnScheduler] invalidated session cache after ExecuteEngine run', { sessionId });
        } catch (cacheError: any) {
          logger.warn('[TurnScheduler] failed to invalidate session cache after execution', {
            sessionId,
            error: cacheError?.message,
          });
        }
      }
      const nextTurntime = result?.turntime;
      this.scheduleSession(sessionId, nextTurntime);
    } catch (error: any) {
      logger.error('[TurnScheduler] ExecuteEngine error', { sessionId, error: error?.message });
      // 재시도: 일정 시간 후 다시 스케줄링
      this.scheduleSession(sessionId, new Date(Date.now() + this.pollIntervalMs));
    } finally {
      this.runningSessions.delete(sessionId);
      this.flushQueue();
    }
  }

  private flushQueue(): void {
    if (this.stopped || this.pendingQueue.length === 0) {
      return;
    }
    while (this.runningSessions.size < this.maxConcurrentSessions && this.pendingQueue.length > 0) {
      const nextSession = this.pendingQueue.shift();
      if (nextSession) {
        void this.executeSession(nextSession).catch((error) => {
          logger.error('[TurnScheduler] queue execution failed', { sessionId: nextSession, error: error?.message });
        });
      }
    }
  }
}
