import { Router, Request, Response } from 'express';
import { mongoConnection } from '../db/connection';
import { RedisService } from '../infrastructure/queue/redis.service';
import { logger } from '../common/logger';

const router = Router();

/**
 * Health Check Endpoints
 * 
 * These endpoints provide detailed health status for monitoring systems
 * and orchestration platforms (Kubernetes, Docker Swarm, etc.)
 */

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
  session_id?: string;
  namespace?: string;
  checks: {
    mongodb?: { status: string; latency_ms?: number; error?: string };
    redis?: { status: string; latency_ms?: number; error?: string };
    turn_processor?: { status: string; last_run?: string };
    daemon?: { status: string; uptime_seconds?: number };
  };
  metrics?: {
    active_sessions?: number;
    turn_queue_length?: number;
    battle_active?: number;
    socket_connections?: number;
  };
}

/**
 * Basic health check - used by load balancers
 * Returns 200 if service is running
 */
router.get('/health', async (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

/**
 * Detailed health check - used by monitoring systems
 * Checks all dependencies and returns comprehensive status
 */
router.get('/health/detailed', async (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.GIT_SHA || '1.0.0',
    session_id: process.env.SESSION_ID,
    namespace: process.env.NAMESPACE,
    checks: {}
  };

  let hasWarnings = false;
  let hasCriticalErrors = false;

  // Check MongoDB
  try {
    const startMongo = Date.now();
    const mongoose = mongoConnection.getConnection();
    if (mongoose && mongoose.readyState === 1) {
      const latency = Date.now() - startMongo;
      response.checks.mongodb = { 
        status: 'up', 
        latency_ms: latency 
      };
      
      if (latency > 100) {
        hasWarnings = true;
      }
    } else {
      response.checks.mongodb = { 
        status: 'down', 
        error: 'Not connected' 
      };
      hasCriticalErrors = true;
    }
  } catch (error) {
    response.checks.mongodb = { 
      status: 'down', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    hasCriticalErrors = true;
  }

  // Check Redis
  try {
    const startRedis = Date.now();
    const redis = RedisService.getClient();
    await redis.ping();
    const latency = Date.now() - startRedis;
    
    response.checks.redis = { 
      status: 'up', 
      latency_ms: latency 
    };
    
    if (latency > 50) {
      hasWarnings = true;
    }
  } catch (error) {
    response.checks.redis = { 
      status: 'down', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    hasCriticalErrors = true;
  }

  // Check Turn Processor (if daemon is running)
  try {
    const redis = RedisService.getClient();
    const lastTurnKey = `${process.env.NAMESPACE || 'opensam'}:last_turn_processed`;
    const lastTurn = await redis.get(lastTurnKey);
    
    if (lastTurn) {
      response.checks.turn_processor = {
        status: 'active',
        last_run: lastTurn
      };
      
      // Check if last turn was more than 5 minutes ago
      const lastTurnTime = new Date(lastTurn).getTime();
      const now = Date.now();
      if (now - lastTurnTime > 5 * 60 * 1000) {
        hasWarnings = true;
        response.checks.turn_processor.status = 'delayed';
      }
    } else {
      response.checks.turn_processor = {
        status: 'unknown'
      };
    }
  } catch (error) {
    // Turn processor check is optional
    logger.debug('Turn processor health check failed', { error });
  }

  // Add metrics
  try {
    const { Session } = await import('../models/session.model');
    const activeSessions = await Session.countDocuments({ 
      'data.isunited': { $nin: [2, 3] } 
    });
    
    response.metrics = {
      active_sessions: activeSessions
    };
  } catch (error) {
    logger.warn('Failed to fetch metrics for health check', { error });
  }

  // Determine overall status
  if (hasCriticalErrors) {
    response.status = 'unhealthy';
    res.status(503);
  } else if (hasWarnings) {
    response.status = 'degraded';
    res.status(200);
  } else {
    response.status = 'healthy';
    res.status(200);
  }

  res.json(response);
});

/**
 * Database connectivity check
 */
router.get('/health/db', async (_req: Request, res: Response) => {
  try {
    const mongoose = mongoConnection.getConnection();
    if (!mongoose || mongoose.readyState !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'MongoDB not connected',
        readyState: mongoose?.readyState
      });
    }

    // Perform a simple query to verify connection
    const { Session } = await import('../models/session.model');
    await Session.findOne().limit(1).lean();

    res.status(200).json({
      status: 'healthy',
      message: 'Database is accessible',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Database query failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Redis connectivity check
 */
router.get('/health/redis', async (_req: Request, res: Response) => {
  try {
    const redis = RedisService.getClient();
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    res.status(200).json({
      status: 'healthy',
      message: 'Redis is accessible',
      latency_ms: latency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Redis ping failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Readiness probe - checks if service is ready to accept traffic
 * Used by Kubernetes to determine if pod should receive requests
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    // Check if all critical dependencies are available
    const mongoose = mongoConnection.getConnection();
    const redis = RedisService.getClient();
    
    if (!mongoose || mongoose.readyState !== 1) {
      return res.status(503).json({
        ready: false,
        reason: 'MongoDB not ready'
      });
    }

    await redis.ping();

    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error instanceof Error ? error.message : 'Dependencies not ready'
    });
  }
});

/**
 * Liveness probe - checks if service is alive
 * Used by Kubernetes to determine if pod should be restarted
 */
router.get('/health/live', (_req: Request, res: Response) => {
  // Simple check - if we can respond, we're alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
