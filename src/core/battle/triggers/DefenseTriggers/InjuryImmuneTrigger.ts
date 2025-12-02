/**
 * InjuryImmuneTrigger - 부상 무효 트리거
 * 
 * PHP che_부상무효.php, che_성벽부상무효.php, che_퇴각부상무효.php 참조
 * 
 * 부상 무효: 전투 중 부상을 입지 않음
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 부상 무효 트리거
// ============================================================================

/**
 * 부상 무효 트리거
 * PHP che_부상무효.php 참조
 * 
 * 특정 아이템/특기 보유 시 부상 무효
 */
export class InjuryImmuneTrigger extends BaseTrigger {
  id = 'injury_immune';
  name = '부상무효';
  timing: TriggerTiming = 'before_battle';
  priority = TriggerPriority.BEGIN + 200;
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 부상무효 아이템이나 특기 보유 확인
    // 실제로는 아이템/특기 시스템과 연동
    if (self.skills?.includes('부상무효')) {
      return true;
    }
    
    // 특정 아이템 체크 (예: 황금갑옷)
    // if (hasItem(self, 'golden_armor')) return true;
    
    return false;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    return this.triggered({
      activateSkills: ['부상무효'],
    });
  }
}

// ============================================================================
// 성벽 부상 무효 트리거
// ============================================================================

/**
 * 성벽 부상 무효 트리거
 * PHP che_성벽부상무효.php 참조
 * 
 * 성벽 위에서 전투 시 부상 무효
 */
export class WallInjuryImmuneTrigger extends BaseTrigger {
  id = 'wall_injury_immune';
  name = '성벽부상무효';
  timing: TriggerTiming = 'before_battle';
  priority = TriggerPriority.BEGIN + 201;
  
  condition(ctx: TriggerContext): boolean {
    const { self, battleState } = ctx;
    
    // 성벽 위에 있는지 확인
    const tile = battleState.map[self.position.y]?.[self.position.x];
    if (!tile) return false;
    
    // WALL 또는 TOWER 위에 있으면 부상무효
    return tile.type === 'WALL' || tile.type === 'TOWER';
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    return this.triggered({
      activateSkills: ['부상무효'],
      selfMessage: `성벽 위에서 전투 중 (부상 무효)`,
    });
  }
}

// ============================================================================
// 퇴각 부상 무효 트리거
// ============================================================================

/**
 * 퇴각 부상 무효 트리거
 * PHP che_퇴각부상무효.php 참조
 * 
 * 퇴각 시 부상 무효
 */
export class RetreatInjuryImmuneTrigger extends BaseTrigger {
  id = 'retreat_injury_immune';
  name = '퇴각부상무효';
  timing: TriggerTiming = 'on_retreat';
  priority = TriggerPriority.BEGIN + 202;
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 퇴각무효 특기 보유 확인
    if (self.skills?.includes('퇴각무효')) {
      return true;
    }
    
    return false;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    return this.triggered({
      activateSkills: ['부상무효'],
      selfMessage: `안전하게 퇴각 (부상 무효)`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const injuryImmuneTriggers = [
  new InjuryImmuneTrigger(),
  new WallInjuryImmuneTrigger(),
  new RetreatInjuryImmuneTrigger(),
];


