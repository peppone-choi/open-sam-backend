/**
 * E5: 부하 테스트 (autocannon)
 * 
 * 목표:
 * - 동시 접속 100명: 기본 성능 확인
 * - 동시 접속 500명: 중간 부하 테스트
 * - 동시 접속 1000명: 고부하 테스트
 * 
 * 실행: npx ts-node tests/performance/load-test.ts
 * 
 * 필요: npm install autocannon --save-dev
 */

interface LoadTestResult {
  scenario: string;
  connections: number;
  duration: number;
  requests: {
    total: number;
    average: number;
    min: number;
    max: number;
    p99: number;
  };
  latency: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    average: number;
    total: number;
  };
  errors: number;
  timeouts: number;
  status: 'PASS' | 'FAIL';
}

const BASE_URL = process.env.API_URL || 'http://localhost:8080';

// 성능 기준
const THRESHOLDS = {
  100: { avgLatency: 100, p99Latency: 500, errorRate: 0.01 },    // 100명: 100ms 이하, 1% 이하 에러
  500: { avgLatency: 200, p99Latency: 1000, errorRate: 0.05 },   // 500명: 200ms 이하, 5% 이하 에러
  1000: { avgLatency: 500, p99Latency: 2000, errorRate: 0.1 },   // 1000명: 500ms 이하, 10% 이하 에러
};

async function runLoadTest(connections: number, duration: number = 10): Promise<LoadTestResult | null> {
  try {
    // autocannon을 동적으로 import
    const autocannon = require('autocannon');
    
    console.log(`\n🔥 부하 테스트 시작: ${connections}명 동시 접속, ${duration}초`);
    console.log('─'.repeat(50));

    const result = await autocannon({
      url: `${BASE_URL}/health`,
      connections: connections,
      duration: duration,
      pipelining: 1,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const threshold = THRESHOLDS[connections as keyof typeof THRESHOLDS] || THRESHOLDS[100];
    const errorRate = result.errors / result.requests.total;
    const passed = 
      result.latency.average <= threshold.avgLatency &&
      result.latency.p99 <= threshold.p99Latency &&
      errorRate <= threshold.errorRate;

    const testResult: LoadTestResult = {
      scenario: `${connections} concurrent users`,
      connections,
      duration,
      requests: {
        total: result.requests.total,
        average: result.requests.average,
        min: result.requests.min,
        max: result.requests.max,
        p99: result.requests.p99 || 0,
      },
      latency: {
        average: result.latency.average,
        min: result.latency.min,
        max: result.latency.max,
        p50: result.latency.p50,
        p95: result.latency.p95,
        p99: result.latency.p99,
      },
      throughput: {
        average: result.throughput.average,
        total: result.throughput.total,
      },
      errors: result.errors,
      timeouts: result.timeouts,
      status: passed ? 'PASS' : 'FAIL',
    };

    // 결과 출력
    console.log(`\n📊 결과 (${connections}명 동시 접속):`);
    console.log(`   총 요청: ${result.requests.total.toLocaleString()}`);
    console.log(`   평균 RPS: ${result.requests.average.toFixed(1)}`);
    console.log(`   평균 지연: ${result.latency.average.toFixed(2)}ms`);
    console.log(`   P50 지연: ${result.latency.p50.toFixed(2)}ms`);
    console.log(`   P95 지연: ${result.latency.p95.toFixed(2)}ms`);
    console.log(`   P99 지연: ${result.latency.p99.toFixed(2)}ms`);
    console.log(`   최대 지연: ${result.latency.max.toFixed(2)}ms`);
    console.log(`   에러: ${result.errors} (${(errorRate * 100).toFixed(2)}%)`);
    console.log(`   타임아웃: ${result.timeouts}`);
    console.log(`   처리량: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
    console.log(`   상태: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    return testResult;
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('\n❌ autocannon 모듈이 설치되지 않았습니다.');
      console.error('   npm install autocannon --save-dev 명령으로 설치해주세요.\n');
    } else {
      console.error(`\n❌ 부하 테스트 실패: ${error.message}\n`);
    }
    return null;
  }
}

async function runMultipleEndpointTest(connections: number): Promise<void> {
  try {
    const autocannon = require('autocannon');
    
    const endpoints = [
      { path: '/health', name: '헬스체크' },
      { path: '/api/game/turn?session_id=sangokushi_default', name: '턴 정보' },
      { path: '/api/game/cities?session=sangokushi_default', name: '도시 목록' },
    ];

    console.log(`\n🔥 다중 엔드포인트 부하 테스트: ${connections}명 동시 접속`);
    console.log('═'.repeat(60));

    for (const endpoint of endpoints) {
      console.log(`\n📍 테스트: ${endpoint.name} (${endpoint.path})`);
      
      const result = await autocannon({
        url: `${BASE_URL}${endpoint.path}`,
        connections: connections,
        duration: 5,
        pipelining: 1,
      });

      console.log(`   평균 지연: ${result.latency.average.toFixed(2)}ms | P99: ${result.latency.p99.toFixed(2)}ms | 에러: ${result.errors}`);
    }
  } catch (error: any) {
    console.error(`❌ 다중 엔드포인트 테스트 실패: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E5: 동시 접속 부하 테스트                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n대상 서버: ${BASE_URL}\n`);

  const results: LoadTestResult[] = [];

  // Phase 2.1: 100명 동시 접속
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Phase 2.1: 동시 접속 100명');
  console.log('═══════════════════════════════════════════════════════════');
  const result100 = await runLoadTest(100, 10);
  if (result100) results.push(result100);

  // Phase 2.2: 500명 동시 접속
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Phase 2.2: 동시 접속 500명');
  console.log('═══════════════════════════════════════════════════════════');
  const result500 = await runLoadTest(500, 10);
  if (result500) results.push(result500);

  // Phase 2.3: 1000명 동시 접속
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Phase 2.3: 동시 접속 1000명');
  console.log('═══════════════════════════════════════════════════════════');
  const result1000 = await runLoadTest(1000, 10);
  if (result1000) results.push(result1000);

  // 다중 엔드포인트 테스트 (500명)
  await runMultipleEndpointTest(500);

  // 최종 요약
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                부하 테스트 최종 요약                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('┌──────────────┬─────────────┬─────────────┬─────────────┬─────────┐');
  console.log('│ 동시 접속    │ 평균 지연   │ P99 지연    │ 에러율      │ 결과    │');
  console.log('├──────────────┼─────────────┼─────────────┼─────────────┼─────────┤');

  for (const r of results) {
    const conn = String(r.connections).padEnd(12);
    const avgLat = `${r.latency.average.toFixed(1)}ms`.padEnd(11);
    const p99Lat = `${r.latency.p99.toFixed(1)}ms`.padEnd(11);
    const errRate = `${((r.errors / r.requests.total) * 100).toFixed(2)}%`.padEnd(11);
    const status = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`│ ${conn} │ ${avgLat} │ ${p99Lat} │ ${errRate} │ ${status} │`);
  }

  console.log('└──────────────┴─────────────┴─────────────┴─────────────┴─────────┘\n');

  const allPassed = results.every(r => r.status === 'PASS');
  console.log(allPassed ? '🎉 모든 부하 테스트 통과!' : '⚠️ 일부 부하 테스트 실패');

  // JSON 출력 (CI 통합용)
  if (process.env.OUTPUT_JSON) {
    console.log('\n=== JSON 결과 ===');
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch(console.error);


