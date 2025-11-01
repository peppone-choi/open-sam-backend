/**
 * BattleCalculator 사용 예제
 * 
 * 다양한 전투 시나리오를 시뮬레이션하는 예제 코드
 */

import { 
  BattleCalculator, 
  BattleContext, 
  UnitType, 
  TerrainType,
  simulateBattle 
} from './battle-calculator';

console.log('='.repeat(60));
console.log('전투 시뮬레이터 예제');
console.log('='.repeat(60));
console.log();

// 예제 1: 간단한 전투
console.log('【예제 1】 평지에서의 기병 vs 보병');
console.log('-'.repeat(60));
const example1 = simulateBattle(
  '조조', 5000, [95, 72, 91], UnitType.CAVALRY,
  '원소', 6000, [83, 68, 75], UnitType.FOOTMAN,
  TerrainType.PLAINS
);
console.log(example1.battleLog.join('\n'));
console.log();

// 예제 2: 병종 상성
console.log('【예제 2】 기병의 궁병 압도');
console.log('-'.repeat(60));
const example2 = simulateBattle(
  '마초', 4000, [85, 97, 45], UnitType.CAVALRY,
  '황충', 3500, [78, 95, 62], UnitType.ARCHER,
  TerrainType.PLAINS
);
console.log(example2.battleLog.join('\n'));
console.log();

// 예제 3: 지형 효과
console.log('【예제 3】 숲에서의 기병 vs 궁병 (지형 불리)');
console.log('-'.repeat(60));
const example3 = simulateBattle(
  '마초', 4000, [85, 97, 45], UnitType.CAVALRY,
  '황충', 3500, [78, 95, 62], UnitType.ARCHER,
  TerrainType.FOREST
);
console.log(example3.battleLog.join('\n'));
console.log();

// 예제 4: 공성전
console.log('【예제 4】 차병을 이용한 성 공략');
console.log('-'.repeat(60));
const calculator = new BattleCalculator();
const siegeContext: BattleContext = {
  attacker: {
    name: '조조의 공성부대',
    troops: 8000,
    leadership: 95,
    strength: 72,
    intelligence: 91,
    unitType: UnitType.SIEGE,
    morale: 85,
    training: 90,
    techLevel: 70,
    specialSkills: ['공성']
  },
  defender: {
    name: '업성 수비군',
    troops: 5000,
    leadership: 75,
    strength: 80,
    intelligence: 65,
    unitType: UnitType.FOOTMAN,
    morale: 90,
    training: 85,
    techLevel: 50,
    specialSkills: ['철벽']
  },
  terrain: TerrainType.FORTRESS,
  isDefenderCity: true,
  cityWall: 75
};
const example4 = calculator.calculateBattle(siegeContext);
console.log(example4.battleLog.join('\n'));
console.log();

// 예제 5: 특기 효과
console.log('【예제 5】 특기를 활용한 전투');
console.log('-'.repeat(60));
const skillContext: BattleContext = {
  attacker: {
    name: '여포 (필살+돌격)',
    troops: 3000,
    leadership: 78,
    strength: 100,
    intelligence: 35,
    unitType: UnitType.CAVALRY,
    morale: 90,
    training: 85,
    techLevel: 50,
    specialSkills: ['필살', '돌격']
  },
  defender: {
    name: '장료 (간파+철벽)',
    troops: 3500,
    leadership: 88,
    strength: 90,
    intelligence: 75,
    unitType: UnitType.FOOTMAN,
    morale: 95,
    training: 95,
    techLevel: 60,
    specialSkills: ['간파', '철벽']
  },
  terrain: TerrainType.PLAINS,
  isDefenderCity: false
};
const example5 = calculator.calculateBattle(skillContext);
console.log(example5.battleLog.join('\n'));
console.log();

// 예제 6: 계략전 (귀병)
console.log('【예제 6】 귀병을 이용한 계략전');
console.log('-'.repeat(60));
const wizardContext: BattleContext = {
  attacker: {
    name: '제갈량',
    troops: 4000,
    leadership: 92,
    strength: 38,
    intelligence: 100,
    unitType: UnitType.WIZARD,
    morale: 90,
    training: 80,
    techLevel: 80,
    specialSkills: ['책략', '간파']
  },
  defender: {
    name: '사마의',
    troops: 4500,
    leadership: 88,
    strength: 45,
    intelligence: 96,
    unitType: UnitType.WIZARD,
    morale: 85,
    training: 85,
    techLevel: 85,
    specialSkills: ['책략', '회복']
  },
  terrain: TerrainType.PLAINS,
  isDefenderCity: false
};
const example6 = calculator.calculateBattle(wizardContext);
console.log(example6.battleLog.join('\n'));
console.log();

