import { ResourceBag } from '../@types/archetype.types';
import { ScenarioId } from '../@types/role.types';
import { ResourceRegistry } from '../registry/resource-registry';
import { HttpException } from '../errors/HttpException';

/**
 * 비용 정의 (동적 자원)
 */
export interface Cost {
  id: string; // 자원 ID
  amount: number | ((ctx: any) => number);
  allowDebt?: boolean;
}

/**
 * 자원 서비스
 * 
 * 동적 자원 검증, 소비, 변환 처리
 */
export class ResourceService {
  /**
   * 비용 검증
   */
  static validateCost(
    bag: ResourceBag,
    costs: Cost[],
    scenarioId: ScenarioId,
    ctx?: any
  ): void {
    for (const cost of costs) {
      const amount = typeof cost.amount === 'function' ? cost.amount(ctx) : cost.amount;
      const current = bag[cost.id] || 0;
      
      if (!cost.allowDebt && current < amount) {
        const def = ResourceRegistry.getResource(scenarioId, cost.id);
        const label = def?.label.ko || cost.id;
        throw new HttpException(400, `${label}이(가) 부족합니다. (필요: ${amount}, 보유: ${current})`);
      }
      
      // 최대값 체크
      const def = ResourceRegistry.getResource(scenarioId, cost.id);
      if (def?.max !== undefined && current > def.max) {
        throw new HttpException(400, `${def.label.ko}이(가) 최대치를 초과했습니다.`);
      }
    }
  }

  /**
   * 비용 적용
   */
  static applyCost(
    bag: ResourceBag,
    costs: Cost[],
    mode: 'commit' | 'refund',
    ctx?: any
  ): void {
    const multiplier = mode === 'commit' ? -1 : 1;
    
    for (const cost of costs) {
      const amount = typeof cost.amount === 'function' ? cost.amount(ctx) : cost.amount;
      
      if (!bag[cost.id]) {
        bag[cost.id] = 0;
      }
      
      bag[cost.id] += amount * multiplier;
      
      // 음수 방지
      if (bag[cost.id] < 0 && !cost.allowDebt) {
        bag[cost.id] = 0;
      }
    }
  }

  /**
   * 자원 변환
   */
  static exchange(
    bag: ResourceBag,
    from: string,
    to: string,
    amount: number,
    scenarioId: ScenarioId
  ): void {
    const rule = ResourceRegistry.getConversionRule(scenarioId, from, to);
    
    if (!rule) {
      throw new HttpException(400, '변환할 수 없는 자원입니다.');
    }
    
    const fromAmount = amount;
    const toAmount = amount * rule.rate;
    const fee = rule.fee ? amount * rule.fee : 0;
    
    // 원본 자원 검증
    if ((bag[from] || 0) < fromAmount + fee) {
      throw new HttpException(400, `${from}이(가) 부족합니다.`);
    }
    
    // 변환 실행
    bag[from] = (bag[from] || 0) - fromAmount - fee;
    bag[to] = (bag[to] || 0) + toAmount;
  }

  /**
   * 자원 이전
   */
  static transfer(
    fromBag: ResourceBag,
    toBag: ResourceBag,
    resourceId: string,
    amount: number,
    scenarioId: ScenarioId
  ): void {
    const def = ResourceRegistry.getResource(scenarioId, resourceId);
    
    if (def?.transferable === false) {
      throw new HttpException(400, '이전할 수 없는 자원입니다.');
    }
    
    if ((fromBag[resourceId] || 0) < amount) {
      throw new HttpException(400, `${resourceId}이(가) 부족합니다.`);
    }
    
    fromBag[resourceId] = (fromBag[resourceId] || 0) - amount;
    toBag[resourceId] = (toBag[resourceId] || 0) + amount;
  }

  /**
   * 자원 가방 복사
   */
  static clone(bag: ResourceBag): ResourceBag {
    return { ...bag };
  }

  /**
   * 자원 가방 병합
   */
  static merge(target: ResourceBag, source: ResourceBag): ResourceBag {
    for (const [key, value] of Object.entries(source)) {
      target[key] = (target[key] || 0) + value;
    }
    return target;
  }
}
