/**
 * 게임 밸런스 상수
 * PHP GameConstBase.php 기반
 */

export const GameBalance = {
  // 훈련/사기
  defaultTrainLow: 40, // 징병 초기 훈련치
  defaultAtmosLow: 40, // 징병 초기 사기치
  defaultTrainHigh: 70, // 모병 초기 훈련치
  defaultAtmosHigh: 70, // 모병 초기 사기치
  maxTrainByCommand: 100, // 훈련으로 올릴 수 있는 최대 훈련치
  maxAtmosByCommand: 100, // 사기진작으로 올릴 수 있는 최대 사기치
  maxTrainByWar: 110, // 전투로 올릴 수 있는 최대 훈련치
  maxAtmosByWar: 150, // 전투로 올릴 수 있는 최대 사기치
  trainDelta: 30, // 훈련 1회 상승량 계수
  atmosDelta: 30, // 사기 1회 상승량 계수
  atmosSideEffectByTraining: 1.0, // 훈련시 사기 감소율
  trainSideEffectByAtmosTurn: 1.0, // 사기진작시 훈련 감소율

  // 자원
  defaultGold: 1000, // 시작시 금
  defaultRice: 1000, // 시작시 쌀
  baseGold: 0, // 기본 국고
  baseRice: 2000, // 기본 병량
  minNationalGold: 0, // 최저 국고
  minNationalRice: 0, // 최저 병량
  exchangeFee: 0.01, // 군량 매매 세율

  // 인구
  minAvailableRecruitPop: 30000, // 징병 허용 최소 인구
  basePopIncreaseAmount: 5000, // 최소 인구 증가량

  // 경험치
  upgradeLimit: 30, // 능력치 상승 경험치
  dexLimit: 1000000, // 숙련도 제한치
  maxLevel: 255, // 최대 레벨

  // 내정
  develRate: 50, // 내정시 최하 민심 설정
  develCost: 24, // 기본 내정 비용

  // 계략
  sabotageDefaultProb: 0.35, // 계략 기본 성공률
  sabotageProbCoefByStat: 300, // 계략시 확률 가중치
  sabotageDefenceCoefByGeneralCnt: 0.04, // 인원수별 계략 방어 가중치
  sabotageDamageMin: 100, // 계략시 최소 수치 감소량
  sabotageDamageMax: 800, // 계략시 최대 수치 감소량

  // 나이
  adultAge: 14, // 성인 연령
  minPushHallAge: 40, // 명전 등록 가능 연령

  // 레벨
  maxDedLevel: 30, // 최대 계급
  maxTechLevel: 12, // 최대 기술 레벨

  // 성벽
  defaultCityWall: 1000, // 점령 후 일반 도시 성벽
  expandCityWallIncreaseAmount: 2000, // 증축시 성벽 증가량

  // 증축
  expandCityPopIncreaseAmount: 100000, // 증축시 인구 증가량
  expandCityDevelIncreaseAmount: 2000, // 증축시 내정 증가량
  expandCityDefaultCost: 60000, // 증축시 최소 비용
  expandCityCostCoef: 500, // 증축시 비용 계수

  // 국가
  initialNationGenLimit: 10, // 초기 제한시 장수 제한
  defaultMaxGeneral: 500, // 초기 최대 장수수
  defaultMaxNation: 55, // 초기 최대 국가 수
  defaultMaxGenius: 5, // 초기 최대 천재 수
  defaultStartYear: 180, // 초기 시작 년도

  // NPC
  joinRuinedNPCProp: 0.1, // 멸망한 NPC 장수의 임관 확률

  // 원조
  coefAidAmount: 10000, // 원조 계수
  maxResourceActionAmount: 10000, // 최대 개별 자원 금액

  // 기술
  techLevelIncYear: 5, // 기술등급 허용 증가 단위 년
  initialAllowedTechLevel: 1, // 초기 기술등급
};

/**
 * 계산 유틸리티
 */
