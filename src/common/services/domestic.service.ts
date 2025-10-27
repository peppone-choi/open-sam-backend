import { GameCalc } from '../constants/game-balance';
import { ExperienceService } from './experience.service';

/**
 * 장수 인터페이스 (내정 관련)
 */
export interface GeneralForDomestic {
  leadership: number;
  strength: number;
  intel: number;
  experience: number;
}

/**
 * 도시 인터페이스 (내정 관련)
 */
export interface CityForDomestic {
  trust: number;
  front: boolean;
}

/**
 * 국가 인터페이스 (내정 관련)
 */
export interface NationForDomestic {
  tech?: number;
}

/**
 * RNG 인터페이스
 */
export interface RNG {
  randFloat(min: number, max: number): number;
  random(): number;
}

/**
 * 내정 서비스
 * 
 * 내정 커맨드의 점수 계산, 크리티컬 적용, 전선 디버프 등
 */
export class DomesticService {
  /**
   * 내정 점수 계산
   * 
   * baseScore = stat × trust/100 × expLevelBonus × rand(0.8~1.2)
   * criticalMultiplier = CriticalScoreEx(rng, CriticalRatioDomestic(general, statType))
   * finalScore = baseScore × criticalMultiplier × frontDebuff
   */
  static calculateScore(
    general: GeneralForDomestic,
    city: CityForDomestic,
    statType: 'leadership' | 'strength' | 'intel',
    rng: RNG,
    isCapital: boolean = false,
    frontDebuff: number = 1.0
  ): number {
    // 능력치 선택
    const stat = this.getStat(general, statType);

    // 경험치 레벨 보너스
    const expLevelBonus = ExperienceService.getExpLevelBonus(general.experience);

    // 기본 점수 = stat × trust/100 × expLevelBonus × rand(0.8~1.2)
    const baseScore = stat * (city.trust / 100) * expLevelBonus * rng.randFloat(0.8, 1.2);

    // 크리티컬 적용
    const criticalRatio = this.getCriticalRatio(general, statType);
    const criticalMultiplier = this.applyCritical(rng, criticalRatio);

    // 전선 디버프 적용
    const debuff = this.applyFrontDebuff(city, isCapital, frontDebuff);

    // 최종 점수
    const finalScore = baseScore * criticalMultiplier * debuff;

    return Math.round(finalScore);
  }

  /**
   * 능력치 선택
   */
  private static getStat(
    general: GeneralForDomestic,
    statType: 'leadership' | 'strength' | 'intel'
  ): number {
    switch (statType) {
      case 'leadership':
        return general.leadership;
      case 'strength':
        return general.strength;
      case 'intel':
        return general.intel;
    }
  }

  /**
   * 크리티컬 확률 계산
   * 
   * 능력치가 높을수록 크리티컬 확률 증가
   */
  static getCriticalRatio(
    general: GeneralForDomestic,
    statType: 'leadership' | 'strength' | 'intel'
  ): number {
    const stat = this.getStat(general, statType);
    
    // 능력치 기반 크리티컬 확률 (0~1)
    // 50: 0%, 100: 25%, 150: 50%
    const ratio = Math.min((stat - 50) / 200, 0.5);
    return Math.max(0, ratio);
  }

  /**
   * 크리티컬 배율 적용
   * 
   * 확률에 따라 ×3 (대성공), ×2 (성공), ×1 (보통) 중 하나
   */
  static applyCritical(rng: RNG, ratio: number): number {
    const roll = rng.random();

    // 대성공 (×3): ratio의 10%
    if (roll < ratio * 0.1) {
      return 3.0;
    }

    // 성공 (×2): ratio의 30%
    if (roll < ratio * 0.4) {
      return 2.0;
    }

    // 보통 (×1)
    return 1.0;
  }

  /**
   * 전선 디버프 적용
   * 
   * 수도가 아니고, 전선 도시인 경우 디버프 적용
   */
  static applyFrontDebuff(
    city: CityForDomestic,
    isCapital: boolean,
    debuff: number
  ): number {
    // 수도는 디버프 적용 안 함
    if (isCapital) {
      return 1.0;
    }

    // 전선이 아니면 디버프 적용 안 함
    if (!city.front) {
      return 1.0;
    }

    // 전선 디버프 적용
    return debuff;
  }

  /**
   * 국가 기술력 기반 점수 계산 (기술연구)
   */
  static calculateTechScore(
    general: GeneralForDomestic,
    nation: NationForDomestic,
    rng: RNG
  ): number {
    const intel = general.intel;
    const expLevelBonus = ExperienceService.getExpLevelBonus(general.experience);

    // 기술연구는 민심 대신 고정값 1.0 사용
    const baseScore = intel * 1.0 * expLevelBonus * rng.randFloat(0.8, 1.2);

    // 크리티컬 적용
    const criticalRatio = this.getCriticalRatio(general, 'intel');
    const criticalMultiplier = this.applyCritical(rng, criticalRatio);

    const finalScore = baseScore * criticalMultiplier;
    return Math.round(finalScore);
  }
}
