/**
 * BattleLogService
 * 
 * Logging and replay system for realtime fleet battles
 * Stores tick states and events for analysis and replay
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import zlib from 'zlib';
import { promisify } from 'util';
import { BattleStateSnapshot, BattleEvent } from './RealtimeBattleEngine';
import { IVector3 } from '../../../models/gin7/Fleet';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Log entry types
 */
export type BattleLogType = 
  | 'TICK_STATE'
  | 'DAMAGE'
  | 'DESTRUCTION'
  | 'COMMAND'
  | 'FORMATION'
  | 'RETREAT'
  | 'COLLISION'
  | 'TARGET_CHANGE';

/**
 * Single log entry
 */
export interface IBattleLogEntry {
  type: BattleLogType;
  tick: number;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Battle log document
 */
export interface IBattleLog extends Document {
  battleId: string;
  sessionId: string;
  createdAt: Date;
  endedAt?: Date;
  
  // Compressed log data
  compressedLogs: Buffer;
  logCount: number;
  
  // Metadata
  participantCount: number;
  totalTicks: number;
  winner?: string;
  
  // TTL index for automatic deletion
  expiresAt: Date;
}

// Schema
const BattleLogSchema = new Schema<IBattleLog>({
  battleId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  compressedLogs: { type: Buffer, required: true },
  logCount: { type: Number, default: 0 },
  participantCount: { type: Number, default: 0 },
  totalTicks: { type: Number, default: 0 },
  winner: { type: String },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }  // 30 days
}, {
  timestamps: false
});

// TTL index - automatically delete old logs
BattleLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BattleLog: Model<IBattleLog> = 
  mongoose.models.BattleLog || mongoose.model<IBattleLog>('BattleLog', BattleLogSchema);

/**
 * Replay frame
 */
export interface ReplayFrame {
  tick: number;
  timestamp: number;
  fleets: Array<{
    fleetId: string;
    factionId: string;
    name: string;
    position: IVector3;
    heading: number;
    hp: number;
    ships: number;
    isDefeated: boolean;
  }>;
  events: BattleEvent[];
}

/**
 * Replay data
 */
export interface ReplayData {
  battleId: string;
  sessionId: string;
  totalTicks: number;
  tickRate: number;
  duration: number;  // seconds
  winner?: string;
  participants: Array<{
    fleetId: string;
    factionId: string;
    name: string;
    initialPosition: IVector3;
  }>;
  frames: ReplayFrame[];
  summary: {
    totalDamage: number;
    shipsDestroyed: number;
    fleetResults: Array<{
      fleetId: string;
      damageDealt: number;
      damageTaken: number;
      shipsLost: number;
      survived: boolean;
    }>;
  };
}

/**
 * BattleLogService class
 */
export class BattleLogService {
  private battleId: string;
  private sessionId: string;
  private logs: IBattleLogEntry[] = [];
  private stateSnapshots: Map<number, BattleStateSnapshot> = new Map();  // tick -> snapshot
  private snapshotInterval: number = 10;  // Save full state every N ticks
  private maxLogsInMemory: number = 1000;
  private isFlushing: boolean = false;

  constructor(battleId: string, sessionId: string, options?: {
    snapshotInterval?: number;
    maxLogsInMemory?: number;
  }) {
    this.battleId = battleId;
    this.sessionId = sessionId;
    this.snapshotInterval = options?.snapshotInterval ?? 10;
    this.maxLogsInMemory = options?.maxLogsInMemory ?? 1000;
  }

  /**
   * Log tick state (called every snapshotInterval ticks)
   */
  logTickState(tick: number, state: BattleStateSnapshot): void {
    // Store full snapshot at intervals
    if (tick % this.snapshotInterval === 0) {
      this.stateSnapshots.set(tick, state);
    }
    
    // Log minimal state data
    this.addLog('TICK_STATE', tick, {
      fleetCount: state.fleets.length,
      activeCount: state.fleets.filter(f => !f.isDefeated).length
    });
  }

  /**
   * Log an event
   */
  logEvent(tick: number, type: BattleLogType, data: Record<string, unknown>): void {
    this.addLog(type, tick, data);
  }

  /**
   * Log damage event
   */
  logDamage(
    tick: number,
    attackerId: string,
    targetId: string,
    damage: number,
    targetHp: number,
    targetShips: number
  ): void {
    this.addLog('DAMAGE', tick, {
      attackerId,
      targetId,
      damage,
      targetHp,
      targetShips
    });
  }

