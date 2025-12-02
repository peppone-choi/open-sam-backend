/**
 * E5: API 성능 테스트
 * 
 * 목표:
 * - API 응답 시간 <200ms
 * - 병목 지점 파악
 * 
 * 실행: npx jest tests/performance/api-performance.test.ts --testTimeout=60000
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:8080';
const SESSION_ID = process.env.SESSION_ID || 'sangokushi_default';

// 성능 기준 (ms)
const PERFORMANCE_THRESHOLDS = {
  health: 50,           // 헬스체크: 50ms
  healthDetailed: 100,  // 상세 헬스체크: 100ms
  turn: 200,            // 턴 정보: 200ms
  cities: 200,          // 도시 목록: 200ms
  ranking: 200,         // 랭킹: 200ms
  sessionConfig: 200,   // 세션 설정: 200ms
  gameConst: 150,       // 게임 상수: 150ms
};

interface PerformanceResult {
  endpoint: string;
  method: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  successRate: number;
  threshold: number;
  passed: boolean;
  iterations: number;
  errors: string[];
}

class PerformanceTimer {
  private times: number[] = [];
  private errors: string[] = [];

  record(time: number): void {
    this.times.push(time);
  }

  recordError(error: string): void {
    this.errors.push(error);
  }

  get avg(): number {
    if (this.times.length === 0) return 0;
    return this.times.reduce((a, b) => a + b, 0) / this.times.length;
  }

  get min(): number {
    if (this.times.length === 0) return 0;
    return Math.min(...this.times);
  }

  get max(): number {
    if (this.times.length === 0) return 0;
    return Math.max(...this.times);
  }

  getPercentile(p: number): number {
    if (this.times.length === 0) return 0;
    const sorted = [...this.times].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  get p95(): number {
    return this.getPercentile(95);
  }

  get p99(): number {
    return this.getPercentile(99);
  }

  get successRate(): number {
    const total = this.times.length + this.errors.length;
    if (total === 0) return 0;
    return (this.times.length / total) * 100;
  }

  get allErrors(): string[] {
    return this.errors;
  }

  get count(): number {
    return this.times.length;
  }
}

async function measureApiCall(
  client: AxiosInstance,
  method: 'get' | 'post',
  endpoint: string,
  data?: any,
  iterations: number = 10
): Promise<PerformanceTimer> {
  const timer = new PerformanceTimer();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      if (method === 'get') {
        await client.get(endpoint);
      } else {
        await client.post(endpoint, data);
      }
      timer.record(performance.now() - start);
    } catch (error: any) {
      timer.recordError(error.message || 'Unknown error');
    }
    // 요청 간 짧은 간격
    await new Promise(r => setTimeout(r, 50));
  }

  return timer;
}

describe('E5: API 성능 테스트', () => {
  let client: AxiosInstance;
  const results: PerformanceResult[] = [];

  beforeAll(async () => {
    client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      validateStatus: () => true, // 모든 상태 코드 허용
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   E5: API 성능 테스트 시작');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   대상 서버: ${BASE_URL}`);
    console.log(`   세션 ID: ${SESSION_ID}`);
    console.log('───────────────────────────────────────────────────────\n');
  });

  afterAll(() => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   API 성능 테스트 결과 요약');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('┌───────────────────────────────┬─────────┬─────────┬─────────┬─────────┬────────┬─────────┐');
    console.log('│ Endpoint                      │ Avg(ms) │ Min(ms) │ Max(ms) │ P95(ms) │ 기준   │ 결과    │');
    console.log('├───────────────────────────────┼─────────┼─────────┼─────────┼─────────┼────────┼─────────┤');

    for (const result of results) {
      const name = result.endpoint.padEnd(29);
      const avg = result.avgTime.toFixed(1).padStart(7);
      const min = result.minTime.toFixed(1).padStart(7);
      const max = result.maxTime.toFixed(1).padStart(7);
      const p95 = result.p95Time.toFixed(1).padStart(7);
      const threshold = String(result.threshold).padStart(6);
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`│ ${name} │ ${avg} │ ${min} │ ${max} │ ${p95} │ ${threshold} │ ${status} │`);
    }

    console.log('└───────────────────────────────┴─────────┴─────────┴─────────┴─────────┴────────┴─────────┘\n');

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const overallPass = passedCount === totalCount;

    console.log(`총 ${totalCount}개 중 ${passedCount}개 통과`);
    console.log(overallPass ? '🎉 모든 API 성능 기준 충족!' : '⚠️ 일부 API가 성능 기준 미달');
    console.log('');
  });

  test('Phase 1.1: 헬스체크 응답 시간', async () => {
    const timer = await measureApiCall(client, 'get', '/health', undefined, 20);

    const result: PerformanceResult = {
      endpoint: '/health',
      method: 'GET',
      avgTime: timer.avg,
      minTime: timer.min,
      maxTime: timer.max,
      p95Time: timer.p95,
      p99Time: timer.p99,
      successRate: timer.successRate,
      threshold: PERFORMANCE_THRESHOLDS.health,
      passed: timer.avg < PERFORMANCE_THRESHOLDS.health,
      iterations: timer.count,
      errors: timer.allErrors,
    };
    results.push(result);

    console.log(`[/health] 평균: ${timer.avg.toFixed(2)}ms, P95: ${timer.p95.toFixed(2)}ms, 성공률: ${timer.successRate.toFixed(1)}%`);
    expect(timer.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.health);
  });

  test('Phase 1.2: 상세 헬스체크 응답 시간', async () => {
    const timer = await measureApiCall(client, 'get', '/health/detailed', undefined, 10);

    const result: PerformanceResult = {
      endpoint: '/health/detailed',
      method: 'GET',
      avgTime: timer.avg,
      minTime: timer.min,
      maxTime: timer.max,
      p95Time: timer.p95,
      p99Time: timer.p99,
      successRate: timer.successRate,
      threshold: PERFORMANCE_THRESHOLDS.healthDetailed,
      passed: timer.avg < PERFORMANCE_THRESHOLDS.healthDetailed,
      iterations: timer.count,
      errors: timer.allErrors,
    };
    results.push(result);

    console.log(`[/health/detailed] 평균: ${timer.avg.toFixed(2)}ms, P95: ${timer.p95.toFixed(2)}ms`);
    expect(timer.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.healthDetailed);
  });

  test('Phase 1.3: 턴 정보 조회 응답 시간', async () => {
    const timer = await measureApiCall(client, 'get', `/api/game/turn?session_id=${SESSION_ID}`, undefined, 15);

    const result: PerformanceResult = {
      endpoint: '/api/game/turn',
      method: 'GET',
      avgTime: timer.avg,
      minTime: timer.min,
      maxTime: timer.max,
      p95Time: timer.p95,
      p99Time: timer.p99,
      successRate: timer.successRate,
      threshold: PERFORMANCE_THRESHOLDS.turn,
      passed: timer.avg < PERFORMANCE_THRESHOLDS.turn,
      iterations: timer.count,
      errors: timer.allErrors,
    };
    results.push(result);

    console.log(`[/api/game/turn] 평균: ${timer.avg.toFixed(2)}ms, P95: ${timer.p95.toFixed(2)}ms`);
    expect(timer.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.turn);
  });

  test('Phase 1.4: 도시 목록 조회 응답 시간', async () => {
    const timer = await measureApiCall(client, 'get', `/api/game/cities?session=${SESSION_ID}`, undefined, 10);

    const result: PerformanceResult = {
      endpoint: '/api/game/cities',
      method: 'GET',
      avgTime: timer.avg,
      minTime: timer.min,
      maxTime: timer.max,
      p95Time: timer.p95,
      p99Time: timer.p99,
      successRate: timer.successRate,
      threshold: PERFORMANCE_THRESHOLDS.cities,
      passed: timer.avg < PERFORMANCE_THRESHOLDS.cities,
      iterations: timer.count,
      errors: timer.allErrors,
    };
    results.push(result);

    console.log(`[/api/game/cities] 평균: ${timer.avg.toFixed(2)}ms, P95: ${timer.p95.toFixed(2)}ms`);
    expect(timer.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.cities);
  });

  test('Phase 1.5: 랭킹 조회 응답 시간', async () => {
    const timer = await measureApiCall(client, 'get', `/api/game/ranking?session_id=${SESSION_ID}`, undefined, 10);

    const result: PerformanceResult = {
      endpoint: '/api/game/ranking',
      method: 'GET',
      avgTime: timer.avg,
      minTime: timer.min,
      maxTime: timer.max,
      p95Time: timer.p95,
      p99Time: timer.p99,
      successRate: timer.successRate,
      threshold: PERFORMANCE_THRESHOLDS.ranking,
      passed: timer.avg < PERFORMANCE_THRESHOLDS.ranking,
      iterations: timer.count,
      errors: timer.allErrors,
    };
    results.push(result);

    console.log(`[/api/game/ranking] 평균: ${timer.avg.toFixed(2)}ms, P95: ${timer.p95.toFixed(2)}ms`);
    expect(timer.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.ranking);
  });

  test('Phase 1.6: 세션 설정 조회 응답 시간', async () => {
    const timer = await measureApiCall(client, 'get', `/api/game/session/${SESSION_ID}/config`, undefined, 10);

    const result: PerformanceResult = {
      endpoint: `/api/game/session/config`,
      method: 'GET',
      avgTime: timer.avg,
      minTime: timer.min,
      maxTime: timer.max,
      p95Time: timer.p95,
      p99Time: timer.p99,
      successRate: timer.successRate,
      threshold: PERFORMANCE_THRESHOLDS.sessionConfig,
      passed: timer.avg < PERFORMANCE_THRESHOLDS.sessionConfig,
      iterations: timer.count,
      errors: timer.allErrors,
    };
    results.push(result);

    console.log(`[/api/game/session/config] 평균: ${timer.avg.toFixed(2)}ms, P95: ${timer.p95.toFixed(2)}ms`);
    expect(timer.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.sessionConfig);
  });

  test('Phase 1.7: 게임 상수 조회 응답 시간', async () => {
    const timer = await measureApiCall(client, 'get', `/api/game/const?sessionId=${SESSION_ID}`, undefined, 10);

    const result: PerformanceResult = {
      endpoint: '/api/game/const',
      method: 'GET',
      avgTime: timer.avg,
      minTime: timer.min,
      maxTime: timer.max,
      p95Time: timer.p95,
      p99Time: timer.p99,
      successRate: timer.successRate,
      threshold: PERFORMANCE_THRESHOLDS.gameConst,
      passed: timer.avg < PERFORMANCE_THRESHOLDS.gameConst,
      iterations: timer.count,
      errors: timer.allErrors,
    };
    results.push(result);

    console.log(`[/api/game/const] 평균: ${timer.avg.toFixed(2)}ms, P95: ${timer.p95.toFixed(2)}ms`);
    expect(timer.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.gameConst);
  });
});


