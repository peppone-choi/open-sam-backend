import { GameBalance, GameCalc } from '../constants/game-balance';

/**
 * 군사 서비스
 * 
 * 군사 관련 계산 (최대 병력, 징병/모병 비용, 평균 훈련도/사기 등)
 */
export class MilitaryService {
  /**
   * 최대 병력 계산
   * 
   * maxCrew = leadership × 100
   * 같은 병종이면 현재 병력을 제외
   */
  static calculateMaxCrew(
    leadership: number,
    currentCrew: number = 0,
    sameType: boolean = false
  ): number {
    return GameCalc.calculateMaxCrew(leadership, currentCrew, sameType);
  }

  /**
   * 징병/모병 금 비용 계산
   * 
   * cost = unitCost × amount / 100 × costOffset × (1 - tech × 0.01)
   * costOffset: 징병=1, 모병=2
   */
  static calculateRecruitCost(
    unitCost: number,
    amount: number,
    tech: number = 0,
    costOffset: number = 1
  ): number {
    // 기술에 따른 비용 감소 (기술 1당 1% 감소)
    const techDiscount = 1 - (tech * 0.01);
    const baseCost = GameCalc.calculateRecruitCost(unitCost, amount, costOffset);
    return Math.round(baseCost * techDiscount);
  }

  /**
   * 징병/모병 쌀 비용 계산
   * 
   * rice = amount / 100
   */
  static calculateRecruitRice(amount: number): number {
    return GameCalc.calculateRecruitRice(amount);
  }

  /**
   * 평균 훈련도 계산
   * 
   * newTrain = (currCrew × currTrain + newCrew × newTrain) / (currCrew + newCrew)
   */
  static calculateAverageTrain(
    currentCrew: number,
    currentTrain: number,
    newCrew: number,
    newTrain: number
  ): number {
    if (currentCrew + newCrew === 0) {
      return newTrain;
    }
    return GameCalc.calculateAverageTrain(currentCrew, currentTrain, newCrew, newTrain);
  }

  /**
   * 평균 사기 계산
   * 
   * newAtmos = (currCrew × currAtmos + newCrew × newAtmos) / (currCrew + newCrew)
   */
  static calculateAverageAtmos(
    currentCrew: number,
    currentAtmos: number,
    newCrew: number,
    newAtmos: number
  ): number {
    if (currentCrew + newCrew === 0) {
      return newAtmos;
    }
    return GameCalc.calculateAverageAtmos(currentCrew, currentAtmos, newCrew, newAtmos);
  }

  /**
   * 인구 감소량 계산
   */
  static calculatePopulationDecrease(amount: number): number {
    return GameCalc.calculatePopulationDecrease(amount);
  }

  /**
   * 민심 감소량 계산
   * 
   * decrease = (amount / population) / costOffset × 100
   */
  static calculateTrustDecrease(
    currentTrust: number,
    amount: number,
    population: number,
    costOffset: number = 1
  ): number {
    return GameCalc.calculateTrustDecrease(currentTrust, amount, population, costOffset);
  }

  /**
   * 훈련도 증가 계산
   */
  static calculateTrainIncrease(
    leadership: number,
    crew: number,
    currentTrain: number
  ): number {
    return GameCalc.calculateTrainIncrease(leadership, crew, currentTrain);
  }

  /**
   * 사기 증가 계산
   */
  static calculateMoraleIncrease(
    leadership: number,
    crew: number,
    currentAtmos: number
  ): number {
    return GameCalc.calculateMoraleIncrease(leadership, crew, currentAtmos);
  }

  /**
   * 훈련 부작용 (사기 감소)
   */
  static calculateTrainSideEffect(atmos: number): number {
    return GameCalc.calculateTrainSideEffect(atmos);
  }

  /**
   * 사기 부작용 (훈련 감소)
   */
  static calculateMoraleSideEffect(train: number): number {
    return GameCalc.calculateMoraleSideEffect(train);
  }

  /**
   * 사기진작 금 비용
   * 
   * cost = crew / 100 (반올림)
   */
  static calculateMoraleCost(crew: number): number {
    return Math.round(crew / 100);
  }
}