  /**
   * Log destruction event
   */
  logDestruction(tick: number, fleetId: string, destroyedBy: string): void {
    this.addLog('DESTRUCTION', tick, {
      fleetId,
      destroyedBy
    });
  }

  /**
   * Log command event
   */
  logCommand(
    tick: number,
    fleetId: string,
    commandType: string,
    commandData: Record<string, unknown>
  ): void {
    this.addLog('COMMAND', tick, {
      fleetId,
      commandType,
      ...commandData
    });
  }

  /**
   * Log formation change
   */
  logFormationChange(tick: number, fleetId: string, formation: string): void {
    this.addLog('FORMATION', tick, { fleetId, formation });
  }

  /**
   * Log retreat
   */
  logRetreat(tick: number, fleetId: string, completed: boolean): void {
    this.addLog('RETREAT', tick, { fleetId, completed });
  }

  /**
   * Add log entry
   */
  private addLog(type: BattleLogType, tick: number, data: Record<string, unknown>): void {
    this.logs.push({
      type,
      tick,
      timestamp: Date.now(),
      data
    });
    
    // Flush if too many logs in memory
    if (this.logs.length >= this.maxLogsInMemory && !this.isFlushing) {
      this.flush().catch(err => console.error('[BattleLog] Flush error:', err));
    }
  }

