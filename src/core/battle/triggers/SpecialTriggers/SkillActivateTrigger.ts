/**
 * SkillActivateTrigger - 스킬 활성화 트리거
 * 
 * PHP WarActivateSkills.php 참조
 * 
 * 전투 시작 시 특기/아이템에 따른 스킬 자동 활성화
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
  BattleEnvironment,
} from '../TriggerManager';
import { BattleUnit3D } from '../../types';

// ============================================================================
// 스킬 활성화 트리거
// ============================================================================

/**
 * 스킬 활성화 트리거
 * PHP WarActivateSkills.php 참조
 * 
 * 유닛의 특기/아이템에 따라 전투 스킬 자동 활성화
 */
export class SkillActivateTrigger extends BaseTrigger {
  id = 'skill_activate';
  name = '스킬활성화';
  timing: TriggerTiming = 'before_battle';
  priority = TriggerPriority.BEGIN;
  
  /**
   * 특기 -> 전투 스킬 매핑
   */
  private readonly SKILL_MAPPING: Record<string, string[]> = {
    // 공격 특기
    '필살': ['필살'],
    '저격': ['저격'],
    '선제': ['선제'],
    '돌격': ['돌격'],
    '약탈': ['약탈'],
    
    // 방어 특기
    '회피': ['회피'],
    '저지': ['저지'],
    '철벽': ['방어력증가'],
    
    // 계략 특기
    '계략': ['계략'],
    '반계': ['반계'],
    '위압': ['위압'],
    
    // 특수 특기
    '격노': ['격노'],
    '진노': ['격노', '진노'],
    '치료': ['치료'],
    '부상무효': ['부상무효'],
    
    // 불가 특기 (상대에게 부여)
    '필살무효': ['필살불가'],
    '회피무효': ['회피불가'],
    '계략무효': ['계략불가'],
  };
  
  condition(ctx: TriggerContext): boolean {
    return true;  // 항상 실행
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, selfEnv } = ctx;
    
    const activatedSkills: string[] = [];
    
    // 유닛의 모든 특기에 대해 스킬 매핑 적용
    if (self.skills) {
      for (const skill of self.skills) {
        const mappedSkills = this.SKILL_MAPPING[skill];
        if (mappedSkills) {
          for (const ms of mappedSkills) {
            if (!selfEnv.activatedSkills.has(ms)) {
              selfEnv.activatedSkills.add(ms);
              activatedSkills.push(ms);
            }
          }
        }
      }
    }
    
    // 버프에서 스킬 활성화
    if (self.buffs) {
      for (const buff of self.buffs) {
        const mappedSkills = this.SKILL_MAPPING[buff.type];
        if (mappedSkills) {
          for (const ms of mappedSkills) {
            if (!selfEnv.activatedSkills.has(ms)) {
              selfEnv.activatedSkills.add(ms);
              activatedSkills.push(ms);
            }
          }
        }
      }
    }
    
    if (activatedSkills.length === 0) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: activatedSkills,
    });
  }
}

// ============================================================================
// 상대 스킬 비활성화 트리거
// ============================================================================

/**
 * 상대 스킬 비활성화 트리거
 * 특정 특기가 상대의 스킬을 막음
 */
export class OpponentSkillDeactivateTrigger extends BaseTrigger {
  id = 'opponent_skill_deactivate';
  name = '상대스킬비활성화';
  timing: TriggerTiming = 'before_battle';
  priority = TriggerPriority.BEGIN + 1;
  
  /**
   * 특기 -> 상대 비활성화 스킬 매핑
   */
  private readonly DEACTIVATE_MAPPING: Record<string, string[]> = {
    '필살무효': ['필살'],
    '회피무효': ['회피'],
    '계략무효': ['계략'],
    '저격무효': ['저격'],
    '선제무효': ['선제'],
  };
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 무효화 특기 보유 확인
    if (!self.skills) return false;
    
    return self.skills.some(skill => this.DEACTIVATE_MAPPING[skill]);
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, opposeEnv } = ctx;
    
    const deactivatedSkills: string[] = [];
    
    if (self.skills) {
      for (const skill of self.skills) {
        const mappedSkills = this.DEACTIVATE_MAPPING[skill];
        if (mappedSkills) {
          for (const ms of mappedSkills) {
            const disableSkill = ms + '불가';
            if (!opposeEnv.activatedSkills.has(disableSkill)) {
              opposeEnv.activatedSkills.add(disableSkill);
              deactivatedSkills.push(ms);
            }
          }
        }
      }
    }
    
    if (deactivatedSkills.length === 0) {
      return this.notTriggered();
    }
    
    return this.triggered({
      effects: deactivatedSkills.map(s => `상대 ${s} 봉인`),
    });
  }
}

// ============================================================================
// 아이템 효과 트리거
// ============================================================================

/**
 * 아이템 효과 트리거
 * 특정 아이템에서 스킬 활성화
 */
export class ItemEffectTrigger extends BaseTrigger {
  id = 'item_effect';
  name = '아이템효과';
  timing: TriggerTiming = 'before_battle';
  priority = TriggerPriority.BEGIN + 2;
  
  // 아이템 ID -> 활성화 스킬 매핑 (실제로는 아이템 시스템과 연동)
  private readonly ITEM_SKILLS: Record<string, string[]> = {
    'golden_armor': ['부상무효', '방어력증가'],
    'phoenix_feather': ['치료'],
    'tiger_amulet': ['격노'],
    'dragon_spear': ['필살', '필살강화'],
  };
  
  condition(ctx: TriggerContext): boolean {
    // 아이템 시스템과 연동 필요
    return false;  // 기본적으로 비활성화
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    // 아이템 시스템 연동 시 구현
    return this.notTriggered();
  }
}

// ============================================================================
// Export
// ============================================================================

export const skillActivateTriggers = [
  new SkillActivateTrigger(),
  new OpponentSkillDeactivateTrigger(),
  new ItemEffectTrigger(),
];


