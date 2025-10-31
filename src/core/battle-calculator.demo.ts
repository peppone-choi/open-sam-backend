/**
 * 간단한 전투 계산기 데모
 */

import { simulateBattle, UnitType, TerrainType } from './battle-calculator';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         삼국지 전투 시뮬레이터 - 간단 데모               ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log();

// 적벽대전 재현
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📜 적벽대전 시뮬레이션');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

const chibiResult = simulateBattle(
  '조조 대군', 100000, [92, 72, 96], UnitType.FOOTMAN,
  '손유연합군', 30000, [88, 85, 95], UnitType.WIZARD,
  TerrainType.WATER  // 수전
);

console.log('⚔️  조조의 대군 vs 손유연합군 (적벽)');
console.log('   - 조조: 100,000명의 보병 (수전에 불리)');
console.log('   - 손유: 30,000명의 귀병 (화공 전략)');
console.log();
console.log('📊 전투 결과:');
console.log(`   승자: ${chibiResult.winner === 'attacker' ? '조조' : '손유연합군'} ✨`);
console.log(`   조조군 손실: ${chibiResult.attackerCasualties.toLocaleString()}명`);
console.log(`   연합군 손실: ${chibiResult.defenderCasualties.toLocaleString()}명`);
console.log();

// 관도대전
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📜 관도대전 시뮬레이션');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

const guanduResult = simulateBattle(
  '조조', 20000, [95, 72, 96], UnitType.CAVALRY,
  '원소', 70000, [75, 65, 70], UnitType.FOOTMAN,
  TerrainType.PLAINS
);

console.log('⚔️  조조 vs 원소 (관도)');
console.log('   - 조조: 20,000명의 기병 (소수정예)');
console.log('   - 원소: 70,000명의 보병 (대군)');
console.log();
console.log('📊 전투 결과:');
console.log(`   승자: ${guanduResult.winner === 'attacker' ? '조조' : '원소'} ✨`);
console.log(`   조조군 손실: ${guanduResult.attackerCasualties.toLocaleString()}명`);
console.log(`   원소군 손실: ${guanduResult.defenderCasualties.toLocaleString()}명`);
console.log();

// 이릉대전
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📜 이릉대전 시뮬레이션');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

const yilingResult = simulateBattle(
  '유비 복수군', 50000, [85, 92, 75], UnitType.FOOTMAN,
  '육손 방어군', 30000, [82, 78, 98], UnitType.WIZARD,
  TerrainType.FOREST  // 산림 지대
);

console.log('⚔️  유비 vs 육손 (이릉)');
console.log('   - 유비: 50,000명의 보병 (복수전)');
console.log('   - 육손: 30,000명의 귀병 (화공 전략)');
console.log();
console.log('📊 전투 결과:');
console.log(`   승자: ${yilingResult.winner === 'attacker' ? '유비' : '육손'} ✨`);
console.log(`   촉군 손실: ${yilingResult.attackerCasualties.toLocaleString()}명`);
console.log(`   오군 손실: ${yilingResult.defenderCasualties.toLocaleString()}명`);
console.log();

// 장판파 전투
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📜 장판파 전투 시뮬레이션');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

const changbanResult = simulateBattle(
  '조조 추격군', 10000, [92, 72, 96], UnitType.CAVALRY,
  '조운 단기', 1, [85, 100, 75], UnitType.CAVALRY,  // 혼자서 적진 돌파
  TerrainType.PLAINS
);

console.log('⚔️  조조군 vs 조운 (장판파)');
console.log('   - 조조: 10,000명의 추격 기병');
console.log('   - 조운: 혼자서 아두를 구출 (무력 100)');
console.log();
console.log('📊 전투 결과:');
console.log(`   승자: ${changbanResult.winner === 'attacker' ? '조조군' : '조운'} ✨`);
console.log(`   조조군 손실: ${changbanResult.attackerCasualties.toLocaleString()}명`);
console.log(`   조운 생존: ${changbanResult.defenderSurvivors > 0 ? '예 (전설!)' : '아니오'}`);
console.log();

// 합비 전투
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📜 합비 전투 시뮬레이션 (장료의 야습)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

const hefeiResult = simulateBattle(
  '장료 야습부대', 800, [88, 95, 75], UnitType.CAVALRY,
  '손권 본진', 10000, [82, 78, 80], UnitType.FOOTMAN,
  TerrainType.PLAINS
);

console.log('⚔️  장료 vs 손권 (합비)');
console.log('   - 장료: 800명 정예 기병 (야습)');
console.log('   - 손권: 10,000명 본진');
console.log();
console.log('📊 전투 결과:');
console.log(`   승자: ${hefeiResult.winner === 'attacker' ? '장료' : '손권'} ✨`);
console.log(`   위군 손실: ${hefeiResult.attackerCasualties.toLocaleString()}명`);
console.log(`   오군 손실: ${hefeiResult.defenderCasualties.toLocaleString()}명`);
console.log();

// 통계 요약
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📈 전투 시뮬레이션 통계 요약');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

const battles = [
  { name: '적벽대전', result: chibiResult },
  { name: '관도대전', result: guanduResult },
  { name: '이릉대전', result: yilingResult },
  { name: '장판파', result: changbanResult },
  { name: '합비전투', result: hefeiResult }
];

battles.forEach(({ name, result }) => {
  const totalCasualties = result.attackerCasualties + result.defenderCasualties;
  const attackerLossRate = ((result.attackerCasualties / (result.attackerSurvivors + result.attackerCasualties)) * 100).toFixed(1);
  const defenderLossRate = ((result.defenderCasualties / (result.defenderSurvivors + result.defenderCasualties)) * 100).toFixed(1);
  
  console.log(`📌 ${name}:`);
  console.log(`   총 사상자: ${totalCasualties.toLocaleString()}명`);
  console.log(`   공격자 손실률: ${attackerLossRate}%`);
  console.log(`   수비자 손실률: ${defenderLossRate}%`);
  console.log(`   전투 지속: ${result.duration} 페이즈`);
  console.log();
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 시뮬레이션 교훈:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();
console.log('1️⃣  병종 상성이 중요합니다');
console.log('   • 기병 > 보병, 궁병');
console.log('   • 궁병 > 차병 (단, 평지 제외)');
console.log('   • 귀병은 지형과 계략에 강함');
console.log();
console.log('2️⃣  지형 활용이 승부를 가릅니다');
console.log('   • 평지: 기병 유리');
console.log('   • 산악/숲: 궁병, 보병 유리');
console.log('   • 수상: 귀병 유리');
console.log();
console.log('3️⃣  능력치 균형이 중요합니다');
console.log('   • 보병/기병: 통솔+무력');
console.log('   • 궁병: 무력+지력');
console.log('   • 귀병: 지력+통솔');
console.log('   • 차병: 통솔 중심');
console.log();
console.log('4️⃣  특기를 활용하세요');
console.log('   • 돌격, 저격, 책략: 공격 특화');
console.log('   • 철벽, 간파, 회복: 방어 특화');
console.log('   • 필살: 범용 공격 강화');
console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✨ 전략적 사고가 승리를 가져옵니다! ✨');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
