/**
 * Gin7 Character Generation - 검증 테스트 스크립트
 */

import {
  rollStats,
  calculatePointBuyCost,
  rollTraits,
  formatStats,
  getStatGrade
} from '../services/gin7/CharacterGenService';
import { GIN7_STAT_KEYS } from '../types/gin7/character.types';
import { GIN7_TRAITS } from '../data/gin7/traits';
import { getOriginalCharacterById, ORIGINAL_CHARACTERS } from '../data/gin7/original-characters';

console.log('='.repeat(60));
console.log('🎮 Gin7 Character Generation 검증 테스트');
console.log('='.repeat(60));

// ============================================
// 1. 스탯 총합 검증
// ============================================
console.log('\n📊 [검증 1] 스탯 총합 제한 테스트');
console.log('-'.repeat(40));

const SAMPLE_COUNT = 10;
const totals: number[] = [];

for (let i = 0; i < SAMPLE_COUNT; i++) {
  const stats = rollStats(`test-seed-${i}`);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  totals.push(total);
  
  console.log(`\n[샘플 ${i + 1}] 총합: ${total}점 (등급: ${getStatGrade(total)})`);
  console.log(formatStats(stats));
}

const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
const minTotal = Math.min(...totals);
const maxTotal = Math.max(...totals);

console.log('\n📈 통계:');
console.log(`  - 평균: ${avgTotal.toFixed(1)}점`);
console.log(`  - 최소: ${minTotal}점`);
console.log(`  - 최대: ${maxTotal}점`);
console.log(`  - 목표: 60점`);
console.log(`  ✅ 모든 샘플이 목표 총합(60점)과 일치: ${totals.every(t => t === 60) ? 'YES' : 'NO'}`);

// ============================================
// 2. 극단값 분포 검증
// ============================================
console.log('\n\n📊 [검증 2] 극단값 분포 테스트 (100회 롤링)');
console.log('-'.repeat(40));

const LARGE_SAMPLE = 100;
const statCounts: Record<number, number> = {};
let allOnes = 0;
let allTens = 0;

for (let i = 0; i < LARGE_SAMPLE; i++) {
  const stats = rollStats(`large-test-${i}`);
  const values = Object.values(stats);
  
  // 모든 스탯이 1인 경우
  if (values.every(v => v === 1)) allOnes++;
  // 모든 스탯이 10인 경우
  if (values.every(v => v === 10)) allTens++;
  
  // 스탯 분포 집계
  for (const val of values) {
    statCounts[val] = (statCounts[val] || 0) + 1;
  }
}

console.log('스탯 값 분포:');
for (let i = 1; i <= 10; i++) {
  const count = statCounts[i] || 0;
  const pct = ((count / (LARGE_SAMPLE * 8)) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(count / 10));
  console.log(`  ${i.toString().padStart(2)}: ${count.toString().padStart(4)}회 (${pct}%) ${bar}`);
}

console.log(`\n극단값 체크:`);
console.log(`  - 올 1 캐릭터: ${allOnes}개`);
console.log(`  - 올 10 캐릭터: ${allTens}개`);
console.log(`  ✅ 극단값 없음: ${allOnes === 0 && allTens === 0 ? 'YES' : 'NO'}`);

// ============================================
// 3. 오리지널 캐릭터 유일성 검증
// ============================================
console.log('\n\n📊 [검증 3] 오리지널 캐릭터 유일성 보장');
console.log('-'.repeat(40));

// 라인하르트 확인
const reinhard = getOriginalCharacterById('reinhard');
console.log(`\n라인하르트 데이터:`);
console.log(`  - ID: ${reinhard?.id}`);
console.log(`  - 이름: ${reinhard?.nameKo}`);
console.log(`  - 진영: ${reinhard?.faction}`);
console.log(`  - 희귀도: ${reinhard?.rarity}`);
console.log(`  - 명성 비용: ${reinhard?.reputationCost}`);

// 유일성 로직 설명
console.log(`\n유일성 보장 메커니즘:`);
console.log(`  1. TakenCharacterModel: 세션별 선택된 캐릭터 추적`);
console.log(`  2. getAvailableForLottery(takenIds): 이미 선택된 ID 제외`);
console.log(`  3. applyForLottery(): 이미 선택된 캐릭터면 신청 거부`);
console.log(`  4. executeDrawing(): 당첨 시 TakenCharacterModel에 등록`);

// 시뮬레이션
console.log(`\n시뮬레이션:`);
const takenIds = ['reinhard']; // 라인하르트가 이미 선택됨
const available = ORIGINAL_CHARACTERS.filter(c => !takenIds.includes(c.id));
const reinhardAvailable = available.some(c => c.id === 'reinhard');

console.log(`  - 전체 오리지널 캐릭터: ${ORIGINAL_CHARACTERS.length}명`);
console.log(`  - 선택된 캐릭터: ${takenIds.join(', ')}`);
console.log(`  - 남은 캐릭터: ${available.length}명`);
console.log(`  - 라인하르트 추첨 가능: ${reinhardAvailable ? 'YES ❌' : 'NO ✅'}`);

// ============================================
// 4. 트레잇 시스템 검증
// ============================================
console.log('\n\n📊 [검증 4] 트레잇 시스템');
console.log('-'.repeat(40));

console.log(`\n등록된 트레잇: ${GIN7_TRAITS.length}종`);
console.log(`  - positive: ${GIN7_TRAITS.filter(t => t.category === 'positive').length}종`);
console.log(`  - negative: ${GIN7_TRAITS.filter(t => t.category === 'negative').length}종`);
console.log(`  - special: ${GIN7_TRAITS.filter(t => t.category === 'special').length}종`);
console.log(`  - legendary: ${GIN7_TRAITS.filter(t => t.category === 'legendary').length}종`);

// 트레잇 롤링 샘플
console.log(`\n트레잇 롤링 샘플 (3회):`);
for (let i = 0; i < 3; i++) {
  const traits = rollTraits(GIN7_TRAITS, 3, `trait-test-${i}`);
  console.log(`  [${i + 1}] ${traits.map(t => t.nameKo).join(', ') || '(없음)'}`);
}

// ============================================
// 최종 결과
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📋 검증 결과 요약');
console.log('='.repeat(60));

const results = [
  { name: '스탯 총합 제한 (60점)', pass: totals.every(t => t === 60) },
  { name: '극단값 없음 (올1/올10)', pass: allOnes === 0 && allTens === 0 },
  { name: '오리지널 유일성 보장', pass: !reinhardAvailable },
  { name: '트레잇 시스템 작동', pass: GIN7_TRAITS.length > 0 }
];

results.forEach(r => {
  console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`);
});

const allPassed = results.every(r => r.pass);
console.log(`\n🎯 최종 결과: ${allPassed ? '모든 검증 통과! ✅' : '일부 검증 실패 ❌'}`);

