/**
 * Daemon Health Check Server
 * 
 * Runs on a separate port (9090) to provide health status
 * for the daemon processes without interfering with main app
 */

import express, { Express, Request, Response } from 'express';
import { logger } from './common/logger';

interface DaemonHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  session_id: string;
  daemon_type: string;
  schedulers: {
    turn_processor?: SchedulerStatus;
    auction_engine?: SchedulerStatus;
    battle_resolver?: SchedulerStatus;
    npc_command?: SchedulerStatus;
    db_sync?: SchedulerStatus;
    tournament?: SchedulerStatus;
  };
  resources: {
    cpu_usage_percent?: number;
    memory_usage_mb: number;
    memory_limit_mb: number;
    uptime_seconds: number;
  };
}

interface SchedulerStatus {
  status: 'active' | 'inactive' | 'error';
  last_run?: string;
  next_run?: string;
  processed_count?: number;
  error_count?: number;
  queue_length?: number;
  last_sync?: string;
  assigned_count?: number;
}

export class DaemonHealthServer {
  private app: Express;
  private port: number;
  private server: any;
  private schedulerStats: Map<string, SchedulerStatus>;

  constructor(port: number = 9090) {
    this.app = express();
    this.port = port;
    this.schedulerStats = new Map();
    this.setupRoutes();
  }

  private setupRoutes() {
    // Basic health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    });

    // Detailed health status
    this.app.get('/health/detailed', async (_req: Request, res: Response) => {
      const status = await this.getDetailedStatus();
      
      if (status.status === 'unhealthy') {
        res.status(503);
      } else {
        res.status(200);
      }
      
      res.json(status);
    });

    // Liveness probe
    this.app.get('/health/live', (_req: Request, res: Response) => {
      res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Readiness probe
    this.app.get('/health/ready', (_req: Request, res: Response) => {
      const hasActiveSchedulers = Array.from(this.schedulerStats.values())
        .some(s => s.status === 'active');
      
      if (hasActiveSchedulers) {
        res.status(200).json({
          ready: true,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          ready: false,
          reason: 'No active schedulers'
        });
      }
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', (_req: Request, res: Response) => {
      const metrics = this.generatePrometheusMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });
  }

  private async getDetailedStatus(): Promise<DaemonHealthStatus> {
    const memoryUsage = process.memoryUsage();
    
    const status: DaemonHealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      session_id: process.env.SESSION_ID || 'default',
      daemon_type: 'unified',
      schedulers: {
        turn_processor: this.schedulerStats.get('turn_processor'),
        auction_engine: this.schedulerStats.get('auction_engine'),
        battle_resolver: this.schedulerStats.get('battle_resolver'),
        npc_command: this.schedulerStats.get('npc_command'),
        db_sync: this.schedulerStats.get('db_sync'),
        tournament: this.schedulerStats.get('tournament')
      },
      resources: {
        memory_usage_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        memory_limit_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        uptime_seconds: Math.round(process.uptime())
      }
    };

    // Check if any schedulers have errors
    const hasErrors = Array.from(this.schedulerStats.values())
      .some(s => s.status === 'error' || (s.error_count && s.error_count > 5));
    
    if (hasErrors) {
      status.status = 'degraded';
    }

    // Check memory usage
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      status.status = 'degraded';
    }

    return status;
  }

  private generatePrometheusMetrics(): string {
    const lines: string[] = [];
    const sessionId = process.env.SESSION_ID || 'default';
    const namespace = process.env.NAMESPACE || 'opensam';

    // Daemon uptime
    lines.push(`# HELP daemon_uptime_seconds Daemon uptime in seconds`);
    lines.push(`# TYPE daemon_uptime_seconds gauge`);
    lines.push(`daemon_uptime_seconds{session_id="${sessionId}",namespace="${namespace}"} ${process.uptime()}`);

    // Memory metrics
    const mem = process.memoryUsage();
    lines.push(`# HELP daemon_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE daemon_memory_usage_bytes gauge`);
    lines.push(`daemon_memory_usage_bytes{session_id="${sessionId}",namespace="${namespace}",type="heap_used"} ${mem.heapUsed}`);
    lines.push(`daemon_memory_usage_bytes{session_id="${sessionId}",namespace="${namespace}",type="heap_total"} ${mem.heapTotal}`);
    lines.push(`daemon_memory_usage_bytes{session_id="${sessionId}",namespace="${namespace}",type="rss"} ${mem.rss}`);

    // Scheduler status
    this.schedulerStats.forEach((stat, name) => {
      const statusValue = stat.status === 'active' ? 1 : 0;
      lines.push(`daemon_scheduler_active{session_id="${sessionId}",namespace="${namespace}",scheduler="${name}"} ${statusValue}`);
      
      if (stat.error_count !== undefined) {
        lines.push(`daemon_scheduler_errors_total{session_id="${sessionId}",namespace="${namespace}",scheduler="${name}"} ${stat.error_count}`);
      }
      
      if (stat.processed_count !== undefined) {
        lines.push(`daemon_scheduler_processed_total{session_id="${sessionId}",namespace="${namespace}",scheduler="${name}"} ${stat.processed_count}`);
      }
    });

    return lines.join('\n') + '\n';
  }

  /**
   * Update scheduler statistics
   */
  public updateScheduler(name: string, status: Partial<SchedulerStatus>) {
    const current = this.schedulerStats.get(name) || {
      status: 'inactive',
      error_count: 0,
      processed_count: 0
    };
    
    this.schedulerStats.set(name, {
      ...current,
      ...status
    });
  }

  /**
   * Record scheduler execution
   */
  public recordExecution(name: string, success: boolean) {
    const current = this.schedulerStats.get(name) || {
      status: 'active',
      error_count: 0,
      processed_count: 0
    };
    
    if (success) {
      current.processed_count = (current.processed_count || 0) + 1;
      current.last_run = new Date().toISOString();
      current.status = 'active';
    } else {
      current.error_count = (current.error_count || 0) + 1;
      if (current.error_count > 5) {
        current.status = 'error';
      }
    }
    
    this.schedulerStats.set(name, current);
  }

  /**
   * Start the health check server
   */
  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Daemon health check server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the health check server
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Singleton instance
let healthServer: DaemonHealthServer | null = null;

export function getDaemonHealthServer(): DaemonHealthServer {
  if (!healthServer) {
    healthServer = new DaemonHealthServer();
  }
  return healthServer;
}
