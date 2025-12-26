import { getScenarioConstants } from '../utils/scenario-data';
import { configManager } from '../config/ConfigManager';

const scenarioConstants = getScenarioConstants();
const gameBalance = scenarioConstants?.gameBalance ?? {};
const factionTypes = scenarioConstants?.factionTypes ?? {};
const master = configManager.get().game;
const balance = master.balance;
const npc = master.npc;
const cityCfg = master.city;
const unitCfg = master.unit;
const battleCfg = configManager.get().battle;

export class GameConst {
  static readonly defaultGold = balance.defaultGold;
  static readonly defaultRice = balance.defaultRice;
  static readonly defaultCrew = balance.defaultCrew;
  
  static readonly maxGold = balance.maxGold;
  static readonly maxRice = balance.maxRice;
  static readonly maxCrew = balance.maxCrew;
  
  static readonly minGold = 0;
  static readonly minRice = 0;
  static readonly minCrew = 0;

  static readonly maxLeadership = balance.maxLeadership;
  static readonly maxStrength = balance.maxStrength;
  static readonly maxIntel = balance.maxIntel;
  static readonly maxPolitics = balance.maxPolitics;
  static readonly maxCharm = balance.maxCharm;

  static readonly minStat = 1;
  static readonly defaultStat = 50;

  static readonly maxExperience = balance.maxExperience;
  static readonly maxDedication = balance.maxDedication;

  static readonly turnsPerMonth = master.calendar.turnsPerMonth;
  static readonly monthsPerYear = master.calendar.monthsPerYear;

  static readonly maxCityFarm = balance.maxCityFarm;
  static readonly maxCityComm = balance.maxCityComm;
  static readonly maxCitySec = balance.maxCitySec;
  static readonly maxCityDef = balance.maxCityDef;
  static readonly maxCityWall = balance.maxCityWall;

  static readonly minCityValue = cityCfg.minValue;

  static readonly maxCityTrust = cityCfg.maxTrust;
  static readonly minCityTrust = 0;
  static readonly defaultCityTrust = cityCfg.defaultTrust;
  
  // 징병 허용 최소 인구
  static readonly minAvailableRecruitPop = balance.minAvailableRecruitPop;
  static readonly expandCityPopIncreaseAmount = balance.expandCityPopIncrease;

  static readonly maxTrain = unitCfg.maxTrain;
  static readonly minTrain = 0;
  static readonly defaultTrain = unitCfg.defaultTrain;
  static readonly defaultTrainLow = 40;
  static readonly defaultTrainHigh = 70;
  
  // 명령으로 올릴 수 있는 최대 훈련도/사기치
  static readonly maxTrainByCommand = gameBalance?.maxTrainByCommand ?? 100;
  static readonly maxAtmosByCommand = gameBalance?.maxAtmosByCommand ?? 100;
  
  // 전투로 올릴 수 있는 최대 훈련도/사기치
  static readonly maxTrainByWar = gameBalance?.maxTrainByWar ?? 110;
  static readonly maxAtmosByWar = gameBalance?.maxAtmosByWar ?? 150;

  static readonly maxAtmos = unitCfg.maxAtmos;
  static readonly minAtmos = 0;
  static readonly defaultAtmos = unitCfg.defaultAtmos;
  static readonly defaultAtmosLow = 40;
  static readonly defaultAtmosHigh = 70;

  static readonly maxDex = unitCfg.maxDex;
  static readonly minDex = 0;

  static readonly neutralNationID = 0;
  static readonly wanderingNationID = 1;
  static readonly neutralNationType = factionTypes?.neutral ?? 'che_중립';

  static readonly chiefOffice = 1;
  static readonly generalOffice = 2;

  static readonly peaceDiplomacy = 2;
  static readonly warDiplomacy = 0;
  static readonly declarationDiplomacy = 1;
  static readonly allianceDiplomacy = 3;
  static readonly noAggressionDiplomacy = 7;

  static readonly normalCityState = 0;
  static readonly occupiedCityState = 1;
  static readonly siegeCityState = 43;

  static readonly maxNationLevel = 10;
  static readonly minNationLevel = 1;

  static readonly maxGeneralLevel = 100;
  static readonly minGeneralLevel = 1;

  static readonly maxItems = 100;

  static readonly commandCostMultiplier = 1.0;

  static readonly experienceMultiplier = balance.experienceMultiplier;
  static readonly dedicationMultiplier = balance.dedicationMultiplier;

  static readonly criticalSuccessRate = balance.criticalSuccessRate;
  static readonly criticalFailRate = balance.criticalFailRate;

  static readonly criticalSuccessMultiplier = balance.criticalSuccessMultiplier;
  static readonly criticalFailMultiplier = balance.criticalFailMultiplier;

  static readonly domesticScoreBase = 100;
  static readonly militaryScoreBase = 100;

  static readonly recruitCostGold = balance.recruitCostGold;
  static readonly recruitCostRice = balance.recruitCostRice;

  static readonly trainCostGold = balance.trainCostGold;
  static readonly trainCostRice = balance.trainCostRice;

  static readonly researchCostGold = balance.researchCostGold;
  static readonly researchCostRice = balance.researchCostRice;

  static readonly buildCostGold = balance.buildCostGold;
  static readonly buildCostRice = balance.buildCostRice;

  static readonly maxTechLevel = 10;
  static readonly minTechLevel = 0;

  static readonly openingYearsLimit = 5;

