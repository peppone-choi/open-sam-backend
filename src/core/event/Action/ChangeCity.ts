/**
 * ChangeCity.ts
 * 도시 변경 이벤트 액션
 * 
 * PHP 참조: core/hwe/sammo/Event/Action/ChangeCity.php
 * 
 * 시나리오에서 개시 1월에 내정을 깎는 것을 모사
 */

// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { City } from '../../../models/city.model';

// 허용된 도시 속성 키
const AVAILABLE_KEYS = new Set([
  'pop', 'agri', 'comm', 'secu', 'trust', 'def', 'wall', 'trade',
  'pop_max', 'agri_max', 'comm_max', 'secu_max', 'def_max', 'wall_max'
]);

// 정규식 패턴
const REGEXP_PERCENT = /^(\d+(\.\d+)?)%$/;       // 123.5%
const REGEXP_MATH = /^([\+\-\/\*])(\d+(\.\d+)?)$/; // +30

type TargetType = 'all' | 'free' | 'occupied' | 'cities';
type ActionValue = number | string;

/**
 * 도시 변경 이벤트 액션
 */
export class ChangeCity extends Action {
  private targetType: TargetType;
  private targetArgs: (number | string)[];
  private actions: Record<string, ActionValue>;

  constructor(
    target: null | string | [string, ...(number | string)[]],
    actions: Record<string, ActionValue>
  ) {
    super();

    // 타겟 타입 설정
    if (!target) {
      this.targetType = 'all';
      this.targetArgs = [];
    } else if (typeof target === 'string') {
      this.targetType = target as TargetType;
      this.targetArgs = [];
    } else if (Array.isArray(target)) {
      this.targetType = target[0] as TargetType;
      this.targetArgs = target.slice(1);
    } else {
      throw new Error('올바르지 않은 targetType 입니다.');
    }

    // 액션 검증
    for (const key of Object.keys(actions)) {
      if (!AVAILABLE_KEYS.has(key)) {
        throw new Error(`지원하지 않는 city 인자입니다: ${key}`);
      }
    }

    this.actions = actions;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';

    // 타겟 도시 목록 조회
    const targetCities = await this.getTargetCities(sessionId);

    if (targetCities.length === 0) {
      return [ChangeCity.name, 0];
    }

    let modifiedCount = 0;

    // 각 도시에 대해 업데이트 수행
    for (const cityId of targetCities) {
      const city = await City.findOne({ session_id: sessionId, city: cityId });
      if (!city) continue;

      const updates: Record<string, any> = {};

      for (const [key, value] of Object.entries(this.actions)) {
        if (key === 'trust') {
          updates.trust = this.calculateTrust(city.trust || 0, value);
        } else if (key === 'trade') {
          if (value === null) {
            updates.trade = null;
          } else {
            updates.trade = Math.min(105, Math.max(95, Number(value)));
          }
        } else {
          const maxKey = `${key}_max`;
          const currentValue = (city as any)[key] || 0;
          const maxValue = (city as any)[maxKey] || currentValue;
          updates[key] = this.calculateGeneric(currentValue, maxValue, value);
        }
      }

      if (Object.keys(updates).length > 0) {
        await City.updateOne(
          { session_id: sessionId, city: cityId },
          { $set: updates }
        );
        modifiedCount++;
      }
    }

    return [ChangeCity.name, modifiedCount];
  }

  /**
   * 타겟 도시 목록 조회
   */
  private async getTargetCities(sessionId: string): Promise<number[]> {
    let query: Record<string, any> = { session_id: sessionId };

    switch (this.targetType) {
      case 'all':
        break;
      case 'free':
        query.nation = 0;
        break;
      case 'occupied':
        query.nation = { $ne: 0 };
        break;
      case 'cities':
        if (this.targetArgs.length > 0) {
          if (typeof this.targetArgs[0] === 'number') {
            query.city = { $in: this.targetArgs };
          } else {
            query.name = { $in: this.targetArgs };
          }
        }
        break;
      default:
        throw new Error('올바르지 않은 cond 입니다.');
    }

    const cities = await City.find(query).select('city');
    return cities.map(c => c.city);
  }

  /**
   * 민심 값 계산 (max = 100 고정)
   */
  private calculateTrust(current: number, value: ActionValue): number {
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return Math.min(100, Math.max(0, value));
      } else {
        // float: 비율 적용
        if (value < 0) throw new Error('음수를 곱할 수 없습니다.');
        return Math.min(100, Math.round(current * value));
      }
    }

    // 문자열 처리
    let match = value.match(REGEXP_PERCENT);
    if (match) {
      const percent = parseFloat(match[1]);
      return Math.min(100, Math.max(0, Math.round(percent)));
    }

    match = value.match(REGEXP_MATH);
    if (match) {
      const op = match[1];
      const num = parseFloat(match[2]);
      if (op === '/' && num === 0) throw new Error('0으로 나눌 수 없습니다.');
      
      let result = current;
      switch (op) {
        case '+': result = current + num; break;
        case '-': result = current - num; break;
        case '*': result = current * num; break;
        case '/': result = current / num; break;
      }
      return Math.min(100, Math.max(0, Math.round(result)));
    }

    throw new Error('알 수 없는 패턴입니다.');
  }

  /**
   * 일반 값 계산
   */
  private calculateGeneric(current: number, max: number, value: ActionValue): number {
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return Math.min(max, Math.max(0, value));
      } else {
        // float: 비율 적용
        if (value < 0) throw new Error('음수를 곱할 수 없습니다.');
        return Math.min(max, Math.round(current * value));
      }
    }

    // 문자열 처리
    let match = value.match(REGEXP_PERCENT);
    if (match) {
      const percent = parseFloat(match[1]) / 100;
      return Math.round(max * percent);
    }

    match = value.match(REGEXP_MATH);
    if (match) {
      const op = match[1];
      const num = parseFloat(match[2]);
      if (op === '/' && num === 0) throw new Error('0으로 나눌 수 없습니다.');
      
      let result = current;
      switch (op) {
        case '+': result = current + num; break;
        case '-': result = current - num; break;
        case '*': result = current * num; break;
        case '/': result = current / num; break;
      }
      return Math.min(max, Math.max(0, Math.round(result)));
    }

    throw new Error('알 수 없는 패턴입니다.');
  }
}








