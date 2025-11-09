/**
 * 삼국지 - 농업 개간 액션 핸들러
 *
 * PHP 원본: hwe/command/che/che_농업개간.php
 * 범용 엔진 패턴으로 변환
 */

import {
  ActionCategory,
  ActionContext,
  ActionHandler,
  ActionPayload,
  ActionResult,
  SangokushiActionType,
  ValidationResult
} from '../../types/action.types';
import { WorldType } from '../../types/world.types';
import { Entity } from '../../../common/@types/entity.types';
import { UniversalGameEngine, CacheKeyHelper } from '../../UniversalGameEngine';
import { logger } from '../../../common/logger';

/**
 * 농업 개간 액션 핸들러
 */
export class CultivateFarmHandler implements ActionHandler {
  readonly type = SangokushiActionType.CULTIVATE_FARM;
  readonly category = ActionCategory.DOMESTIC;
  readonly supportedWorlds: WorldType[] = ['sangokushi'];

  constructor(
    private engine: UniversalGameEngine
  ) {}

  /**
   * 액션 검증
   */
  async validate(ctx: ActionContext, payload: ActionPayload): Promise<ValidationResult> {
    const errors: string[] = [];

    // 행위자 로드
    const actor = await this.engine.loadEntity(ctx.actorRef);
    if (!actor) {
      errors.push('장수 정보를 찾을 수 없습니다');
      return { valid: false, errors };
    }

    // 도시 참조 확인
    const cityRef = actor.refs.city;
    if (!cityRef || Array.isArray(cityRef)) {
      errors.push('소속 도시가 없습니다');
      return { valid: false, errors };
    }

    // 도시 로드
    const city = await this.engine.loadEntity(cityRef);
    if (!city) {
      errors.push('도시 정보를 찾을 수 없습니다');
      return { valid: false, errors };
    }

    // 농업 슬롯 확인
    const farmSlot = city.slots.farm;
    if (!farmSlot) {
      errors.push('농업 시설이 없습니다');
      return { valid: false, errors };
    }

    // 최대치 확인
    if (farmSlot.value >= farmSlot.max) {
      errors.push('농업 개발이 이미 최대입니다');
      return { valid: false, errors };
    }

    // 능력치 확인
    const leadership = actor.attributes.leadership || 0;
    if (leadership < 10) {
      errors.push('통솔력이 부족합니다 (최소 10 필요)');
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * 액션 실행
   */
  async execute(ctx: ActionContext, payload: ActionPayload): Promise<ActionResult> {
    try {
      // 엔티티 로드
      const actor = await this.engine.loadEntity(ctx.actorRef);
      if (!actor) {
        throw new Error('장수를 찾을 수 없습니다');
      }

      const cityRef = actor.refs.city;
      if (!cityRef || Array.isArray(cityRef)) {
        throw new Error('소속 도시가 없습니다');
      }

      const city = await this.engine.loadEntity(cityRef);
      if (!city) {
        throw new Error('도시를 찾을 수 없습니다');
      }

      // 능력치 기반 개간량 계산
      const leadership = actor.attributes.leadership || 0;
      const intelligence = actor.attributes.intelligence || 0;

      // 기본 개간량
      let farmIncrease = Math.floor(leadership / 10) + 5;

      // 지능 보너스 (10% ~ 30%)
      const intBonus = Math.min(intelligence / 300, 0.3);
      farmIncrease = Math.floor(farmIncrease * (1 + intBonus));

      // 랜덤 변동 (±10%)
      const randomFactor = 0.9 + Math.random() * 0.2;
      farmIncrease = Math.floor(farmIncrease * randomFactor);

      // 최소값 보장
      farmIncrease = Math.max(farmIncrease, 5);

      // 최대치 제한
      const farmSlot = city.slots.farm;
      if (!farmSlot) {
        throw new Error('농업 시설이 없습니다');
      }

      const beforeValue = farmSlot.value;
      const newValue = Math.min(beforeValue + farmIncrease, farmSlot.max);
      const actualIncrease = newValue - beforeValue;

      // 변경사항 적용
      const cityPatch = {
        slots: {
          ...city.slots,
          farm: {
            ...farmSlot,
            value: newValue
          }
        }
      };

      // 엔티티 저장 (캐시 업데이트 + Dirty 마킹)
      await this.engine.saveEntity(city, cityPatch);

      // 통계 업데이트 (시스템 상태)
      const stats = await this.engine.loadSystemState(ctx.sessionId, 'domestic_stats', ctx.actorRef);
      const updatedStats = {
        ...(stats || {}),
        totalFarmDevelopment: (stats?.totalFarmDevelopment || 0) + actualIncrease,
        farmActionCount: (stats?.farmActionCount || 0) + 1
      };
      await this.engine.saveSystemState(ctx.sessionId, 'domestic_stats', updatedStats, ctx.actorRef);

      // 성공 메시지
      const message = `농업 개간을 성공적으로 수행했습니다! (농업 +${actualIncrease}, 현재: ${newValue}/${farmSlot.max})`;

      logger.info('농업 개간 성공', {
        actor: ctx.actorRef,
        city: cityRef,
        increase: actualIncrease,
        total: newValue
      });

      return {
        success: true,
        message,
        messageType: 'success',
        changes: {
          entities: [
            { ref: cityRef, patch: cityPatch }
          ],
          systemStates: [
            { systemId: 'domestic_stats', ownerRef: ctx.actorRef, patch: updatedStats }
          ]
        },
        stats: {
          farmIncrease: actualIncrease,
          farmTotal: newValue
        },
        logs: [
          {
            type: 'domestic_action',
            message: `${actor.name}이(가) ${city.name}에서 농업 개간 (${beforeValue} → ${newValue})`,
            data: { before: beforeValue, after: newValue, increase: actualIncrease }
          }
        ]
      };

    } catch (error) {
      logger.error('농업 개간 실패', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        messageType: 'error',
        changes: {}
      };
    }
  }

  /**
   * 액션 요약 (UI 표시용)
   */
  getBrief(payload: ActionPayload): string {
    return '농업 개간';
  }

  /**
   * 액션 비용 계산
   */
  async getCost(ctx: ActionContext, payload: ActionPayload): Promise<{ turns: number; resources: Record<string, number> }> {
    return {
      turns: 1, // 1턴 소모
      resources: {
        gold: 0, // 금 소모 없음
        rice: 0  // 쌀 소모 없음
      }
    };
  }
}
