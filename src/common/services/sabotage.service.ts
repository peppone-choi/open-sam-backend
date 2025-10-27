import { GameBalance } from '../constants/game-balance';

/**
 * RNG 인터페이스
 */
export interface RNG {
  randInt(min: number, max: number): number;
  random(): number;
}

/**
 * 계략 서비스
 * 
 * 계략 성공률 및 피해량 계산
 */
export class SabotageService {
  /**
   * 계략 성공 확률 계산
   * 
   * prob = baseProb + attackBonus - defenseBonus
   * baseProb = 0.35
   * attackBonus = (attackerIntel - defenderIntel) / 300
   * defenseBonus = defenderCount × 0.04
   */
  static calculateSuccessProb(
    attackerIntel: number,
    defenderIntel: number,
    defenderCount: number
  ): number {
    const baseProb = GameBalance.sabotageDefaultProb;
    const attackBonus = (attackerIntel - defenderIntel) / GameBalance.sabotageProbCoefByStat;
    const defenseBonus = defenderCount * GameBalance.sabotageDefenceCoefByGeneralCnt;

    const prob = baseProb + attackBonus - defenseBonus;

    // 확률은 0~1 사이로 제한
    return Math.max(0, Math.min(1, prob));
  }

  /**
   * 계략 성공 여부 판정
   */
  static isSuccess(
    attackerIntel: number,
    defenderIntel: number,
    defenderCount: number,
    rng: RNG
  ): boolean {
    const prob = this.calculateSuccessProb(attackerIntel, defenderIntel, defenderCount);
    const roll = rng.random();
    return roll < prob;
  }

  /**
   * 계략 피해량 계산
   * 
   * damage = rand(100, 800)
   */
  static calculateDamage(rng: RNG): number {
    return rng.randInt(
      GameBalance.sabotageDamageMin,
      GameBalance.sabotageDamageMax
    );
  }

  /**
   * 계략 실패 시 부상 계산
   * 
   * injury = rand(10, 50)
   */
  static applyInjury(rng: RNG): number {
    return rng.randInt(10, 50);
  }

  /**
   * 평균 방어 지력 계산 (도시 내 장수들)
   */
  static calculateAverageDefenderIntel(defenders: Array<{ intel: number }>): number {
    if (defenders.length === 0) {
      return 0;
    }

    const totalIntel = defenders.reduce((sum, gen) => sum + gen.intel, 0);
    return totalIntel / defenders.length;
  }

  /**
   * 계략 비용
   */
  static getCost(): { gold: number; rice: number } {
    return {
      gold: 120,
      rice: 120,
    };
  }
}
