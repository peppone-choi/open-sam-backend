export class GameConst {
  static readonly defaultGold = 10000;
  static readonly defaultRice = 10000;
  static readonly defaultCrew = 1000;
  
  static readonly maxGold = 1000000;
  static readonly maxRice = 1000000;
  static readonly maxCrew = 50000;
  
  static readonly minGold = 0;
  static readonly minRice = 0;
  static readonly minCrew = 0;

  static readonly maxLeadership = 150;
  static readonly maxStrength = 150;
  static readonly maxIntel = 150;

  static readonly minStat = 1;
  static readonly defaultStat = 50;

  static readonly maxExperience = 999999;
  static readonly maxDedication = 999999;

  static readonly turnsPerMonth = 12;
  static readonly monthsPerYear = 12;

  static readonly maxCityFarm = 100000;
  static readonly maxCityComm = 100000;
  static readonly maxCitySec = 100000;
  static readonly maxCityDef = 100000;
  static readonly maxCityWall = 100000;

  static readonly minCityValue = 0;

  static readonly maxCityTrust = 100;
  static readonly minCityTrust = 0;
  static readonly defaultCityTrust = 50;

  static readonly maxTrain = 100;
  static readonly minTrain = 0;
  static readonly defaultTrain = 50;

  static readonly maxAtmos = 100;
  static readonly minAtmos = 0;
  static readonly defaultAtmos = 50;

  static readonly maxDex = 100;
  static readonly minDex = 0;

  static readonly neutralNationID = 0;
  static readonly wanderingNationID = 1;

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

  static readonly experienceMultiplier = 1.0;
  static readonly dedicationMultiplier = 1.0;

  static readonly criticalSuccessRate = 0.1;
  static readonly criticalFailRate = 0.1;

  static readonly criticalSuccessMultiplier = 1.5;
  static readonly criticalFailMultiplier = 0.5;

  static readonly domesticScoreBase = 100;
  static readonly militaryScoreBase = 100;

  static readonly recruitCostGold = 100;
  static readonly recruitCostRice = 50;

  static readonly trainCostGold = 50;
  static readonly trainCostRice = 50;

  static readonly researchCostGold = 1000;
  static readonly researchCostRice = 500;

  static readonly buildCostGold = 500;
  static readonly buildCostRice = 300;

  static readonly maxTechLevel = 10;
  static readonly minTechLevel = 0;

  static readonly openingYearsLimit = 5;

  static readonly defaultMakeLimit = 12;

  static readonly maxNameLength = 20;
  static readonly minNameLength = 2;

  static readonly maxMessageLength = 500;

  static readonly sessionTimeout = 3600000;

  static readonly autoSaveInterval = 300000;

  static readonly maxPlayersPerSession = 100;

  static readonly turnProcessingTimeout = 60000;

  static readonly battleTimeout = 1800000;

  static readonly maxBattleUnitsPerSide = 10;

  static readonly battleMapWidth = 800;
  static readonly battleMapHeight = 600;

  static readonly tileSize = 40;

  static readonly maxBattleTurns = 100;

  static readonly unitMovementCost = 1;
  static readonly unitAttackCost = 1;

  static readonly defaultUnitHP = 100;
  static readonly defaultUnitAttack = 10;
  static readonly defaultUnitDefense = 10;

  static readonly terrainBonusPlains = 1.0;
  static readonly terrainBonusForest = 1.1;
  static readonly terrainBonusMountain = 1.2;
  static readonly terrainBonusWater = 0.8;

  static readonly weatherBonusNormal = 1.0;
  static readonly weatherBonusRain = 0.9;
  static readonly weatherBonusSnow = 0.8;

  static readonly moraleBonusHigh = 1.2;
  static readonly moraleBonusNormal = 1.0;
  static readonly moraleBonusLow = 0.8;

  static readonly sabotageDamageMin = 100;
  static readonly sabotageDamageMax = 1000;

  static readonly initialNationGenLimit = 50;
  
  static readonly allItems: any[] = [];

  static readonly exchangeFee = 0.05; // 5% 수수료
  static readonly basegold = 1000;
  static readonly baserice = 2000;
}