export class GameCalc {
  /**
   * 값을 범위 내로 제한
   */
  static clamp(value: number, min: number, max?: number): number {
    if (max !== undefined) {
      return Math.max(min, Math.min(value, max));
    }
    return Math.max(min, value);
  }

  /**
   * 값을 0 이상으로 제한
   */
  static valueFit(value: number, min = 0, max?: number): number {
    return this.clamp(value, min, max);
  }

  /**
   * 반올림
   */
  static round(value: number, precision = 0): number {
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * 훈련 증가량 계산
   * PHP: leadership * 100 / crew * trainDelta
   */
  static calculateTrainIncrease(
    leadership: number,
    crew: number,
    currentTrain: number
  ): number {
    const score = this.clamp(
      this.round((leadership * 100) / crew * GameBalance.trainDelta),
      0,
      this.clamp(GameBalance.maxTrainByCommand - currentTrain, 0)
    );
    return score;
  }

  /**
   * 사기 증가량 계산
   * PHP: leadership * 100 / crew * atmosDelta
   */
  static calculateMoraleIncrease(
    leadership: number,
    crew: number,
    currentAtmos: number
  ): number {
    const score = this.clamp(
      this.round((leadership * 100) / crew * GameBalance.atmosDelta),
      0,
      this.clamp(GameBalance.maxAtmosByCommand - currentAtmos, 0)
    );
    return score;
  }

  /**
   * 훈련 부작용 (사기 감소)
   */
  static calculateTrainSideEffect(atmos: number): number {
    return this.valueFit(Math.floor(atmos * GameBalance.atmosSideEffectByTraining), 0);
  }

  /**
   * 사기 부작용 (훈련 감소)
   */
  static calculateMoraleSideEffect(train: number): number {
    return this.valueFit(Math.floor(train * GameBalance.trainSideEffectByAtmosTurn), 0);
  }

  /**
   * 징병/모병 비용 계산
   * PHP: unitCost * amount / 100
   */
  static calculateRecruitCost(
    unitCost: number,
    amount: number,
    costOffset: number = 1
  ): number {
    return this.round(unitCost * amount / 100 * costOffset);
  }

  /**
   * 징병/모병 군량 비용 계산
   */
  static calculateRecruitRice(amount: number): number {
    return this.round(amount / 100);
  }

  /**
   * 최대 징병/모병 가능 병사 수
   * PHP: leadership * 100
   */
  static calculateMaxCrew(leadership: number, currentCrew: number = 0, sameType: boolean = false): number {
    const maxCrew = leadership * 100;
    return sameType ? maxCrew - currentCrew : maxCrew;
  }

  /**
   * 징병/모병 후 평균 훈련치 계산
   * PHP: (currCrew * currTrain + reqCrew * setTrain) / (currCrew + reqCrew)
   */
  static calculateAverageTrain(
    currentCrew: number,
    currentTrain: number,
    newCrew: number,
    newTrain: number
  ): number {
    return (currentCrew * currentTrain + newCrew * newTrain) / (currentCrew + newCrew);
  }

  /**
   * 징병/모병 후 평균 사기 계산
   */
  static calculateAverageAtmos(
    currentCrew: number,
    currentAtmos: number,
    newCrew: number,
    newAtmos: number
  ): number {
    return (currentCrew * currentAtmos + newCrew * newAtmos) / (currentCrew + newCrew);
  }

  /**
   * 징병 인구 감소량
   * PHP: reqCrew (그대로 사용)
   */
  static calculatePopulationDecrease(reqCrew: number): number {
    return reqCrew;
  }

  /**
   * 징병 민심 감소량
   * PHP: (reqCrewDown / pop) * 100 / costOffset
   */
  static calculateTrustDecrease(
    currentTrust: number,
    reqCrew: number,
    population: number,
    costOffset: number = 1
  ): number {
    const decrease = (reqCrew / population) / costOffset * 100;
    return this.valueFit(currentTrust - decrease, 0);
  }
}
