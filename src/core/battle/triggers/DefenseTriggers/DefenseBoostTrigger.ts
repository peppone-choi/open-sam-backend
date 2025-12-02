/**
 * DefenseBoostTrigger - 방어력 증가 트리거
 * 
 * PHP che_방어력증가5p.php 참조
 * 
 * 방어력 증가: 특정 조건에서 방어력 증가
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 방어력 5% 증가 트리거
// ============================================================================

/**
 * 방어력 5% 증가 트리거
 * PHP che_방어력증가5p.php 참조
 */
export class DefenseBoost5pTrigger extends BaseTrigger {
  id = 'defense_boost_5p';
  name = '방어력증가5p';
  timing: TriggerTiming = 'before_defense';
  priority = TriggerPriority.BEGIN + 100;
  
  // 방어력 증가율
  private readonly DEFENSE_BOOST = 0.05;  // 5%
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 방어력증가 특기 보유 확인
    if (self.skills?.includes('방어력증가')) {
      return true;
    }
    
    // 특정 진형 또는 아이템 체크
    // if (hasFormation(self, 'defensive')) return true;
    
    return false;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { opposeEnv } = ctx;
    
    // 상대 전투력 감소 (= 방어력 증가 효과)
    opposeEnv.warPowerMultiplier *= (1 - this.DEFENSE_BOOST);
    
    return this.triggered({
      defenseMultiplier: 1 + this.DEFENSE_BOOST,
    });
  }
}

// ============================================================================
// 방어력 10% 증가 트리거
// ============================================================================

/**
 * 방어력 10% 증가 트리거
 * 강화 버전
 */
export class DefenseBoost10pTrigger extends BaseTrigger {
  id = 'defense_boost_10p';
  name = '방어력증가10p';
  timing: TriggerTiming = 'before_defense';
  priority = TriggerPriority.BEGIN + 101;
  
  private readonly DEFENSE_BOOST = 0.10;  // 10%
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 강화 방어 특기 보유 확인
    if (self.skills?.includes('철벽')) {
      return true;
    }
    
    return false;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { opposeEnv } = ctx;
    
    opposeEnv.warPowerMultiplier *= (1 - this.DEFENSE_BOOST);
    
    return this.triggered({
      defenseMultiplier: 1 + this.DEFENSE_BOOST,
      selfMessage: `<C>철벽</> 방어! (방어력 10% 증가)`,
    });
  }
}

// ============================================================================
// 지형 기반 방어력 증가 트리거
// ============================================================================

/**
 * 지형 기반 방어력 증가
 * 고지대, 성벽 등에서 방어력 보너스
 */
export class TerrainDefenseBoostTrigger extends BaseTrigger {
  id = 'terrain_defense_boost';
  name = '지형방어증가';
  timing: TriggerTiming = 'before_defense';
  priority = TriggerPriority.BEGIN + 50;
  
  // 지형별 방어 보너스
  private readonly TERRAIN_BONUS: Record<string, number> = {
    'HILL_LOW': 0.05,
    'HILL_MID': 0.10,
    'HILL_HIGH': 0.15,
    'WALL': 0.25,
    'TOWER': 0.30,
    'GATE': 0.15,
  };
  
  condition(ctx: TriggerContext): boolean {
    const { self, battleState } = ctx;
    
    const tile = battleState.map[self.position.y]?.[self.position.x];
    if (!tile) return false;
    
    return this.TERRAIN_BONUS[tile.type] !== undefined;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, battleState, opposeEnv } = ctx;
    
    const tile = battleState.map[self.position.y][self.position.x];
    const bonus = this.TERRAIN_BONUS[tile.type] || 0;
    
    opposeEnv.warPowerMultiplier *= (1 - bonus);
    
    return this.triggered({
      defenseMultiplier: 1 + bonus,
      selfMessage: `지형 효과로 방어력 ${Math.round(bonus * 100)}% 증가`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const defenseBoostTriggers = [
  new DefenseBoost5pTrigger(),
  new DefenseBoost10pTrigger(),
  new TerrainDefenseBoostTrigger(),
];


