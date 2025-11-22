import { logger } from '../../common/logger';

export type RedisStatus = 'unknown' | 'connected' | 'disconnected' | 'degraded' | 'reconnecting';

export interface RedisHealthEvent {
  type: RedisStatus | 'delay';
  timestamp: string;
  detail?: string;
  latencyMs?: number;
}

class RedisHealthMonitor {
  private static instance: RedisHealthMonitor;

  private events: RedisHealthEvent[] = [];
  private lastStatus: RedisStatus = 'unknown';
  private lastLatencyMs: number | null = null;
  private lastTransitionAt: number | null = null;

  static getInstance(): RedisHealthMonitor {
    if (!RedisHealthMonitor.instance) {
      RedisHealthMonitor.instance = new RedisHealthMonitor();
    }
    return RedisHealthMonitor.instance;
  }

  recordConnected(source: string): void {
    this.lastStatus = 'connected';
    this.lastTransitionAt = Date.now();
    this.pushEvent({ type: 'connected', timestamp: this.now(), detail: source });
    logger.info('[RedisMonitor] Redis connection restored', { source });
  }

  recordDisconnected(source: string, reason?: string): void {
    this.lastStatus = 'disconnected';
    this.lastTransitionAt = Date.now();
    this.pushEvent({ type: 'disconnected', timestamp: this.now(), detail: reason || source });
    logger.warn('[RedisMonitor] Redis connection lost', { source, reason });
  }

  recordReconnecting(source: string): void {
    this.lastStatus = 'reconnecting';
    this.pushEvent({ type: 'reconnecting', timestamp: this.now(), detail: source });
    logger.warn('[RedisMonitor] Redis reconnecting', { source });
  }

  recordDelay(latencyMs: number, context: string): void {
    this.lastStatus = 'degraded';
    this.lastLatencyMs = latencyMs;
    this.lastTransitionAt = Date.now();
    this.pushEvent({ type: 'delay', timestamp: this.now(), detail: context, latencyMs });
    logger.warn('[RedisMonitor] Redis latency detected', { context, latencyMs });
  }

  snapshot() {
    return {
      status: this.lastStatus,
      lastLatencyMs: this.lastLatencyMs,
      lastTransitionAt: this.lastTransitionAt ? new Date(this.lastTransitionAt).toISOString() : null,
      recentEvents: [...this.events],
    };
  }

  resetForTests(): void {
    if (process.env.NODE_ENV !== 'test') {
      return;
    }
    this.events = [];
    this.lastStatus = 'unknown';
    this.lastLatencyMs = null;
    this.lastTransitionAt = null;
  }

  private pushEvent(event: RedisHealthEvent): void {
    this.events.push(event);
    if (this.events.length > 25) {
      this.events.shift();
    }
  }

  private now(): string {
    return new Date().toISOString();
  }
}

export const redisHealthMonitor = RedisHealthMonitor.getInstance();
