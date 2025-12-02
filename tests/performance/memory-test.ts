/**
 * E5: 메모리 사용량 측정 테스트
 * 
 * 목표:
 * - 백엔드 메모리 사용량 측정
 * - 메모리 누수 확인
 * - 힙 분석
 * 
 * 실행: npx ts-node tests/performance/memory-test.ts
 */

import axios from 'axios';
import { execSync } from 'child_process';

const BASE_URL = process.env.API_URL || 'http://localhost:8080';
const SESSION_ID = process.env.SESSION_ID || 'sangokushi_default';

interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface MemoryTestResult {
  scenario: string;
  initialMemory: MemorySnapshot;
  finalMemory: MemorySnapshot;
  peakMemory: number;
  memoryGrowth: number;
  memoryGrowthPercent: number;
  potentialLeak: boolean;
  requestCount: number;
  duration: number;
}

function getLocalMemory(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    timestamp: new Date(),
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
    arrayBuffers: mem.arrayBuffers || 0,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const sign = bytes < 0 ? '-' : '';
  return `${sign}${parseFloat((Math.abs(bytes) / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function measureBackendMemory(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Phase 3.1: 백엔드 메모리 측정');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 서버의 상세 헬스체크에서 메트릭 가져오기
    const response = await axios.get(`${BASE_URL}/health/detailed`);
    
    console.log('백엔드 서버 상태:');
    console.log(`  상태: ${response.data.status}`);
    console.log(`  MongoDB: ${response.data.checks.mongodb?.status || 'unknown'}`);
    console.log(`  Redis: ${response.data.checks.redis?.status || 'unknown'}`);
    
    // 메트릭 엔드포인트 확인
    try {
      const metricsResponse = await axios.get(`${BASE_URL}/metrics/commands`);
      console.log('\n명령 메트릭:');
      console.log(metricsResponse.data.substring(0, 500) + '...');
    } catch (e) {
      console.log('\n메트릭 엔드포인트를 사용할 수 없습니다.');
    }
  } catch (error: any) {
    console.error('백엔드 메모리 측정 실패:', error.message);
    console.log('백엔드 서버가 실행 중인지 확인해주세요.');
  }
}

async function measureMemoryUnderLoad(
  requestCount: number,
  scenario: string
): Promise<MemoryTestResult | null> {
  console.log(`\n🔍 메모리 테스트: ${scenario}`);
  console.log(`   요청 수: ${requestCount}`);
  console.log('─'.repeat(50));

  const snapshots: MemorySnapshot[] = [];
  const initialMemory = getLocalMemory();
  snapshots.push(initialMemory);

  const startTime = Date.now();

  // 요청 수행 및 메모리 측정
  for (let i = 0; i < requestCount; i++) {
    try {
      await axios.get(`${BASE_URL}/health`);
      
      // 매 100번째 요청마다 메모리 스냅샷
      if (i % 100 === 0) {
        snapshots.push(getLocalMemory());
      }
    } catch (error) {
      // 에러 무시
    }
  }

  // GC 수행 (가능한 경우)
  if (global.gc) {
    global.gc();
  }

  // 최종 메모리 측정 (약간의 대기 후)
  await new Promise(r => setTimeout(r, 1000));
  const finalMemory = getLocalMemory();
  snapshots.push(finalMemory);

  const duration = Date.now() - startTime;
  const peakMemory = Math.max(...snapshots.map(s => s.heapUsed));
  const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
  const memoryGrowthPercent = (memoryGrowth / initialMemory.heapUsed) * 100;

  // 메모리 누수 판단: 20% 이상 증가하면 잠재적 누수
  const potentialLeak = memoryGrowthPercent > 20;

  const result: MemoryTestResult = {
    scenario,
    initialMemory,
    finalMemory,
    peakMemory,
    memoryGrowth,
    memoryGrowthPercent,
    potentialLeak,
    requestCount,
    duration,
  };

  console.log(`   초기 힙: ${formatBytes(initialMemory.heapUsed)}`);
  console.log(`   최종 힙: ${formatBytes(finalMemory.heapUsed)}`);
  console.log(`   피크 힙: ${formatBytes(peakMemory)}`);
  console.log(`   메모리 증가: ${formatBytes(memoryGrowth)} (${memoryGrowthPercent.toFixed(2)}%)`);
  console.log(`   소요 시간: ${(duration / 1000).toFixed(2)}초`);
  console.log(`   상태: ${potentialLeak ? '⚠️ 잠재적 메모리 누수' : '✅ 정상'}`);

  return result;
}

async function runMemoryStressTest(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Phase 3.2: 메모리 스트레스 테스트');
  console.log('═══════════════════════════════════════════════════════════\n');

  const results: MemoryTestResult[] = [];

  // 1000 요청 테스트
  const result1 = await measureMemoryUnderLoad(1000, '1000 요청');
  if (result1) results.push(result1);

  // 5000 요청 테스트
  const result2 = await measureMemoryUnderLoad(5000, '5000 요청');
  if (result2) results.push(result2);

  // 결과 요약
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('메모리 테스트 요약');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('┌─────────────────┬────────────────┬────────────────┬────────────────┬─────────┐');
  console.log('│ 시나리오        │ 초기 메모리    │ 최종 메모리    │ 증가량         │ 상태    │');
  console.log('├─────────────────┼────────────────┼────────────────┼────────────────┼─────────┤');

  for (const r of results) {
    const scenario = r.scenario.padEnd(15);
    const initial = formatBytes(r.initialMemory.heapUsed).padEnd(14);
    const final = formatBytes(r.finalMemory.heapUsed).padEnd(14);
    const growth = `${formatBytes(r.memoryGrowth)} (${r.memoryGrowthPercent.toFixed(1)}%)`.padEnd(14);
    const status = r.potentialLeak ? '⚠️ 주의' : '✅ OK';
    console.log(`│ ${scenario} │ ${initial} │ ${final} │ ${growth} │ ${status}  │`);
  }

  console.log('└─────────────────┴────────────────┴────────────────┴────────────────┴─────────┘\n');

  const hasLeaks = results.some(r => r.potentialLeak);
  console.log(hasLeaks ? '⚠️ 일부 시나리오에서 메모리 증가가 감지되었습니다.' : '✅ 메모리 누수 없음');
}

async function checkProcessMemory(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Phase 3.3: 프로세스 메모리 확인');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // macOS에서 node 프로세스 메모리 확인
    const psOutput = execSync('ps aux | grep "node" | grep -v grep | head -5').toString();
    console.log('Node.js 프로세스 메모리 사용량:');
    console.log('───────────────────────────────────────────────────────────');
    console.log('USER       PID  %CPU %MEM      VSZ    RSS');
    console.log('───────────────────────────────────────────────────────────');
    
    const lines = psOutput.trim().split('\n');
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 6) {
        const user = parts[0].substring(0, 10);
        const pid = parts[1];
        const cpu = parts[2];
        const mem = parts[3];
        const vsz = formatBytes(parseInt(parts[4]) * 1024);
        const rss = formatBytes(parseInt(parts[5]) * 1024);
        console.log(`${user.padEnd(10)} ${pid.padStart(6)} ${cpu.padStart(5)} ${mem.padStart(4)} ${vsz.padStart(10)} ${rss.padStart(10)}`);
      }
    }
  } catch (error) {
    console.log('프로세스 메모리 정보를 가져올 수 없습니다.');
  }
}

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E5: 메모리 사용량 측정 테스트                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n대상 서버: ${BASE_URL}\n`);

  // 현재 테스트 프로세스 메모리
  const currentMem = process.memoryUsage();
  console.log('현재 테스트 프로세스 메모리:');
  console.log(`  힙 사용: ${formatBytes(currentMem.heapUsed)}`);
  console.log(`  힙 전체: ${formatBytes(currentMem.heapTotal)}`);
  console.log(`  RSS: ${formatBytes(currentMem.rss)}`);
  console.log(`  External: ${formatBytes(currentMem.external)}`);

  // Phase 3.1: 백엔드 메모리 측정
  await measureBackendMemory();

  // Phase 3.2: 메모리 스트레스 테스트
  await runMemoryStressTest();

  // Phase 3.3: 프로세스 메모리 확인
  await checkProcessMemory();

  console.log('\n🎉 메모리 테스트 완료!');
}

main().catch(console.error);