  /**
   * Flush logs to database
   */
  async flush(): Promise<void> {
    if (this.logs.length === 0 || this.isFlushing) return;
    
    this.isFlushing = true;
    
    try {
      const logsToSave = [...this.logs];
      this.logs = [];
      
      // Compress logs
      const jsonData = JSON.stringify(logsToSave);
      const compressed = await gzip(Buffer.from(jsonData));
      
      // Find existing log or create new
      let battleLog = await BattleLog.findOne({ battleId: this.battleId });
      
      if (battleLog) {
        // Append to existing (decompress, merge, recompress)
        const existingData = await gunzip(battleLog.compressedLogs);
        const existingLogs: IBattleLogEntry[] = JSON.parse(existingData.toString());
        const mergedLogs = [...existingLogs, ...logsToSave];
        const newCompressed = await gzip(Buffer.from(JSON.stringify(mergedLogs)));
        
        battleLog.compressedLogs = newCompressed;
        battleLog.logCount = mergedLogs.length;
        await battleLog.save();
      } else {
        // Create new
        battleLog = new BattleLog({
          battleId: this.battleId,
          sessionId: this.sessionId,
          compressedLogs: compressed,
          logCount: logsToSave.length
        });
        await battleLog.save();
      }
    } catch (error) {
      console.error('[BattleLog] Failed to flush logs:', error);
      // Put logs back (they weren't saved)
      // Note: This could cause duplicates in edge cases
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Finalize battle log
   */
  async finalize(winner?: string, totalTicks?: number, participantCount?: number): Promise<void> {
    await this.flush();
    
    await BattleLog.updateOne(
      { battleId: this.battleId },
      {
        $set: {
          endedAt: new Date(),
          winner,
          totalTicks,
          participantCount
        }
      }
    );
  }

  /**
   * Get all logs for battle
   */
  async getBattleLogs(): Promise<IBattleLogEntry[]> {
    const battleLog = await BattleLog.findOne({ battleId: this.battleId });
    if (!battleLog) return [];
    
    try {
      const decompressed = await gunzip(battleLog.compressedLogs);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.error('[BattleLog] Failed to decompress logs:', error);
      return [];
    }
  }

  /**
   * Generate replay data
   */
  async generateReplay(tickRate: number = 10): Promise<ReplayData | null> {
    const battleLog = await BattleLog.findOne({ battleId: this.battleId });
    if (!battleLog) return null;
    
    const logs = await this.getBattleLogs();
    if (logs.length === 0) return null;
    
    // Build frames from snapshots and logs
    const frames: ReplayFrame[] = [];
    const damageLogs = logs.filter(l => l.type === 'DAMAGE');
    const destructionLogs = logs.filter(l => l.type === 'DESTRUCTION');
    
    // Group events by tick
    const eventsByTick = new Map<number, BattleEvent[]>();
    for (const log of logs) {
      if (log.type !== 'TICK_STATE') {
        const events = eventsByTick.get(log.tick) || [];
        events.push({
          type: log.type as any,
          tick: log.tick,
          data: log.data
        });
        eventsByTick.set(log.tick, events);
      }
    }
    
    // Create frames from snapshots
    for (const [tick, snapshot] of this.stateSnapshots) {
      frames.push({
        tick,
        timestamp: snapshot.timestamp,
        fleets: snapshot.fleets.map(f => ({
          fleetId: f.fleetId,
          factionId: f.factionId,
          name: f.name,
          position: f.position,
          heading: f.heading,
          hp: f.hp,
          ships: f.ships,
          isDefeated: f.isDefeated
        })),
        events: eventsByTick.get(tick) || []
      });
    }
    
    // Sort frames by tick
    frames.sort((a, b) => a.tick - b.tick);
    
    // Calculate summary
    const fleetResults = new Map<string, {
      damageDealt: number;
      damageTaken: number;
      shipsLost: number;
      survived: boolean;
    }>();
    
    // Initialize from first snapshot
    const firstSnapshot = this.stateSnapshots.get(0);
    if (firstSnapshot) {
      for (const fleet of firstSnapshot.fleets) {
        fleetResults.set(fleet.fleetId, {
          damageDealt: 0,
          damageTaken: 0,
          shipsLost: 0,
          survived: true
        });
      }
    }
    
    // Process damage logs
    let totalDamage = 0;
    let shipsDestroyed = 0;
    
    for (const log of damageLogs) {
      const damage = log.data.damage as number;
      totalDamage += damage;
      
      const attackerResult = fleetResults.get(log.data.attackerId as string);
      if (attackerResult) {
        attackerResult.damageDealt += damage;
      }
      
      const targetResult = fleetResults.get(log.data.targetId as string);
      if (targetResult) {
        targetResult.damageTaken += damage;
      }
    }
    
    // Process destruction logs
    for (const log of destructionLogs) {
      shipsDestroyed++;
      const result = fleetResults.get(log.data.fleetId as string);
      if (result) {
        result.survived = false;
      }
    }
    
    // Build participants list
    const participants: ReplayData['participants'] = [];
    if (firstSnapshot) {
      for (const fleet of firstSnapshot.fleets) {
        participants.push({
          fleetId: fleet.fleetId,
          factionId: fleet.factionId,
          name: fleet.name,
          initialPosition: fleet.position
        });
      }
    }
    
    return {
      battleId: this.battleId,
      sessionId: this.sessionId,
      totalTicks: battleLog.totalTicks,
      tickRate,
      duration: battleLog.totalTicks / tickRate,
      winner: battleLog.winner,
      participants,
      frames,
      summary: {
        totalDamage,
        shipsDestroyed,
        fleetResults: Array.from(fleetResults.entries()).map(([fleetId, result]) => ({
          fleetId,
          ...result
        }))
      }
    };
  }

  /**
   * Get snapshot at tick (or nearest available)
   */
  getSnapshotAtTick(tick: number): BattleStateSnapshot | null {
    // Find nearest snapshot at or before requested tick
    let nearestTick = -1;
    for (const snapshotTick of this.stateSnapshots.keys()) {
      if (snapshotTick <= tick && snapshotTick > nearestTick) {
        nearestTick = snapshotTick;
      }
    }
    
    return nearestTick >= 0 ? this.stateSnapshots.get(nearestTick) || null : null;
  }

  /**
   * Get stored snapshot directly
   */
  getStoredSnapshot(tick: number): BattleStateSnapshot | undefined {
    return this.stateSnapshots.get(tick);
  }

  /**
   * Store a snapshot (for external use)
   */
  storeSnapshot(tick: number, snapshot: BattleStateSnapshot): void {
    this.stateSnapshots.set(tick, snapshot);
  }

  /**
   * Get log count
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Get snapshot count
   */
  getSnapshotCount(): number {
    return this.stateSnapshots.size;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.logs = [];
    this.stateSnapshots.clear();
  }

  /**
   * Static: Load replay for a battle
   */
  static async loadReplay(battleId: string): Promise<ReplayData | null> {
    const battleLog = await BattleLog.findOne({ battleId });
    if (!battleLog) return null;
    
    // Create temporary service to generate replay
    const service = new BattleLogService(battleId, battleLog.sessionId);
    return service.generateReplay();
  }

  /**
   * Static: Delete old logs
   */
  static async cleanupOldLogs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await BattleLog.deleteMany({ createdAt: { $lt: cutoffDate } });
    return result.deletedCount;
  }
}

export default BattleLogService;
