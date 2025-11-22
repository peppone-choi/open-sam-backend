import { getWebSocketHandler } from './WebSocketHandler.service';

const notifiedContracts = new Set<string>();

interface ApiChangePayload {
  endpoint: string;
  change: string;
  qaEntryId: string;
  schemaVersion?: string;
}

export function notifyApiContractChange(
  sessionId: string,
  payload: ApiChangePayload
): void {
  const handler = getWebSocketHandler();
  if (!handler) {
    return;
  }

  const key = `${sessionId}:${payload.endpoint}:${payload.qaEntryId}`;
  if (notifiedContracts.has(key)) {
    return;
  }

  notifiedContracts.add(key);
  handler.emitGalaxyEvent(sessionId, 'galaxy:api-change', {
    ...payload,
    timestamp: Date.now(),
  });
}

export function notifyQaLogUpdate(
  sessionId: string,
  data: { section: string; status: 'pass' | 'fail' | 'needs-review'; note?: string }
): void {
  const handler = getWebSocketHandler();
  if (!handler) {
    return;
  }

  handler.emitGalaxyEvent(sessionId, 'galaxy:qa-log', {
    ...data,
    timestamp: Date.now(),
  });
}
