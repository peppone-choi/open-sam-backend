import axios from 'axios';
import { logger } from '../../common/logger';

export type Gin7AlertLevel = 'info' | 'warn' | 'error';
export type Gin7AlertCode = 'tick-failure' | 'tick-lag' | 'victory';

export interface Gin7AlertPayload {
  level: Gin7AlertLevel;
  code: Gin7AlertCode;
  message: string;
  sessionId?: string;
  detail?: Record<string, any>;
}

const ALERT_WINDOW_MS = 60_000;
const MAX_ALERTS_PER_WINDOW = Number(process.env.GIN7_ALERT_RATE_LIMIT || 5);
const ALERT_TIMEOUT_MS = Number(process.env.GIN7_ALERT_TIMEOUT_MS || 2000);
const recentAlertTimestamps: number[] = [];

function recordAlertTimestamp(): void {
  const now = Date.now();
  recentAlertTimestamps.push(now);
  while (recentAlertTimestamps.length && now - recentAlertTimestamps[0] > ALERT_WINDOW_MS) {
    recentAlertTimestamps.shift();
  }
}

function isRateLimited(): boolean {
  if (MAX_ALERTS_PER_WINDOW <= 0) {
    return true;
  }
  return recentAlertTimestamps.length >= MAX_ALERTS_PER_WINDOW;
}

export async function emitGin7Alert(payload: Gin7AlertPayload): Promise<void> {
  const logMeta = {
    code: payload.code,
    sessionId: payload.sessionId,
    detail: payload.detail,
  };

  const logMethod = payload.level === 'error' ? 'error' : payload.level === 'warn' ? 'warn' : 'info';
  logger[logMethod](`[GIN7][DAEMON] ${payload.message}`, logMeta);

  recordAlertTimestamp();
  if (isRateLimited()) {
    logger.warn('[GIN7][DAEMON] Alert webhook skipped due to rate limit', {
      code: payload.code,
      sessionId: payload.sessionId,
    });
    return;
  }

  const webhookUrl = process.env.GIN7_ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await axios.post(
      webhookUrl,
      {
        ...payload,
        emittedAt: new Date().toISOString(),
      },
      { timeout: ALERT_TIMEOUT_MS }
    );
  } catch (error: any) {
    logger.error('[GIN7][DAEMON] Alert webhook failed', {
      code: payload.code,
      sessionId: payload.sessionId,
      error: error?.message,
    });
  }
}
