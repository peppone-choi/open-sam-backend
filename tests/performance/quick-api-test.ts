/**
 * 빠른 API 성능 테스트 (Jest 없이 직접 실행)
 */
import axios from 'axios';

const BASE_URL = 'http://localhost:8080';
const SESSION_ID = 'sangokushi_default';

interface TestResult {
  endpoint: string;
  times: number[];
  avg: number;
  min: number;
  max: number;
  p95: number;
}

async function measureEndpoint(endpoint: string, iterations: number = 10): Promise<TestResult> {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await axios.get(`${BASE_URL}${endpoint}`, { timeout: 5000 });
      times.push(Date.now() - start);
    } catch (e: any) {
      console.log(`  [${endpoint}] 에러: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }
  
  const sorted = [...times].sort((a, b) => a - b);
  return {
    endpoint,
    times,
    avg: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    min: times.length > 0 ? Math.min(...times) : 0,
    max: times.length > 0 ? Math.max(...times) : 0,
    p95: times.length > 0 ? sorted[Math.floor(0.95 * sorted.length)] || sorted[sorted.length - 1] : 0,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   E5: API 성능 테스트');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`대상: ${BASE_URL}\n`);

  const endpoints = [
    { path: '/health', threshold: 50 },
    { path: `/api/game/turn?session_id=${SESSION_ID}`, threshold: 200 },
    { path: `/api/game/cities?session=${SESSION_ID}`, threshold: 200 },
    { path: `/api/game/ranking?session_id=${SESSION_ID}`, threshold: 200 },
    { path: `/api/game/const?sessionId=${SESSION_ID}`, threshold: 150 },
  ];

  const results: (TestResult & { threshold: number; passed: boolean })[] = [];

  for (const ep of endpoints) {
    console.log(`테스트 중: ${ep.path}`);
    const result = await measureEndpoint(ep.path, 15);
    const passed = result.avg < ep.threshold;
    results.push({ ...result, threshold: ep.threshold, passed });
    console.log(`  평균: ${result.avg.toFixed(1)}ms | P95: ${result.p95.toFixed(1)}ms | ${passed ? '✅' : '❌'}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   결과 요약');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('┌────────────────────────────────────────┬─────────┬─────────┬─────────┬────────┬─────────┐');
  console.log('│ Endpoint                               │ Avg(ms) │ Min(ms) │ P95(ms) │ 기준   │ 결과    │');
  console.log('├────────────────────────────────────────┼─────────┼─────────┼─────────┼────────┼─────────┤');

  for (const r of results) {
    const name = r.endpoint.substring(0, 38).padEnd(38);
    const avg = r.avg.toFixed(1).padStart(7);
    const min = r.min.toFixed(1).padStart(7);
    const p95 = r.p95.toFixed(1).padStart(7);
    const threshold = String(r.threshold).padStart(6);
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`│ ${name} │ ${avg} │ ${min} │ ${p95} │ ${threshold} │ ${status} │`);
  }

  console.log('└────────────────────────────────────────┴─────────┴─────────┴─────────┴────────┴─────────┘\n');

  const allPassed = results.every(r => r.passed);
  console.log(allPassed ? '🎉 모든 API 성능 기준 충족!' : '⚠️ 일부 API가 성능 기준 미달');
}

main().catch(console.error);
