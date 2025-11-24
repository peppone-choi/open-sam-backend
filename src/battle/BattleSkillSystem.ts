/**
 * BattleSkillSystem - 전투 특기 시스템
 * 
 * PHP 참조: core/hwe/sammo/SpecialityHelper.php
 *          core/hwe/sammo/ActionSpecialWar/*.php
 * 
 * 전투 특기(special_war) 처리:
 * - 각 특기별 발동 조건
 * - 효과 적용
 * - 로그 메시지
 */

import { WarUnit } from './WarUnit';
import { WarUnitGeneral } from './WarUnitGeneral';
import { RandUtil } from '../utils/RandUtil';

/**
 * 전투 특기 타입
 */
export enum BattleSkillType {
  NONE = 'None',
  // 병종 특기
  FOOTMAN = 'che_보병',      // 보병
  ARCHER = 'che_궁병',        // 궁병
  CAVALRY = 'che_기병',       // 기병
  WIZARD = 'che_귀병',        // 귀병
  SIEGE = 'che_징병',         // 징병 (성벽)
  
  // 전투 특기
  CRITICAL = 'che_필살',      // 필살: 필살 확률 +30%p
  CHARGE = 'che_돌격',        // 돌격: 공격력 증가
  FORTIFY = 'che_견고',       // 견고: 방어력 증가
  SNIPE = 'che_저격',         // 저격: 적 회피율 감소
  INTIMIDATE = 'che_위압',    // 위압: 적 사기 감소
  RAGE = 'che_격노',          // 격노: 피해를 입으면 공격력 증가
  MUSOU = 'che_무쌍',         // 무쌍: 필살시 연속 공격
  COUNTER = 'che_반계',       // 반계: 계략에 대한 반격
  FOCUS = 'che_집중',         // 집중: 명중률 증가
  CAUTION = 'che_신중',       // 신중: 회피율 증가
  CALCULATION = 'che_신산',   // 신산: 필살 회피
  MEDICINE = 'che_의술',      // 의술: 부상 무효화
  EXORCISM = 'che_척사',      // 척사: 계략 무효화
  ILLUSION = 'che_환술',      // 환술: 회피율 대폭 증가
  SIEGE_ATTACK = 'che_공성',  // 공성: 성벽 공격력 증가
}

/**
 * 전투 특기 효과
 */
export interface BattleSkillEffect {
  skillName: string;
  activated: boolean;
  damageMultiplier?: number;
  defenceMultiplier?: number;
  criticalBonus?: number;
  avoidBonus?: number;
  message?: string;
}

/**
 * 전투 특기 시스템
 */
