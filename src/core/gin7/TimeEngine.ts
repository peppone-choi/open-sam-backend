import { EventEmitter } from 'events';
import { getSocketManager } from '../../socket/socketManager';
import { Gin7GameSession, IGin7GameSession } from '../../models/gin7/GameSession';
import { logger } from '../../common/logger';

// Event Constants (API Contract Compliant)
export const GIN7_EVENTS = {
  TIME_TICK: 'GIN7:TIME_TICK',
  DAY_START: 'GIN7:DAY_START',
  MONTH_START: 'GIN7:MONTH_START',
  SESSION_START: 'GIN7:SESSION_START',
  SESSION_END: 'GIN7:SESSION_END',
  CATCHUP: 'GIN7:CATCHUP',
} as const;

export interface GameTime {
  tick: number;
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
}

export interface TimeTickPayload {
  sessionId: string;
  tick: number;
  gameDate: GameTime;
  realtimeSpeed: number;
}

export interface DayStartPayload {
  sessionId: string;
  day: number;
  month: number;
  year: number;
}

export interface MonthStartPayload {
  sessionId: string;
  month: number;
  year: number;
}

/**
 * Gin7 Time Dilation Engine
 * 
 * Responsible for:
 * 1. Managing the game loop (ticks)
 * 2. Calculating game time based on real time and time scale (dilation)
 * 3. Emitting 'GIN7:TIME_TICK' events via Socket.io AND internal EventEmitter
 * 4. Emitting 'GIN7:DAY_START' and 'GIN7:MONTH_START' at boundaries
 * 5. Synchronizing state to DB periodically
 * 6. Catch-up logic for server restarts
 */
export class TimeEngine extends EventEmitter {
  private static instance: TimeEngine;
  
  private timer: NodeJS.Timeout | null = null;
  private readonly TICK_RATE_MS = 1000; // 1 real second per tick
  private readonly SYNC_INTERVAL_TICKS = 10; // Sync to DB every 10 ticks
  private readonly MAX_CATCHUP_TICKS = 3600; // Max 1 hour of catch-up (prevent infinite loops)
  
  private activeSessions: Map<string, {
    session: IGin7GameSession;
    accumulatedTicks: number; // Runtime tracking
    unsavedChanges: boolean;
    lastGameDay: number;      // Track day boundary
    lastGameMonth: number;    // Track month boundary
  }> = new Map();

  private constructor() {
    super();
    // Increase max listeners for many agents subscribing
    this.setMaxListeners(50);
  }

  public static getInstance(): TimeEngine {
    if (!TimeEngine.instance) {
      TimeEngine.instance = new TimeEngine();
    }
    return TimeEngine.instance;
  }

  /**
   * Start the engine. Should be called on server startup.
   */
  public async start() {
    if (this.timer) {
      logger.warn('[TimeEngine] Engine already running.');
      return;
    }

    logger.info('[TimeEngine] Starting Time Engine...');
    await this.loadActiveSessions();
    
    this.timer = setInterval(() => this.tick(), this.TICK_RATE_MS);
    logger.info(`[TimeEngine] Engine started at ${this.TICK_RATE_MS}ms tick rate.`);
  }

