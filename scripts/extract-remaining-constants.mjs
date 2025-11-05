import fs from 'fs';

console.log('=== GameConstBase 남은 상수 추출 ===\n');

// constants.json 로드
const constantsPath = './config/scenarios/sangokushi/data/constants.json';
let constants = {};
try {
  constants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
} catch (e) {
  console.log('⚠️  constants.json 없음, 새로 생성합니다.');
  constants = {};
}

// GameConstBase.php의 남은 숫자 상수들
// 이미 추가된 것들 제외하고 나머지 추가
if (!constants.gameSettings) {
  constants.gameSettings = {};
}

const gameSettings = constants.gameSettings;

// 메타 설정
gameSettings.title = "삼국지 모의전투 PHP HiDCHe";
gameSettings.mapName = 'che';
gameSettings.unitSet = 'che';

// 내정/능력치 설정
gameSettings.develrate = 50;
gameSettings.upgradeLimit = 30;
gameSettings.dexLimit = 1000000;

// 징병/모병 설정
gameSettings.defaultAtmosLow = 40;
gameSettings.defaultTrainLow = 40;
gameSettings.defaultAtmosHigh = 70;
gameSettings.defaultTrainHigh = 70;
gameSettings.maxAtmosByCommand = 100;
gameSettings.maxTrainByCommand = 100;
gameSettings.maxAtmosByWar = 150;
gameSettings.maxTrainByWar = 110;
gameSettings.trainDelta = 30;
gameSettings.atmosDelta = 30;
gameSettings.atmosSideEffectByTraining = 1;
gameSettings.trainSideEffectByAtmosTurn = 1;

// 계략 설정
gameSettings.sabotageDefaultProb = 0.35;
gameSettings.sabotageProbCoefByStat = 300;
gameSettings.sabotageDefenceCoefByGeneralCnt = 0.04;
gameSettings.sabotageDamageMin = 100;
gameSettings.sabotageDamageMax = 800;

// UI 색상 설정
gameSettings.basecolor = "#000044";
gameSettings.basecolor2 = "#225500";
gameSettings.basecolor3 = "#660000";
gameSettings.basecolor4 = "#330000";

// 전투 설정
gameSettings.armperphase = 500;

// 자원 설정
gameSettings.basegold = 0;
gameSettings.baserice = 2000;
gameSettings.minNationalGold = 0;
gameSettings.minNationalRice = 0;
gameSettings.exchangeFee = 0.01;
gameSettings.defaultGold = 1000;
gameSettings.defaultRice = 1000;
gameSettings.coefAidAmount = 10000;
gameSettings.maxResourceActionAmount = 10000;
gameSettings.resourceActionAmountGuide = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
  1200, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000
];
gameSettings.generalMinimumGold = 0;
gameSettings.generalMinimumRice = 500;

// 연령 설정
gameSettings.adultAge = 14;
gameSettings.minPushHallAge = 40;

// 계급/레벨 설정
gameSettings.maxDedLevel = 30;
gameSettings.maxTechLevel = 12;
gameSettings.maxBetrayCnt = 9;
gameSettings.maxLevel = 255;
gameSettings.statGradeLevel = 5;

// 기술 설정
gameSettings.techLevelIncYear = 5;
gameSettings.initialAllowedTechLevel = 1;

// 수비 설정
gameSettings.incDefSettingChange = 3;
gameSettings.maxDefSettingChange = 9;

// 벌점 설정
gameSettings.refreshLimitCoef = 10;

// 도시 설정
gameSettings.basePopIncreaseAmount = 5000;
gameSettings.expandCityPopIncreaseAmount = 100000;
gameSettings.expandCityDevelIncreaseAmount = 2000;
gameSettings.expandCityWallIncreaseAmount = 2000;
gameSettings.expandCityDefaultCost = 60000;
gameSettings.expandCityCostCoef = 500;
gameSettings.minAvailableRecruitPop = 30000;
gameSettings.defaultCityWall = 1000;

// 초기 설정
gameSettings.initialNationGenLimit = 10;
gameSettings.defaultMaxGeneral = 500;
gameSettings.defaultMaxNation = 55;
gameSettings.defaultMaxGenius = 5;
gameSettings.defaultStartYear = 180;
gameSettings.joinRuinedNPCProp = 0.1;

// 턴 설정
gameSettings.maxTurn = 30;
gameSettings.maxChiefTurn = 12;

// 제한 기간 설정
gameSettings.openingPartYear = 3;
gameSettings.joinActionLimit = 12;

// 장수 생성 설정
gameSettings.bornMinStatBonus = 3;
gameSettings.bornMaxStatBonus = 5;

// 고유 아이템 설정
gameSettings.maxUniqueItemLimit = [
  [-1, 1],
  [3, 2],
  [10, 3],
  [20, 4]
];
gameSettings.minTurnDieOnPrestart = 2;
gameSettings.uniqueTrialCoef = 1;
gameSettings.maxUniqueTrialProb = 0.25;

// 전투 설정
gameSettings.maxAvailableWarSettingCnt = 10;
gameSettings.incAvailableWarSettingCnt = 2;

// 베팅 설정
gameSettings.minGoldRequiredWhenBetting = 500;

// 상속 설정
gameSettings.minMonthToAllowInheritItem = 4;
gameSettings.inheritBornSpecialPoint = 6000;
gameSettings.inheritBornTurntimePoint = 2500;
gameSettings.inheritBornCityPoint = 1000;
gameSettings.inheritBornStatPoint = 1000;
gameSettings.inheritItemUniqueMinPoint = 5000;
gameSettings.inheritItemRandomPoint = 3000;
gameSettings.inheritBuffPoints = [0, 200, 600, 1200, 2000, 3000];
gameSettings.inheritSpecificSpecialPoint = 4000;
gameSettings.inheritResetAttrPointBase = [1000, 1000, 2000, 3000];
gameSettings.inheritCheckOwnerPoint = 1000;

// GameUnitConstBase.php 상수
if (!constants.unitTypes) {
  constants.unitTypes = {};
}

constants.unitTypes.T_CASTLE = 0;
constants.unitTypes.T_FOOTMAN = 1;
constants.unitTypes.T_ARCHER = 2;
constants.unitTypes.T_CAVALRY = 3;
constants.unitTypes.T_WIZARD = 4;
constants.unitTypes.T_SIEGE = 5;
constants.unitTypes.T_MISC = 6;
constants.unitTypes.CREWTYPE_CASTLE = 1000;
constants.unitTypes.DEFAULT_CREWTYPE = 1100;

constants.unitTypes.typeData = {
  1: '보병',
  2: '궁병',
  3: '기병',
  4: '귀병',
  5: '차병',
};

// 저장
fs.writeFileSync(constantsPath, JSON.stringify(constants, null, 2), 'utf-8');

console.log('✅ GameConstBase.php의 숫자 상수들을 gameSettings에 추가했습니다.');
console.log(`   총 ${Object.keys(gameSettings).length}개 설정 추가`);
console.log('✅ GameUnitConstBase.php의 상수들을 unitTypes에 추가했습니다.');
console.log(`   총 ${Object.keys(constants.unitTypes).length}개 상수 추가`);
console.log('\n✅ 변환 완료!');

