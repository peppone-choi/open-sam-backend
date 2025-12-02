/**
 * EventTrigger - 이벤트 트리거
 * 
 * PHP event_충차아이템소모.php 참조
 * 
 * 이벤트: 특수 아이템 소모 등 이벤트성 효과
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 충차 아이템 소모 트리거
// ============================================================================

/**
 * 충차 아이템 소모 트리거
 * PHP event_충차아이템소모.php 참조
 * 
 * 공성전에서 충차 사용 시 아이템 소모
 */
export class BatteringRamConsumeTrigger extends BaseTrigger {
  id = 'battering_ram_consume';
  name = '충차아이템소모';
  timing: TriggerTiming = 'after_attack';
  priority = TriggerPriority.END;
  
  condition(ctx: TriggerContext): boolean {
    const { self, oppose, battleState } = ctx;
    
    // 공성 유닛인지 확인
    if (self.unitType !== 'SIEGE') {
      return false;
    }
    
    // 상대가 성벽인지 확인
    const opponentTile = battleState.map[oppose.position.y]?.[oppose.position.x];
    if (!opponentTile || (opponentTile.type !== 'WALL' && opponentTile.type !== 'GATE')) {
      return false;
    }
    
    // 충차 아이템 보유 확인 (실제로는 아이템 시스템과 연동)
    // if (!hasItem(self, 'battering_ram')) return false;
    
    return false;  // 아이템 시스템 연동 전까지 비활성화
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv } = ctx;
    
    // 충차 아이템 소모
    selfEnv.custom['consumedItem'] = 'battering_ram';
    
    return this.triggered({
      effects: ['충차 1개 소모'],
    });
  }
}

// ============================================================================
// 화살 소모 트리거
// ============================================================================

/**
 * 화살 소모 트리거
 * 궁병 공격 시 화살 소모
 */
export class ArrowConsumeTrigger extends BaseTrigger {
  id = 'arrow_consume';
  name = '화살소모';
  timing: TriggerTiming = 'after_attack';
  priority = TriggerPriority.END + 1;
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 궁병인지 확인
    if (self.unitType !== 'ARCHER') {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, self } = ctx;
    
    // 화살 소모량 계산 (병력 기반)
    const arrowConsume = Math.ceil(self.troops / 100);
    
    // 환경 변수로 전달
    selfEnv.custom['arrowConsume'] = (selfEnv.custom['arrowConsume'] || 0) + arrowConsume;
    
    return this.triggered();
  }
}

// ============================================================================
// 식량 소모 트리거
// ============================================================================

/**
 * 식량 소모 트리거
 * 전투 시 식량 소모
 */
export class RationConsumeTrigger extends BaseTrigger {
  id = 'ration_consume';
  name = '식량소모';
  timing: TriggerTiming = 'on_phase_end';
  priority = TriggerPriority.END + 2;
  
  // 페이즈당 기본 식량 소모 (병력 1000당)
  private readonly BASE_RATION_PER_1000 = 1;
  
  condition(ctx: TriggerContext): boolean {
    return true;  // 항상 실행
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, self } = ctx;
    
    // 식량 소모량 계산
    const rationConsume = Math.ceil(self.troops / 1000) * this.BASE_RATION_PER_1000;
    
    // 환경 변수로 전달
    selfEnv.custom['rationConsume'] = (selfEnv.custom['rationConsume'] || 0) + rationConsume;
    
    // 현재 식량에서 차감
    const currentRice = selfEnv.custom['rice'] || 0;
    selfEnv.custom['rice'] = Math.max(0, currentRice - rationConsume);
    
    return this.triggered({
      riceChange: -rationConsume,
    });
  }
}

// ============================================================================
// 사기 감소 트리거
// ============================================================================

/**
 * 페이즈 종료 시 사기 감소
 */
export class MoraleLossTrigger extends BaseTrigger {
  id = 'morale_loss';
  name = '사기감소';
  timing: TriggerTiming = 'on_phase_end';
  priority = TriggerPriority.POST + 700;
  
  condition(ctx: TriggerContext): boolean {
    const { opposeEnv } = ctx;
    
    // 사기 감소 효과가 있는지 확인
    return (opposeEnv.custom['moraleReduction'] || 0) > 0;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { opposeEnv, oppose } = ctx;
    
    const moraleReduction = opposeEnv.custom['moraleReduction'] || 0;
    
    // 실제 사기 감소 적용 (최소 0)
    opposeEnv.custom['morale'] = Math.max(0, (oppose.morale || 100) - moraleReduction);
    
    // 플래그 초기화
    opposeEnv.custom['moraleReduction'] = 0;
    
    return this.triggered({
      effects: [`사기 -${moraleReduction}`],
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const eventTriggers = [
  new BatteringRamConsumeTrigger(),
  new ArrowConsumeTrigger(),
  new RationConsumeTrigger(),
  new MoraleLossTrigger(),
];