  /**
   * Stop the engine. Should be called on server shutdown.
   */
  public async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('[TimeEngine] Stopping engine. Saving all sessions...');
    await this.saveAllSessions();
  }

  /**
   * Load running sessions from DB into memory
   */
  private async loadActiveSessions() {
    try {
      const runningSessions = await Gin7GameSession.find({ status: 'running' });
      
      this.activeSessions.clear();
      for (const session of runningSessions) {
        this.registerSession(session);
      }
      logger.info(`[TimeEngine] Loaded ${runningSessions.length} active sessions.`);
    } catch (error) {
      logger.error('[TimeEngine] Failed to load active sessions:', error);
    }
  }

  /**
   * Register a session to be managed by the engine.
   * Includes catch-up logic to compensate for missed ticks during downtime.
   */
  public registerSession(session: IGin7GameSession) {
    // Ensure currentState is initialized
    if (!session.currentState) {
      session.currentState = {
        tick: 0,
        gameDate: session.timeConfig.baseTime,
        isPaused: false,
        lastTickTime: new Date()
      };
    }
    
    // === CATCH-UP LOGIC ===
    // Calculate how many ticks were missed since lastTickTime
    const now = Date.now();
    const lastTick = session.currentState.lastTickTime 
      ? new Date(session.currentState.lastTickTime).getTime() 
      : now;
    
    const elapsedMs = now - lastTick;
    const missedTicks = Math.floor(elapsedMs / session.timeConfig.tickRateMs);
    
    if (missedTicks > 0 && !session.currentState.isPaused) {
      const ticksToApply = Math.min(missedTicks, this.MAX_CATCHUP_TICKS);
      
      logger.info(`[TimeEngine] Session ${session.sessionId}: Catching up ${ticksToApply} missed ticks (${missedTicks} total, capped at ${this.MAX_CATCHUP_TICKS})`);
      
      // Apply missed ticks to the counter
      session.currentState.tick += ticksToApply;
      session.currentState.lastTickTime = new Date();
      
      // Recalculate game date based on new tick count
      const totalElapsedRealMs = session.currentState.tick * session.timeConfig.tickRateMs;
      const totalElapsedGameMs = totalElapsedRealMs * session.timeConfig.timeScale;
      
      const startConfig = session.timeConfig.gameStartDate;
      const gameBaseDate = new Date(
        startConfig.year, 
        startConfig.month - 1, 
        startConfig.day, 
        startConfig.hour
      );
      
      session.currentState.gameDate = new Date(gameBaseDate.getTime() + totalElapsedGameMs);
      
      // Emit a catch-up event for agents that need to process missed time
      this.emit(GIN7_EVENTS.CATCHUP, {
        sessionId: session.sessionId,
        missedTicks: ticksToApply,
        currentTick: session.currentState.tick,
        gameDate: session.currentState.gameDate
      });
    }
    // === END CATCH-UP ===
    
    // Initialize day/month tracking from current game date
    const initialDay = session.currentState.gameDate?.getDate() ?? 1;
    const initialMonth = (session.currentState.gameDate?.getMonth() ?? 0) + 1;
    
    this.activeSessions.set(session.sessionId, {
      session,
      accumulatedTicks: 0,
      unsavedChanges: missedTicks > 0, // Mark as dirty if we caught up
      lastGameDay: initialDay,
      lastGameMonth: initialMonth,
    });
  }

  /**
   * Unregister a session (e.g. paused or finished)
   */
  public async unregisterSession(sessionId: string) {
    const state = this.activeSessions.get(sessionId);
    if (state) {
      await state.session.save();
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Core Tick Loop
   */
  private async tick() {
    const now = new Date();
    const socketManager = getSocketManager();

    for (const [sessionId, state] of this.activeSessions) {
      const { session } = state;

      // Check if paused
      if (session.currentState.isPaused) continue;

      // 1. Advance Tick
      session.currentState.tick++;
      state.accumulatedTicks++;
      session.currentState.lastTickTime = now;

      // 2. Calculate Game Date
      // Formula: BaseDate + (Tick * TickRateMs * TimeScale)
      // Example: 1 tick (1s) * 24 (scale) = 24 game seconds elapsed
      const elapsedRealMs = session.currentState.tick * session.timeConfig.tickRateMs;
      const elapsedGameMs = elapsedRealMs * session.timeConfig.timeScale;
      
      // Calculate from GameStartDate
      const startConfig = session.timeConfig.gameStartDate;
      // Construct Javascript Date for the start date (Year, Month-1, Day, Hour)
      // Note: Month is 0-indexed in JS Date, but usually 1-indexed in DB config. Adjust accordingly.
      const gameBaseDate = new Date(
        startConfig.year, 
        startConfig.month - 1, 
        startConfig.day, 
        startConfig.hour
      );
      
      const currentGameDate = new Date(gameBaseDate.getTime() + elapsedGameMs);
      session.currentState.gameDate = currentGameDate;

      state.unsavedChanges = true;

      // 3. Build tick payload
      const currentDay = currentGameDate.getDate();
      const currentMonth = currentGameDate.getMonth() + 1;
      const currentYear = currentGameDate.getFullYear();
      
      const tickPayload: TimeTickPayload = {
        sessionId,
        tick: session.currentState.tick,
        gameDate: {
          tick: session.currentState.tick,
          year: currentYear,
          month: currentMonth,
          day: currentDay,
          hour: currentGameDate.getHours(),
          minute: currentGameDate.getMinutes()
        },
        realtimeSpeed: session.timeConfig.timeScale
      };

      // 4. Emit to Socket.IO (external clients)
      if (socketManager) {
        socketManager.getIO().to(`session:${sessionId}`).emit(GIN7_EVENTS.TIME_TICK, tickPayload);
      }

      // 5. Emit to Internal EventEmitter (internal agents/services)
      this.emit(GIN7_EVENTS.TIME_TICK, tickPayload);
      
      // 6. Check for DAY boundary
      if (currentDay !== state.lastGameDay) {
        const dayPayload: DayStartPayload = {
          sessionId,
          day: currentDay,
          month: currentMonth,
          year: currentYear
        };
        
        if (socketManager) {
          socketManager.getIO().to(`session:${sessionId}`).emit(GIN7_EVENTS.DAY_START, dayPayload);
        }
        this.emit(GIN7_EVENTS.DAY_START, dayPayload);
        
        logger.info(`[TimeEngine] Session ${sessionId}: DAY_START - ${currentYear}/${currentMonth}/${currentDay}`);
        state.lastGameDay = currentDay;
      }
      
      // 7. Check for MONTH boundary
      if (currentMonth !== state.lastGameMonth) {
        const monthPayload: MonthStartPayload = {
          sessionId,
          month: currentMonth,
          year: currentYear
        };
        
        if (socketManager) {
          socketManager.getIO().to(`session:${sessionId}`).emit(GIN7_EVENTS.MONTH_START, monthPayload);
        }
        this.emit(GIN7_EVENTS.MONTH_START, monthPayload);
        
        logger.info(`[TimeEngine] Session ${sessionId}: MONTH_START - ${currentYear}/${currentMonth}`);
        state.lastGameMonth = currentMonth;
      }

      // 8. Periodic DB Sync
      if (state.accumulatedTicks >= this.SYNC_INTERVAL_TICKS) {
        await this.syncSession(sessionId);
        state.accumulatedTicks = 0;
      }
    }
  }
  
  /**
   * Get current status of all active sessions (for API)
   */
  public getStatus(): {
    engineRunning: boolean;
    tickRateMs: number;
    activeSessions: Array<{
      sessionId: string;
      status: string;
      currentTick: number;
      gameDate: GameTime;
      isPaused: boolean;
      timeScale: number;
    }>;
  } {
    const sessions = Array.from(this.activeSessions.entries()).map(([sessionId, state]) => {
      const { session } = state;
      const gameDate = session.currentState.gameDate;
      return {
        sessionId,
        status: session.status,
        currentTick: session.currentState.tick,
        gameDate: {
          tick: session.currentState.tick,
          year: gameDate?.getFullYear() ?? 0,
          month: (gameDate?.getMonth() ?? 0) + 1,
          day: gameDate?.getDate() ?? 1,
          hour: gameDate?.getHours() ?? 0,
          minute: gameDate?.getMinutes() ?? 0,
        },
        isPaused: session.currentState.isPaused,
        timeScale: session.timeConfig.timeScale,
      };
    });
    
    return {
      engineRunning: this.timer !== null,
      tickRateMs: this.TICK_RATE_MS,
      activeSessions: sessions,
    };
  }
  
  /**
   * Get specific session info
   */
  public getSessionInfo(sessionId: string): {
    sessionId: string;
    status: string;
    currentTick: number;
    gameDate: GameTime;
    isPaused: boolean;
    timeScale: number;
    tickRateMs: number;
  } | null {
    const state = this.activeSessions.get(sessionId);
    if (!state) return null;
    
    const { session } = state;
    const gameDate = session.currentState.gameDate;
    
    return {
      sessionId,
      status: session.status,
      currentTick: session.currentState.tick,
      gameDate: {
        tick: session.currentState.tick,
        year: gameDate?.getFullYear() ?? 0,
        month: (gameDate?.getMonth() ?? 0) + 1,
        day: gameDate?.getDate() ?? 1,
        hour: gameDate?.getHours() ?? 0,
        minute: gameDate?.getMinutes() ?? 0,
      },
      isPaused: session.currentState.isPaused,
      timeScale: session.timeConfig.timeScale,
      tickRateMs: session.timeConfig.tickRateMs,
    };
  }

  /**
   * Persist specific session state to DB
   */
  private async syncSession(sessionId: string) {
    const state = this.activeSessions.get(sessionId);
    if (state && state.unsavedChanges) {
      try {
        // Only update specific fields to minimize race conditions
        await Gin7GameSession.updateOne(
          { sessionId },
          { 
            $set: { 
              'currentState.tick': state.session.currentState.tick,
              'currentState.gameDate': state.session.currentState.gameDate,
              'currentState.lastTickTime': state.session.currentState.lastTickTime
            } 
          }
        );
        state.unsavedChanges = false;
      } catch (error) {
        logger.error(`[TimeEngine] Failed to sync session ${sessionId}:`, error);
      }
    }
  }

  private async saveAllSessions() {
    const promises = [];
    for (const sessionId of this.activeSessions.keys()) {
      promises.push(this.syncSession(sessionId));
    }
    await Promise.all(promises);
  }

  /**
   * Force a manual update of the session configuration (e.g. change speed)
   */
  public async updateSessionConfig(sessionId: string, updates: Partial<IGin7GameSession['timeConfig']>) {
    const state = this.activeSessions.get(sessionId);
    if (!state) return;

    // Apply updates
    if (updates.timeScale) state.session.timeConfig.timeScale = updates.timeScale;
    
    // Save immediately
    await state.session.save();
    
    // Notify clients
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`session:${sessionId}`).emit('GIN7:SESSION_UPDATE', {
        sessionId,
        status: state.session.status,
        speedMultiplier: state.session.timeConfig.timeScale,
        isPaused: state.session.currentState.isPaused,
        lastTickTime: state.session.currentState.lastTickTime.getTime()
      });
    }
  }
  
  /**
   * Start a session (change status to running)
   */
  public async startSession(sessionId: string) {
    const state = this.activeSessions.get(sessionId);
    if (!state) {
      // Try loading from DB
      const session = await Gin7GameSession.findOne({ sessionId });
      if (!session) throw new Error(`Session ${sessionId} not found`);
      
      session.status = 'running';
      session.currentState.isPaused = false;
      session.currentState.lastTickTime = new Date();
      await session.save();
      
      this.registerSession(session);
    } else {
      state.session.status = 'running';
      state.session.currentState.isPaused = false;
      await state.session.save();
    }
    
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`session:${sessionId}`).emit(GIN7_EVENTS.SESSION_START, { sessionId });
    }
    this.emit(GIN7_EVENTS.SESSION_START, { sessionId });
    
    logger.info(`[TimeEngine] Session ${sessionId} started`);
  }
  
  /**
   * End a session
   */
  public async endSession(sessionId: string, winnerId?: string, reason?: string) {
    const state = this.activeSessions.get(sessionId);
    if (state) {
      state.session.status = 'finished';
      await state.session.save();
      this.activeSessions.delete(sessionId);
    }
    
    const payload = { sessionId, winnerId, reason };
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`session:${sessionId}`).emit(GIN7_EVENTS.SESSION_END, payload);
    }
    this.emit(GIN7_EVENTS.SESSION_END, payload);
    
    logger.info(`[TimeEngine] Session ${sessionId} ended - Winner: ${winnerId}, Reason: ${reason}`);
  }
  
  /**
   * Pause/Resume a session
   */
  public async togglePause(sessionId: string, pause: boolean) {
    const state = this.activeSessions.get(sessionId);
    if (!state) return;
    
    state.session.currentState.isPaused = pause;
    if (!pause) {
      // Resuming - update lastTickTime to prevent catch-up for pause duration
      state.session.currentState.lastTickTime = new Date();
    }
    await state.session.save();
    
    logger.info(`[TimeEngine] Session ${sessionId} ${pause ? 'paused' : 'resumed'}`);
  }
}

