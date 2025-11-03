import fs from 'fs';

console.log('=== 누락된 로직 상수 추가 ===\n');

// constants.json 로드
const constantsPath = './config/scenarios/sangokushi/data/constants.json';
let constants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));

if (!constants.calculationConstants) {
  constants.calculationConstants = {};
}

const calc = constants.calculationConstants;

// GeneralAI.php 상수들
calc.generalAI = calc.generalAI || {};
calc.generalAI = {
  ...calc.generalAI,
  // 장수 타입
  generalType: {
    무장: 1,
    지장: 2,
    통솔장: 4,
  },
  
  // 외교 상태
  diplomacyState: {
    평화: 0,
    선포: 1,
    징병: 2,
    직전: 3,
    전쟁: 4,
  },
  
  // 개발 비용 계산
  develCostMultiplier: 12,
  
  // 기본 이전 수입값
  defaultPrevIncomeGold: 1000,
  defaultPrevIncomeRice: 1000,
  
  // 자원 행동 최대 금액 계산
  resourceActionAmountDivisors: {
    prevIncome: 10,
    nationResource: 5,
  },
  
  // 자원 행동 금액 연도 계수
  resourceActionAmountYearMultiplier: 1000,
  resourceActionAmountYearOffset: 3,
  
  // 장수 타입 판단 비율
  genTypeThresholds: {
    무지장: 0.8,  // intel >= strength * 0.8
    지무장: 0.8,  // strength >= intel * 0.8
  },
  
  // 외교 제한 기간
  diplomacyRestrictionYear: 2,
  diplomacyRestrictionMonth: 5,
  
  // 전쟁 준비 임계값
  warReadyTermThreshold: 5,
  warYetTermThreshold: 8,
  
  // 공격 가능 판단 기간
  attackableMonthOffset: 5,
  
  // 경로 계산
  routeDistanceOffset: 1,
  
  // 징집 인구 계산
  recruitPopBaseMultiplier: 100,
  
  // 인구 비율 계산
  populationRatioDivisors: {
    normal: 4,
    backup: 2,
  },
  
  // NPC 타입 임계값
  npcTypeThreshold: 2,
  
  // 전선 도시 임계값
  frontCityThreshold: 2,
  
  // 내정 개발 임계값
  devThresholds: {
    average: 0.99,
    target: 0.95,
    max: 0.999,
  },
  
  // 개발 점수 계산
  devScorePower: 2,
  devScoreCityGeneralDivisor: 1, // count(generals) + 1
};

// Event/Action 상수들 추가
calc.eventAction = {
  // UpdateCitySupply
  supply: {
    // 필요한 상수 추가
  },
  
  // ProcessIncome
  income: {
    // 필요한 상수 추가
  },
  
  // RaiseInvader
  invader: {
    // 필요한 상수 추가
  },
};

// 스캔 결과에서 자주 사용되는 상수들 추가
calc.common = {
  // 자주 사용되는 나누기 계수
  commonDivisors: [2, 3, 4, 5, 6, 8, 10, 12, 20, 30, 50, 80, 100, 200, 300, 400, 600, 1000, 2000, 3000, 10000, 1000000],
  
  // 자주 사용되는 곱하기 배수
  commonMultipliers: [0.04, 0.05, 0.15, 0.2, 0.25, 0.5, 0.7, 0.8, 0.9, 0.99, 1.01, 1.05, 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 2, 3, 4, 5, 6, 8, 9, 10, 12, 16, 24, 30, 60, 70, 80, 90, 100, 500, 1000],
  
  // 자주 사용되는 비율값
  commonRatios: [0.0001, 0.001, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.1, 0.15, 0.2, 0.25, 0.3, 0.33, 0.34, 0.35, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 0.95, 0.97, 0.98, 0.99],
};

// 저장
fs.writeFileSync(constantsPath, JSON.stringify(constants, null, 2), 'utf-8');

console.log('✅ 누락된 로직 상수들을 추가했습니다:');
console.log('  - generalAI: GeneralAI 상수들 (장수 타입, 외교 상태, 계산식 등)');
console.log('  - eventAction: Event/Action 관련 상수 (확장 가능)');
console.log('  - common: 자주 사용되는 공통 상수 목록');
console.log('\n✅ 추가 완료!');

