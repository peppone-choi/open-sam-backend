// Lightweight in-memory Prometheus-style metrics for command/turn APIs
// No external dependencies; exposed via /metrics/commands

export type CommandRequestType = 'general' | 'nation' | 'processing';

const DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];

type TotalKey = `${CommandRequestType}|${string}|${string}|${string}`; // type|method|status|sessionId
interface HistogramBaseKeyParts {
  type: CommandRequestType;
  method: string;
  sessionId: string;
}

type HistogramBaseKey = `${CommandRequestType}|${string}|${string}`; // type|method|sessionId

// Counters
const commandRequestTotals = new Map<TotalKey, number>();

// Histogram storage (per label set)
const histogramCounts = new Map<HistogramBaseKey, number>();
const histogramSums = new Map<HistogramBaseKey, number>();
const histogramBuckets = new Map<string, number>(); // key: `${baseKey}|${le}`

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatLabels(labels: Record<string, string | undefined>): string {
  const parts = Object.entries(labels)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}="${escapeLabelValue(v as string)}"`);
  return parts.length ? `{${parts.join(',')}}` : '';
}

function makeSessionId(raw?: unknown): string {
  if (!raw) return 'unknown';
  if (typeof raw === 'string') return raw;
  return String(raw);
}

function makeTotalKey(
  type: CommandRequestType,
  method: string,
  status: string,
  sessionId: string,
): TotalKey {
  return `${type}|${method}|${status}|${sessionId}`;
}

function parseTotalKey(key: TotalKey): [CommandRequestType, string, string, string] {
  const [type, method, status, sessionId] = key.split('|') as [CommandRequestType, string, string, string];
  return [type, method, status, sessionId];
}

function makeHistogramBaseKey(parts: HistogramBaseKeyParts): HistogramBaseKey {
  return `${parts.type}|${parts.method}|${parts.sessionId}`;
}

function parseHistogramBaseKey(key: HistogramBaseKey): HistogramBaseKeyParts {
  const [type, method, sessionId] = key.split('|') as [CommandRequestType, string, string];
  return { type, method, sessionId };
}

function makeBucketKey(baseKey: HistogramBaseKey, le: number): string {
  return `${baseKey}|${le}`;
}

/**
 * Record a single command API request for metrics.
 */
export function recordCommandRequest(params: {
  type: CommandRequestType;
  method: string;
  status: number;
  durationSeconds: number;
  sessionId?: unknown;
}): void {
  const type: CommandRequestType = params.type;
  const method = params.method.toUpperCase();
  const status = String(params.status);
  const sessionId = makeSessionId(params.sessionId);
  const durationSeconds = params.durationSeconds >= 0 ? params.durationSeconds : 0;

  // --- Counter ---
  const totalKey = makeTotalKey(type, method, status, sessionId);
  commandRequestTotals.set(totalKey, (commandRequestTotals.get(totalKey) ?? 0) + 1);

  // --- Histogram ---
  const baseKey = makeHistogramBaseKey({ type, method, sessionId });
  histogramCounts.set(baseKey, (histogramCounts.get(baseKey) ?? 0) + 1);
  histogramSums.set(baseKey, (histogramSums.get(baseKey) ?? 0) + durationSeconds);

  for (const bucket of DURATION_BUCKETS) {
    if (durationSeconds <= bucket) {
      const bucketKey = makeBucketKey(baseKey, bucket);
      histogramBuckets.set(bucketKey, (histogramBuckets.get(bucketKey) ?? 0) + 1);
    }
  }
}

/**
 * Render current metrics in Prometheus text exposition format.
 */
export function getCommandMetrics(): string {
  const lines: string[] = [];

  // Counter: command_request_total
  lines.push('# HELP command_request_total Total command-related API requests');
  lines.push('# TYPE command_request_total counter');

  for (const [key, value] of commandRequestTotals.entries()) {
    const [type, method, status, sessionId] = parseTotalKey(key);
    const labels = formatLabels({ type, method, status, session_id: sessionId });
    lines.push(`command_request_total${labels} ${value}`);
  }

  // Histogram: command_request_duration_seconds
  lines.push('# HELP command_request_duration_seconds Command API request duration in seconds');
  lines.push('# TYPE command_request_duration_seconds histogram');

  for (const [baseKey, count] of histogramCounts.entries()) {
    const { type, method, sessionId } = parseHistogramBaseKey(baseKey);
    const sum = histogramSums.get(baseKey) ?? 0;

    for (const bucket of DURATION_BUCKETS) {
      const bucketKey = makeBucketKey(baseKey, bucket);
      const bucketCount = histogramBuckets.get(bucketKey) ?? 0;
      const labels = formatLabels({
        type,
        method,
        session_id: sessionId,
        le: bucket.toString(),
      });
      lines.push(`command_request_duration_seconds_bucket${labels} ${bucketCount}`);
    }

    // +Inf bucket = total count for this label set
    const infLabels = formatLabels({
      type,
      method,
      session_id: sessionId,
      le: '+Inf',
    });
    lines.push(`command_request_duration_seconds_bucket${infLabels} ${count}`);

    const baseLabels = formatLabels({ type, method, session_id: sessionId });
    lines.push(`command_request_duration_seconds_sum${baseLabels} ${sum}`);
    lines.push(`command_request_duration_seconds_count${baseLabels} ${count}`);
  }

  return lines.join('\n') + '\n';
}
