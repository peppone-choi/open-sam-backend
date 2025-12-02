/**
 * StatModifierTrigger - 능력치/전투력 보정 트리거
 * 
 * PHP 능력치변경.php, 전투력보정.php 참조
 * 
 * 능력치 보정: 특기/아이템/상황에 따른 능력치 및 전투력 변경
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 능력치 변경 트리거
// ============================================================================

/**
 * 능력치 변경 트리거
 * PHP 능력치변경.php 참조
 * 
 * 전투 시작 시 특기에 따른 능력치 보정
 */
export class StatModifierTrigger extends BaseTrigger {
  id = 'stat_modifier';
  name = '능력치변경';
  timing: TriggerTiming = 'before_battle';
  priority = TriggerPriority.BEGIN + 10;
  
  /**
   * 능력치 보정 특기
   */
  private readonly STAT_MODIFIERS: Record<string, {
    strength?: number;
    intelligence?: number;
    leadership?: number;
    condition?: (ctx: TriggerContext) => boolean;
  }> = {
    '용맹': {
      strength: 5,
    },
    '지략': {
      intelligence: 5,
    },
    '통솔력': {
      leadership: 5,
    },
    '만능': {
      strength: 3,
      intelligence: 3,
      leadership: 3,
    },
    '분노': {
      strength: 10,
      condition: (ctx) => ctx.selfEnv.injury > 0,  // 부상 시만 적용
    },
    '냉정': {
      intelligence: 10,
      condition: (ctx) => ctx.phase === 0,  // 첫 페이즈만
    },
  };
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    if (!self.skills) return false;
    
    return self.skills.some(skill => this.STAT_MODIFIERS[skill]);
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, selfEnv } = ctx;
    
    const effects: string[] = [];
    
    if (self.skills) {
      for (const skill of self.skills) {
        const modifier = this.STAT_MODIFIERS[skill];
        if (!modifier) continue;
        
        // 조건 체크
        if (modifier.condition && !modifier.condition(ctx)) continue;
        
        // 능력치 보정 적용 (환경 변수로 전달)
        if (modifier.strength) {
          selfEnv.custom['strengthBonus'] = (selfEnv.custom['strengthBonus'] || 0) + modifier.strength;
          effects.push(`무력 +${modifier.strength}`);
        }
        if (modifier.intelligence) {
          selfEnv.custom['intelligenceBonus'] = (selfEnv.custom['intelligenceBonus'] || 0) + modifier.intelligence;
          effects.push(`지력 +${modifier.intelligence}`);
        }
        if (modifier.leadership) {
          selfEnv.custom['leadershipBonus'] = (selfEnv.custom['leadershipBonus'] || 0) + modifier.leadership;
          effects.push(`통솔 +${modifier.leadership}`);
        }
      }
    }
    
    if (effects.length === 0) {
      return this.notTriggered();
    }
    
    return this.triggered({
      effects,
    });
  }
}

// ============================================================================
// 전투력 보정 트리거
// ============================================================================

/**
 * 전투력 보정 트리거
 * PHP 전투력보정.php 참조
 */
export class WarPowerModifierTrigger extends BaseTrigger {
  id = 'war_power_modifier';
  name = '전투력보정';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.NORMAL;
  
  /**
   * 전투력 보정 특기
   */
  private readonly POWER_MODIFIERS: Record<string, {
    attackMult?: number;
    defenseMult?: number;
    condition?: (ctx: TriggerContext) => boolean;
  }> = {
    '공격강화': {
      attackMult: 1.1,
    },
    '방어강화': {
      defenseMult: 1.1,
    },
    '야전': {
      attackMult: 1.15,
      condition: (ctx) => ctx.battleState.map[ctx.self.position.y]?.[ctx.self.position.x]?.type === 'PLAIN',
    },
    '산악전': {
      attackMult: 1.2,
      defenseMult: 1.2,
      condition: (ctx) => {
        const type = ctx.battleState.map[ctx.self.position.y]?.[ctx.self.position.x]?.type;
        return type === 'HILL_LOW' || type === 'HILL_MID' || type === 'HILL_HIGH';
      },
    },
    '수전': {
      attackMult: 1.2,
      defenseMult: 1.15,
      condition: (ctx) => {
        const type = ctx.battleState.map[ctx.self.position.y]?.[ctx.self.position.x]?.type;
        return type === 'SHALLOW_WATER' || type === 'DEEP_WATER';
      },
    },
    '공성': {
      attackMult: 1.3,
      condition: (ctx) => {
        const type = ctx.battleState.map[ctx.oppose.position.y]?.[ctx.oppose.position.x]?.type;
        return type === 'WALL' || type === 'GATE' || type === 'TOWER';
      },
    },
    '수성': {
      defenseMult: 1.3,
      condition: (ctx) => {
        const type = ctx.battleState.map[ctx.self.position.y]?.[ctx.self.position.x]?.type;
        return type === 'WALL' || type === 'GATE' || type === 'TOWER';
      },
    },
  };
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    if (!self.skills) return false;
    
    return self.skills.some(skill => this.POWER_MODIFIERS[skill]);
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, selfEnv, opposeEnv } = ctx;
    
    let totalAttackMult = 1.0;
    let totalDefenseMult = 1.0;
    const effects: string[] = [];
    
    if (self.skills) {
      for (const skill of self.skills) {
        const modifier = this.POWER_MODIFIERS[skill];
        if (!modifier) continue;
        
        // 조건 체크
        if (modifier.condition && !modifier.condition(ctx)) continue;
        
        if (modifier.attackMult) {
          totalAttackMult *= modifier.attackMult;
          effects.push(`${skill} 공격력 ${Math.round((modifier.attackMult - 1) * 100)}%↑`);
        }
        if (modifier.defenseMult) {
          totalDefenseMult *= modifier.defenseMult;
          effects.push(`${skill} 방어력 ${Math.round((modifier.defenseMult - 1) * 100)}%↑`);
        }
      }
    }
    
    if (totalAttackMult === 1.0 && totalDefenseMult === 1.0) {
      return this.notTriggered();
    }
    
    // 공격력 배율 적용
    if (totalAttackMult !== 1.0) {
      selfEnv.warPowerMultiplier *= totalAttackMult;
    }
    
    // 방어력 배율 적용 (상대 전투력 감소)
    if (totalDefenseMult !== 1.0) {
      opposeEnv.warPowerMultiplier /= totalDefenseMult;
    }
    
    return this.triggered({
      damageMultiplier: totalAttackMult,
      defenseMultiplier: totalDefenseMult,
      effects,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const statModifierTriggers = [
  new StatModifierTrigger(),
  new WarPowerModifierTrigger(),
];