  static readonly defaultMakeLimit = 12;

  static readonly maxNameLength = 20;
  static readonly minNameLength = 2;

  static readonly maxMessageLength = 500;

  static readonly sessionTimeout = configManager.get().timeouts.session;

  static readonly autoSaveInterval = configManager.get().timeouts.autoSave;

  static readonly maxPlayersPerSession = 100;

  static readonly turnProcessingTimeout = configManager.get().timeouts.turnProcessing;

  static readonly battleTimeout = battleCfg.timeoutMs;

  static readonly maxBattleUnitsPerSide = 10;

  static readonly armperphase = gameBalance?.armperphase ?? 100;
  static readonly battleMapWidth = battleCfg.mapWidth;
  static readonly battleMapHeight = battleCfg.mapHeight;

  static readonly tileSize = battleCfg.tileSize;

  static readonly maxBattleTurns = battleCfg.maxTurns;

  static readonly unitMovementCost = battleCfg.movementCost;
  static readonly unitAttackCost = battleCfg.attackCost;

  static readonly defaultUnitHP = 100;
  static readonly defaultUnitAttack = 10;
  static readonly defaultUnitDefense = 10;

  static readonly terrainBonusPlains = battleCfg.terrainBonus.plains;
  static readonly terrainBonusForest = battleCfg.terrainBonus.forest;
  static readonly terrainBonusMountain = battleCfg.terrainBonus.mountain;
  static readonly terrainBonusWater = battleCfg.terrainBonus.water;

  static readonly weatherBonusNormal = battleCfg.weatherBonus.normal;
  static readonly weatherBonusRain = battleCfg.weatherBonus.rain;
  static readonly weatherBonusSnow = battleCfg.weatherBonus.snow;

  static readonly moraleBonusHigh = battleCfg.moraleBonus.high;
  static readonly moraleBonusNormal = battleCfg.moraleBonus.normal;
  static readonly moraleBonusLow = battleCfg.moraleBonus.low;

  static readonly sabotageDamageMin = 100;
  static readonly sabotageDamageMax = 1000;

  static readonly initialNationGenLimit = 50;

  static readonly allItems: Record<string, Record<string, number>> = loadAllItemsFromScenario();

  static readonly exchangeFee = balance.exchangeFee;
  static readonly basegold = 1000;
  static readonly baserice = 2000;

  // Missing properties from PHP version - TODO: verify these values
  static readonly maxResourceActionAmount = 1000000;
  static readonly resourceActionAmountGuide = 100;
  static readonly generalMinimumGold = 10000;
  static readonly generalMinimumRice = 10000;

  // Training effectiveness coefficient
  static readonly trainDelta = 1.0;

  // Sabotage probability coefficient (higher = harder to sabotage)
  static readonly sabotageProbCoefByStat = 500;

  // Side effect of training on atmos (positive correlation)
  static readonly atmosSideEffectByTraining = 0.2;

  // Available special skills (domestic and war)
  static readonly availableSpecialDomestic: string[] = ['agriculture', 'commerce', 'security', 'development'];
  static readonly availableSpecialWar: string[] = ['assault', 'defense', 'strategy', 'leadership'];

  // Sabotage mechanics
  static readonly sabotageDefenceCoefByGeneralCnt = 50;
  static readonly sabotageDefaultProb = 0.3;

  // Chief/Officer turn limits
  static readonly maxChiefTurn = 2; // Max turns for chief officers

  // Nation limits
  static readonly maxNation = 50; // Maximum number of nations in a game
  static readonly defaultMaxGeneral = 100; // Default max generals per nation

  // Minimum gold required for betting
  static readonly minGoldRequiredWhenBetting = 1000;

  // NPC AI constants (PHP GeneralAI constants)
  static readonly defaultStatNPCMax = npc.stat_max;
  static readonly chiefStatMin = npc.chief_stat_min;
  static readonly availableNationType = ['왕', '공', '후', '백', '군', '상', '무', '령'];  // 국가 타입

  // NPC AI Mode constants (점진적 롤아웃용)
  static readonly NPC_AI_MODE = {
    DISABLED: 'disabled',
    SHADOW: 'shadow',      // 로깅만 (PHP와 비교용)
    PARTIAL: 'partial',    // 명장급 이상만
    FULL: 'full'           // 모든 NPC
  } as const;

  // NPC 타입별 설명
  static readonly NPC_TYPE = {
    PLAYER: 0,             // 일반 플레이어
    ORIGINAL_CHAR: 1,      // 오리지널 캐릭터 (유저 플레이)
    NPC_BASIC: 2,          // 기본 NPC
    NPC_FAMOUS: 3,         // 명장 NPC
    NPC_LEGENDARY: 4,      // 전설급 NPC
    NPC_TROOP_LEADER: 5    // 부대장 NPC
  } as const;

  // AI 난이도별 정책 값
  static readonly AI_DIFFICULTY = {
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard',
    EXPERT: 'expert'
  } as const;
}

function loadAllItemsFromScenario(): Record<string, Record<string, number>> {
  const constants = getScenarioConstants();
  if (constants && typeof constants.allItems === 'object') {
    return constants.allItems as Record<string, Record<string, number>>;
  }
  return {};
}


function loadAllItemsFromScenario(): Record<string, Record<string, number>> {
  const constants = getScenarioConstants();
  if (constants && typeof constants.allItems === 'object') {
    return constants.allItems as Record<string, Record<string, number>>;
  }
  return {};
}