export class BattleSkillSystem {
  /**
   * 전투 특기 발동 체크 및 효과 적용
   * 
   * @param attacker 공격자
   * @param defender 수비자
   * @param rng 난수 생성기
   * @returns 적용된 특기 효과 목록
   */
  static processBattleSkills(
    attacker: WarUnit,
    defender: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect[] {
    const effects: BattleSkillEffect[] = [];

    if (!(attacker instanceof WarUnitGeneral) || !(defender instanceof WarUnitGeneral)) {
      return effects;
    }

    const attackerGeneral = attacker.getGeneral();
    const defenderGeneral = defender.getGeneral();

    // 공격자 특기 처리
    const attackerSkill = attackerGeneral.data?.special_war || attackerGeneral.special_war;
    if (attackerSkill) {
      const attackerEffect = this.applySkill(attackerSkill, attacker, defender, true, rng);
      if (attackerEffect) {
        effects.push(attackerEffect);
      }
    }

    // 수비자 특기 처리
    const defenderSkill = defenderGeneral.data?.special_war || defenderGeneral.special_war;
    if (defenderSkill) {
      const defenderEffect = this.applySkill(defenderSkill, defender, attacker, false, rng);
      if (defenderEffect) {
        effects.push(defenderEffect);
      }
    }

    return effects;
  }

  /**
   * 개별 특기 효과 적용
   */
  private static applySkill(
    skillName: string,
    unit: WarUnit,
    oppose: WarUnit,
    isAttacker: boolean,
    rng: RandUtil
  ): BattleSkillEffect | null {
    const general = unit.getGeneral();
    
    switch (skillName) {
      case BattleSkillType.CRITICAL: // 필살
        return this.applyCriticalSkill(unit, oppose, rng);
      
      case BattleSkillType.CHARGE: // 돌격
        return this.applyChargeSkill(unit, oppose, isAttacker, rng);
      
      case BattleSkillType.FORTIFY: // 견고
        return this.applyFortifySkill(unit, oppose, rng);
      
      case BattleSkillType.SNIPE: // 저격
        return this.applySnipeSkill(unit, oppose, rng);
      
      case BattleSkillType.INTIMIDATE: // 위압
        return this.applyIntimidateSkill(unit, oppose, rng);
      
      case BattleSkillType.RAGE: // 격노
        return this.applyRageSkill(unit, oppose, rng);
      
      case BattleSkillType.MUSOU: // 무쌍
        return this.applyMusouSkill(unit, oppose, rng);
      
      case BattleSkillType.CAUTION: // 신중
        return this.applyCautionSkill(unit, oppose, rng);
      
      case BattleSkillType.MEDICINE: // 의술
        return this.applyMedicineSkill(unit, oppose, rng);
      
      default:
        return null;
    }
  }

  /**
   * 필살 특기: 필살 확률 +30%p, 필살 발동시 회피 불가
   */
  private static applyCriticalSkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    const general = unit.getGeneral();
    const baseCritical = unit.getComputedCriticalRatio();
    
    // onCalcStat에서 이미 +30%p 적용되어 있음
    // 추가로 필살 발동 시 상대 회피 불가 처리
    if (rng.nextBool(baseCritical)) {
      unit.activateSkill('필살');
      oppose.activateSkill('필살피해_회피불가');
      
      return {
        skillName: '필살',
        activated: true,
        damageMultiplier: unit.criticalDamage(),
        message: `【필살】 ${unit.getName()}의 필살 공격!`
      };
    }
    
    return null;
  }

  /**
   * 돌격 특기: 기병으로 공격 시 공격력 +20%
   */
  private static applyChargeSkill(
    unit: WarUnit,
    oppose: WarUnit,
    isAttacker: boolean,
    rng: RandUtil
  ): BattleSkillEffect | null {
    if (!isAttacker) return null;
    
    const crewType = unit.getCrewType();
    if (crewType?.armType !== 3) return null; // 기병이 아니면 발동 안함
    
    // 20% 확률로 발동
    if (rng.nextBool(0.2)) {
      unit.activateSkill('돌격');
      unit.multiplyWarPowerMultiply(1.2);
      
      return {
        skillName: '돌격',
        activated: true,
        damageMultiplier: 1.2,
        message: `【돌격】 ${unit.getName()}의 맹렬한 돌격!`
      };
    }
    
    return null;
  }

  /**
   * 견고 특기: 방어 시 방어력 +15%
   */
  private static applyFortifySkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    // 15% 확률로 발동
    if (rng.nextBool(0.15)) {
      unit.activateSkill('견고');
      
      // 상대 공격력 감소
      oppose.multiplyWarPowerMultiply(0.85);
      
      return {
        skillName: '견고',
        activated: true,
        defenceMultiplier: 1.15,
        message: `【견고】 ${unit.getName()}의 견고한 방어!`
      };
    }
    
