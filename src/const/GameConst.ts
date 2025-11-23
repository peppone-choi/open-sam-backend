export const GameConst = {
  defaultMaxGeneral: 50,
  sabotageProbCoefByStat: 1,
  sabotageDefenceCoefByGeneralCnt: 1,
  sabotageDefaultProb: 0.5,
  basegold: 0,
  baserice: 2000,
  maxResourceActionAmount: 10000,
  resourceActionAmountGuide: [100, 500, 1000, 2000, 5000, 10000],
  expandCityPopIncreaseAmount: 100000,
  expandCityDevelIncreaseAmount: 2000,
  expandCityWallIncreaseAmount: 2000,
  expandCityDefaultCost: 60000,
  expandCityCostCoef: 500,
  npcSeizureMessageProb: 0.5,
  initialNationGenLimit: 10,
  coefAidAmount: 10000,
  minGoldRequiredWhenBetting: 0, // 베팅 시 최소 필요 금액
  
  // 전투 관련 상수
  armperphase: 100, // 페이즈당 기본 데미지
  maxTrainByCommand: 100, // 훈련도 상한 (명령)
  maxAtmosByCommand: 100, // 사기 상한 (명령)
  maxTrainByWar: 150, // 훈련도 상한 (전투)
  maxAtmosByWar: 150, // 사기 상한 (전투)
  neutralNationType: 0, // 중립 국가 타입
};
