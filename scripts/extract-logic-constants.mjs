import fs from 'fs';

console.log('=== 로직 내부 하드코딩 상수 추출 ===\n');

// constants.json 로드
const constantsPath = './config/scenarios/sangokushi/data/constants.json';
let constants = {};
try {
  constants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
} catch (e) {
  console.log('⚠️  constants.json 없음, 새로 생성합니다.');
  constants = {};
}

// 로직 내부 계산 상수들
if (!constants.calculationConstants) {
  constants.calculationConstants = {};
}

const calc = constants.calculationConstants;

// 전투 계산 상수 (WarUnitGeneral.php)
calc.battle = {
  // 비율 변환 (퍼센트 -> 소수)
  percentToDecimal: 100,
  
  // 회피율 계산
  footmanAvoidRatio: 0.75,
  
  // 경험치 보정
  defenderExpMultiplier: 0.8,
  
  // 최소값 보정
  minWarPower: 0.01,
  
  // 경험치 레벨 계산
  expLevelDivisorCity: 600,
  expLevelDivisorGeneral: 300,
  
  // 승리 시 사기 증가
  attackerWinAtmosMultiplier: 1.1,
  defenderWinAtmosMultiplier: 1.05,
  
  // 군량 소모 계산 (데미지/100)
  riceConsumptionDivisor: 100,
  
  // 군량 부족 판단 (HP/100)
  riceShortageDivisor: 100,
};

// 명령 임계값들
calc.commandThresholds = {
  // 훈련/사기 최소값
  minTrainAtmos: 100,
  
  // 기술 차이 판단 (첩보)
  techDiff: {
    overwhelming: 1000,
    advantage: 250,
    equal: -250,
    disadvantage: -1000,
  },
  
  // 징병 최소 병력
  minRecruitCrew: 100,
  
  // 장수 레벨 임계값
  officerLevel: 5,
  
  // 기술 요구값
  reqTech: 1000,
  
  // 시나리오 ID
  scenarioId: 1000,
};

// 명령 계산식 계수들
calc.commandCoefficients = {
  // 허보: sqrt(장수수 * 4) * 10
  허보: {
    multiplier: 4,
    base: 10,
  },
  
  // 필사즉생: sqrt(장수수 * 8) * 10
  필사즉생: {
    multiplier: 8,
    base: 10,
  },
  
  // 피장파장: sqrt(장수수 * 2) * 10
  피장파장: {
    multiplier: 2,
    base: 10,
  },
  
  // 이호경식: sqrt(장수수 * 16) * 10
  이호경식: {
    multiplier: 16,
    base: 10,
  },
  
  // 의병모집: sqrt(장수수 * 10) * 10
  의병모집: {
    multiplier: 10,
    base: 10,
  },
  
  // 수몰: sqrt(장수수 * 4) * 10
  수몰: {
    multiplier: 4,
    base: 10,
  },
  
  // 백성동원: sqrt(장수수 * 4) * 10
  백성동원: {
    multiplier: 4,
    base: 10,
  },
  
  // 초토화 인구 감소
  초토화: {
    populationDivisor: 5,
  },
  
  // 증축/천도 비용
  증축: {
    costMultiplier: 5,
  },
  
  천도: {
    costMultiplier: 5,
  },
  
  // 의병모집 능력치 분배
  의병모집능력치: {
    무: 5,
    지: 5,
  },
};

// 포상 최소 금액
calc.commandThresholds.minRewardAmount = 100;

// GeneralAI 계산 상수
calc.generalAI = {
  // 자원 조달 최소값
  minTakeAmount: 100,
  
  // NPC 개발 자원 요구 (5배)
  npcDevelMultiplier: 5,
  
  // NPC 개발 최소 자원
  minNPCDevelResource: 5000,
};

// WarUnitTrigger Priority 오프셋
calc.triggerPriority = {
  offset: {
    PRE: 100,
    BEGIN: 200,
    BODY: 300,
    POST: 300,
    FINAL: 200,
  },
  
  // 특정 트리거 우선순위 오프셋
  specific: {
    'che_회피발동': 500,
    'che_회피시도': 200,
    'che_퇴각부상무효': 300,
    'che_저격발동': 100,
    'che_저격시도': 100,
    'che_위압시도': 100,
    'che_방어력증가5p': 200,
    'che_부상무효': 200,
    'che_반계시도': 300,
    'che_계략시도': 300,
    'che_계략발동': 300,
    'che_계략실패': 300,
    'che_기병병종전투': 100,
  },
};

// 저장
fs.writeFileSync(constantsPath, JSON.stringify(constants, null, 2), 'utf-8');

console.log('✅ 로직 내부 하드코딩 상수들을 calculationConstants에 추가했습니다:');
console.log('  - battle: 전투 계산 상수 (13개)');
console.log('  - commandThresholds: 명령 임계값 (8개)');
console.log('  - commandCoefficients: 명령 계산식 계수 (10개 명령)');
console.log('  - generalAI: AI 계산 상수 (3개)');
console.log('  - triggerPriority: 트리거 우선순위 설정');
console.log('\n✅ 변환 완료!');