    return null;
  }

  /**
   * 저격 특기: 적 회피율 -50%
   */
  private static applySnipeSkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    // 10% 확률로 발동
    if (rng.nextBool(0.1)) {
      unit.activateSkill('저격');
      oppose.activateSkill('저격피해_회피감소');
      
      return {
        skillName: '저격',
        activated: true,
        message: `【저격】 ${unit.getName()}의 정확한 저격!`
      };
    }
    
    return null;
  }

  /**
   * 위압 특기: 적 사기 -10
   */
  private static applyIntimidateSkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    // 12% 확률로 발동
    if (rng.nextBool(0.12)) {
      unit.activateSkill('위압');
      
      // 상대 사기 감소
      oppose.addAtmosBonus(-10);
      
      return {
        skillName: '위압',
        activated: true,
        message: `【위압】 ${unit.getName()}의 위압에 ${oppose.getName()}의 사기가 떨어졌다!`
      };
    }
    
    return null;
  }

  /**
   * 격노 특기: 피해를 입으면 공격력 증가
   */
  private static applyRageSkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    const hp = unit.getHP();
    const maxHP = unit.getGeneral().data?.crew || hp;
    const hpRatio = hp / Math.max(1, maxHP);
    
    // HP가 50% 이하일 때 발동
    if (hpRatio <= 0.5 && rng.nextBool(0.2)) {
      unit.activateSkill('격노');
      
      // HP 손실에 비례하여 공격력 증가 (최대 +50%)
      const rageMultiplier = 1 + (1 - hpRatio) * 0.5;
      unit.multiplyWarPowerMultiply(rageMultiplier);
      
      return {
        skillName: '격노',
        activated: true,
        damageMultiplier: rageMultiplier,
        message: `【격노】 ${unit.getName()}이(가) 분노하여 강해졌다!`
      };
    }
    
    return null;
  }

  /**
   * 무쌍 특기: 필살 시 추가 페이즈
   */
  private static applyMusouSkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    // 필살이 발동했고 15% 확률로 무쌍 발동
    if (unit.hasActivatedSkill('필살') && rng.nextBool(0.15)) {
      unit.activateSkill('무쌍');
      unit.addBonusPhase(1);
      
      return {
        skillName: '무쌍',
        activated: true,
        message: `【무쌍】 ${unit.getName()}의 연속 공격!`
      };
    }
    
    return null;
  }

  /**
   * 신중 특기: 회피율 +10%p
   */
  private static applyCautionSkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    // 회피율 증가는 getComputedAvoidRatio에서 처리
    // 여기서는 로그만 기록
    if (rng.nextBool(0.05)) {
      unit.activateSkill('신중');
      
      return {
        skillName: '신중',
        activated: true,
        avoidBonus: 0.1,
        message: `【신중】 ${unit.getName()}이(가) 신중하게 움직인다!`
      };
    }
    
    return null;
  }

  /**
   * 의술 특기: 부상 무효화
   */
  private static applyMedicineSkill(
    unit: WarUnit,
    oppose: WarUnit,
    rng: RandUtil
  ): BattleSkillEffect | null {
    // 부상 시 50% 확률로 무효화
    if (rng.nextBool(0.5)) {
      unit.activateSkill('부상무효');
      
      return {
        skillName: '의술',
        activated: true,
        message: `【의술】 ${unit.getName()}의 부상을 치료했다!`
      };
    }
    
    return null;
  }

  /**
   * 전투 초기화 시 특기 효과 적용
   */
  static applyBattleInitSkills(attacker: WarUnit, defender: WarUnit, rng: RandUtil): void {
    // 특기 시스템의 초기화 처리
    // PHP의 getBattleInitSkillTriggerList에 해당
    
    if (attacker instanceof WarUnitGeneral) {
      const general = attacker.getGeneral();
      if (typeof general.getBattleInitSkillTriggerList === 'function') {
        const triggers = general.getBattleInitSkillTriggerList(attacker);
        // Trigger 실행 (추후 구현)
      }
    }
    
    if (defender instanceof WarUnitGeneral) {
      const general = defender.getGeneral();
      if (typeof general.getBattleInitSkillTriggerList === 'function') {
        const triggers = general.getBattleInitSkillTriggerList(defender);
        // Trigger 실행 (추후 구현)
      }
    }
  }

  /**
   * 전투 페이즈마다 특기 효과 적용
   */
  static applyBattlePhaseSkills(attacker: WarUnit, defender: WarUnit, rng: RandUtil): void {
    // 특기 시스템의 페이즈 처리
    // PHP의 getBattlePhaseSkillTriggerList에 해당
    
    const effects = this.processBattleSkills(attacker, defender, rng);
    
    // 로그 출력
    for (const effect of effects) {
      if (effect.activated && effect.message) {
        attacker.getLogger()?.pushGeneralBattleDetailLog?.(effect.message);
        defender.getLogger()?.pushGeneralBattleDetailLog?.(effect.message);
      }
    }
  }
}
