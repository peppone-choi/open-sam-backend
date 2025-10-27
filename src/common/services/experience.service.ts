import { GameBalance, GameCalc } from '../constants/game-balance';

/**
 * 장수 인터페이스 (경험치 관련 필드)
 */
export interface GeneralForExp {
  exp: number;
  ded: number;
  leadership_exp: number;
  strength_exp: number;
  intel_exp: number;
  leadership: number;
  strength: number;
  intel: number;
}

/**
 * 경험치 서비스
 * 
 * 장수의 경험치, 공헌도, 능력치 경험치 계산 및 적용
 */
export class ExperienceService {
  /**
   * 내정 커맨드 경험치 적용
   */
  static applyDomestic(
    general: GeneralForExp,
    score: number,
    statType: 'leadership' | 'strength' | 'intel'
  ): void {
    // 경험치: 점수의 70%
    general.exp += Math.round(score * 0.7);

    // 공헌도: 점수 그대로
    general.ded += score;

    // 능력치 경험치: +1
    this.addStatExp(general, statType, 1);

    // 능력치 상승 체크
    this.checkStatIncrease(general);
  }

  /**
   * 군사 커맨드 경험치 적용 (훈련, 사기진작)
   */
  static applyMilitary(
    general: GeneralForExp,
    baseExp: number,
    baseDed: number,
    statType: 'leadership'
  ): void {
    general.exp += baseExp;
    general.ded += baseDed;
    this.addStatExp(general, statType, 1);
    this.checkStatIncrease(general);
  }

  /**
   * 징병/모병 경험치 적용
   */
  static applyRecruit(
    general: GeneralForExp,
    crewAmount: number
  ): void {
    const exp = Math.round(crewAmount / 100);
    general.exp += exp;
    general.ded += exp;
    this.addStatExp(general, 'leadership', 1);
    this.checkStatIncrease(general);
  }

  /**
   * 이동 경험치 적용
   */
  static applyMovement(
    general: GeneralForExp,
    isForced: boolean
  ): void {
    const exp = isForced ? 100 : 50;
    general.exp += exp;
    this.addStatExp(general, 'leadership', 1);
    this.checkStatIncrease(general);
  }

  /**
   * 계략 경험치 적용
   */
  static applySabotage(
    general: GeneralForExp,
    statType: 'intel' | 'strength'
  ): void {
    general.exp += 150;
    general.ded += 100;
    this.addStatExp(general, statType, 1);
    this.checkStatIncrease(general);
  }

  /**
   * 능력치 경험치 추가
   */
  private static addStatExp(
    general: GeneralForExp,
    statType: 'leadership' | 'strength' | 'intel',
    amount: number
  ): void {
    switch (statType) {
      case 'leadership':
        general.leadership_exp += amount;
        break;
      case 'strength':
        general.strength_exp += amount;
        break;
      case 'intel':
        general.intel_exp += amount;
        break;
    }
  }

  /**
   * 능력치 상승 체크 및 적용
   */
  private static checkStatIncrease(general: GeneralForExp): void {
    // 통솔 상승
    if (general.leadership_exp >= GameBalance.upgradeLimit) {
      general.leadership += 1;
      general.leadership_exp = 0;
    }

    // 무력 상승
    if (general.strength_exp >= GameBalance.upgradeLimit) {
      general.strength += 1;
      general.strength_exp = 0;
    }

    // 지력 상승
    if (general.intel_exp >= GameBalance.upgradeLimit) {
      general.intel += 1;
      general.intel_exp = 0;
    }
  }

  /**
   * 경험치 레벨에 따른 보너스 계산
   */
  static getExpLevelBonus(exp: number): number {
    // PHP 로직에 따라 구현 (단순화)
    // 실제 구현은 PHP 소스 확인 필요
    if (exp < 1000) return 1.0;
    if (exp < 5000) return 1.1;
    if (exp < 10000) return 1.2;
    if (exp < 50000) return 1.3;
    return 1.4;
  }
}
