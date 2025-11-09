/**
 * 은하영웅전설 - 함대 건조 액션 핸들러
 *
 * 범용 엔진 패턴
 */

import {
  ActionCategory,
  ActionContext,
  ActionHandler,
  ActionPayload,
  ActionResult,
  LoghActionType,
  ValidationResult
} from '../../types/action.types';
import { WorldType } from '../../types/world.types';
import { Entity } from '../../../common/@types/entity.types';
import { UniversalGameEngine, CacheKeyHelper } from '../../UniversalGameEngine';
import { logger } from '../../../common/logger';

/**
 * 함대 건조 액션 핸들러
 */
export class BuildFleetHandler implements ActionHandler {
  readonly type = LoghActionType.BUILD_FLEET;
  readonly category = ActionCategory.MILITARY;
  readonly supportedWorlds: WorldType[] = ['logh'];

  constructor(
    private engine: UniversalGameEngine
  ) {}

  /**
   * 액션 검증
   */
  async validate(ctx: ActionContext, payload: ActionPayload): Promise<ValidationResult> {
    const errors: string[] = [];

    // 사령관 로드
    const commander = await this.engine.loadEntity(ctx.actorRef);
    if (!commander) {
      errors.push('사령관 정보를 찾을 수 없습니다');
      return { valid: false, errors };
    }

    // 항성계 참조 확인
    const starSystemRef = commander.refs.starSystem;
    if (!starSystemRef || Array.isArray(starSystemRef)) {
      errors.push('소속 항성계가 없습니다');
      return { valid: false, errors };
    }

    // 항성계 로드
    const starSystem = await this.engine.loadEntity(starSystemRef);
    if (!starSystem) {
      errors.push('항성계 정보를 찾을 수 없습니다');
      return { valid: false, errors };
    }

    // 조선소 슬롯 확인
    const shipyardSlot = starSystem.slots.shipyard;
    if (!shipyardSlot) {
      errors.push('조선소 시설이 없습니다');
      return { valid: false, errors };
    }

    // 조선소 레벨 확인
    if (!shipyardSlot.level || shipyardSlot.level < 1) {
      errors.push('조선소가 건설되지 않았습니다');
      return { valid: false, errors };
    }

    // 자원 확인
    const resourceCost = this.calculateCost(payload);
    const currentMetal = starSystem.resources.metal || 0;
    const currentEnergy = starSystem.resources.energy || 0;

    if (currentMetal < resourceCost.metal) {
      errors.push(`금속이 부족합니다 (필요: ${resourceCost.metal}, 보유: ${currentMetal})`);
    }

    if (currentEnergy < resourceCost.energy) {
      errors.push(`에너지가 부족합니다 (필요: ${resourceCost.energy}, 보유: ${currentEnergy})`);
    }

    if (errors.length > 0) {
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
      const commander = await this.engine.loadEntity(ctx.actorRef);
      if (!commander) {
        throw new Error('사령관을 찾을 수 없습니다');
      }

      const starSystemRef = commander.refs.starSystem;
      if (!starSystemRef || Array.isArray(starSystemRef)) {
        throw new Error('소속 항성계가 없습니다');
      }

      const starSystem = await this.engine.loadEntity(starSystemRef);
      if (!starSystem) {
        throw new Error('항성계를 찾을 수 없습니다');
      }

      // 함대 타입 결정 (payload에서)
      const fleetType = payload.arg?.fleetType || 'standard';
      const fleetCount = payload.arg?.count || 1;

      // 비용 계산
      const cost = this.calculateCost(payload);

      // 능력치 기반 건조 효율 계산
      const leadership = commander.attributes.leadership || 0;
      const technology = commander.attributes.technology || 0;

      // 건조 성공률 (지휘력 + 기술력 기반)
      const efficiency = Math.min((leadership + technology) / 200, 1.0);
      const successCount = Math.max(1, Math.floor(fleetCount * efficiency));

      // 함대 생성
      const fleetSlot = commander.slots.fleet || { value: 0, max: 100 };
      const newFleetValue = Math.min(fleetSlot.value + successCount, fleetSlot.max);
      const actualBuilt = newFleetValue - fleetSlot.value;

      // 자원 소모
      const starSystemPatch = {
        resources: {
          ...starSystem.resources,
          metal: (starSystem.resources.metal || 0) - cost.metal,
          energy: (starSystem.resources.energy || 0) - cost.energy
        }
      };

      // 사령관 함대 업데이트
      const commanderPatch = {
        slots: {
          ...commander.slots,
          fleet: {
            ...fleetSlot,
            value: newFleetValue
          }
        }
      };

      // 변경사항 저장
      await this.engine.saveEntity(starSystem, starSystemPatch);
      await this.engine.saveEntity(commander, commanderPatch);

      // 통계 업데이트
      const stats = await this.engine.loadSystemState(ctx.sessionId, 'military_stats', ctx.actorRef);
      const updatedStats = {
        ...(stats || {}),
        totalFleetsBuilt: (stats?.totalFleetsBuilt || 0) + actualBuilt,
        buildActionCount: (stats?.buildActionCount || 0) + 1
      };
      await this.engine.saveSystemState(ctx.sessionId, 'military_stats', updatedStats, ctx.actorRef);

      const message = `함대 건조를 성공적으로 완료했습니다! (함대 +${actualBuilt}, 현재: ${newFleetValue}/${fleetSlot.max})`;

      logger.info('함대 건조 성공', {
        commander: ctx.actorRef,
        starSystem: starSystemRef,
        built: actualBuilt,
        total: newFleetValue
      });

      return {
        success: true,
        message,
        messageType: 'success',
        changes: {
          entities: [
            { ref: starSystemRef, patch: starSystemPatch },
            { ref: ctx.actorRef, patch: commanderPatch }
          ],
          systemStates: [
            { systemId: 'military_stats', ownerRef: ctx.actorRef, patch: updatedStats }
          ]
        },
        stats: {
          fleetsBuilt: actualBuilt,
          fleetTotal: newFleetValue,
          metalSpent: cost.metal,
          energySpent: cost.energy
        },
        logs: [
          {
            type: 'military_action',
            message: `${commander.name}이(가) ${starSystem.name}에서 함대 건조 (함대 ${fleetSlot.value} → ${newFleetValue})`,
            data: { fleetType, count: actualBuilt, cost }
          }
        ]
      };

    } catch (error) {
      logger.error('함대 건조 실패', error);
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
    const fleetType = payload.arg?.fleetType || 'standard';
    const count = payload.arg?.count || 1;
    return `함대 건조 (${fleetType} x${count})`;
  }

  /**
   * 액션 비용 계산
   */
  async getCost(ctx: ActionContext, payload: ActionPayload): Promise<{ turns: number; resources: Record<string, number> }> {
    const cost = this.calculateCost(payload);
    return {
      turns: 2, // 2턴 소모
      resources: {
        metal: cost.metal,
        energy: cost.energy
      }
    };
  }

  /**
   * 자원 비용 계산 (내부 헬퍼)
   */
  private calculateCost(payload: ActionPayload): { metal: number; energy: number } {
    const fleetType = payload.arg?.fleetType || 'standard';
    const count = payload.arg?.count || 1;

    const baseCosts: Record<string, { metal: number; energy: number }> = {
      scout: { metal: 100, energy: 50 },
      standard: { metal: 500, energy: 200 },
      heavy: { metal: 1000, energy: 500 },
      flagship: { metal: 2000, energy: 1000 }
    };

    const base = baseCosts[fleetType] || baseCosts.standard;
    return {
      metal: base.metal * count,
      energy: base.energy * count
    };
  }
}