// 예제 7: 대군 vs 소수정예
console.log('【예제 7】 대군 vs 소수정예');
console.log('-'.repeat(60));
const example7a = simulateBattle(
  '대군', 10000, [70, 70, 70], UnitType.FOOTMAN,
  '정예군', 3000, [95, 95, 95], UnitType.FOOTMAN,
  TerrainType.PLAINS
);
console.log(example7a.battleLog.join('\n'));
console.log();

// 예제 8: 연속 전투 (피로도 시뮬레이션)
console.log('【예제 8】 연속 전투 시뮬레이션');
console.log('-'.repeat(60));

let attackerTroops = 5000;
let attackerMorale = 90;
let attackerTraining = 90;

const enemies = [
  { name: '선봉대', troops: 2000, stats: [70, 70, 60] as [number, number, number] },
  { name: '중군', troops: 3000, stats: [75, 75, 65] as [number, number, number] },
  { name: '후군', troops: 2500, stats: [80, 80, 70] as [number, number, number] }
];

console.log(`초기 병력: ${attackerTroops}명 (사기: ${attackerMorale}, 훈련: ${attackerTraining})`);
console.log();

for (let i = 0; i < enemies.length; i++) {
  const enemy = enemies[i];
  console.log(`--- ${i + 1}차 전투: vs ${enemy.name} ---`);
  
  const battle: BattleContext = {
    attacker: {
      name: '주력군',
      troops: attackerTroops,
      leadership: 90,
      strength: 85,
      intelligence: 75,
      unitType: UnitType.CAVALRY,
      morale: attackerMorale,
      training: attackerTraining,
      techLevel: 60
    },
    defender: {
      name: enemy.name,
      troops: enemy.troops,
      leadership: enemy.stats[0],
      strength: enemy.stats[1],
      intelligence: enemy.stats[2],
      unitType: UnitType.FOOTMAN,
      morale: 80,
      training: 80,
      techLevel: 50
    },
    terrain: TerrainType.PLAINS,
    isDefenderCity: false
  };
  
  const result = calculator.calculateBattle(battle);
  
  console.log(`결과: ${result.winner === 'attacker' ? '승리' : '패배'}`);
  console.log(`생존 병력: ${result.attackerSurvivors}명 (손실: ${result.attackerCasualties}명)`);
  
  if (result.winner === 'attacker') {
    attackerTroops = result.attackerSurvivors;
    // 연속 전투로 인한 피로도
    attackerMorale = Math.max(50, attackerMorale - 5);
    attackerTraining = Math.max(70, attackerTraining - 3);
    console.log(`피로 누적 - 사기: ${attackerMorale}, 훈련: ${attackerTraining}`);
  } else {
    console.log('전투 패배로 시뮬레이션 종료');
    break;
  }
  console.log();
}

console.log('='.repeat(60));
console.log('시뮬레이션 완료');
console.log('='.repeat(60));

// 예제 9: 다양한 조합 비교
console.log();
console.log('【예제 9】 병종별 승률 분석 (1000명 vs 1000명, 평지)');
console.log('-'.repeat(60));

const units: UnitType[] = [
  UnitType.FOOTMAN,
  UnitType.CAVALRY,
  UnitType.ARCHER,
  UnitType.WIZARD,
  UnitType.SIEGE
];

const winMatrix: number[][] = Array(units.length).fill(0).map(() => Array(units.length).fill(0));

const TRIALS = 5; // 각 조합당 시뮬레이션 횟수

for (let i = 0; i < units.length; i++) {
  for (let j = 0; j < units.length; j++) {
    let wins = 0;
    
    for (let trial = 0; trial < TRIALS; trial++) {
      const result = simulateBattle(
        'A', 1000, [80, 80, 80], units[i],
        'B', 1000, [80, 80, 80], units[j],
        TerrainType.PLAINS
      );
      
      if (result.winner === 'attacker') wins++;
    }
    
    winMatrix[i][j] = Math.round((wins / TRIALS) * 100);
  }
}

// 승률 테이블 출력
console.log('      |' + units.map(u => u.padEnd(8)).join('|'));
console.log('-'.repeat(60));
for (let i = 0; i < units.length; i++) {
  const row = units[i].padEnd(6) + '|' + 
    winMatrix[i].map(w => `${w}%`.padEnd(8)).join('|');
  console.log(row);
}
console.log();
console.log('* 각 셀은 행 병종이 열 병종을 상대로 한 승률');
console.log();
