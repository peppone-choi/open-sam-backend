/**
 * 침입 공작 (IntrusionOperation / 侵入工作)
 * 매뉴얼 5555-5563행: 다른 세력의 행성/요새에 침입을 시도
 * CP 소모: 320 PCP
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { Planet } from '../../../models/logh/Planet.model';
import { intrusionOperationService, IntrusionObjective } from '../../../services/gin7/IntrusionOperationService';
import { logger } from '../../../common/logger';

export class IntrusionOperationCommand extends BaseLoghCommand {
  getName(): string {
    return 'intrusion_operation';
  }

  getDisplayName(): string {
    return '침입 공작';
  }

  getDescription(): string {
    return '다른 세력의 행성/요새에 침입을 시도합니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 320; // 매뉴얼 기준
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    return [];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 침입 대상 행성 지정
    const targetPlanetId = env?.targetPlanetId;
    const objective = env?.objective || IntrusionObjective.DATA_THEFT;
    const targetFacilityId = env?.targetFacilityId;
    const targetCharacterId = env?.targetCharacterId;

    if (!targetPlanetId) {
      return {
        success: false,
        message: '침입할 행성을 지정해주세요.',
      };
    }

    // 대상 행성 조회
    const targetPlanet = await Planet.findOne({
      session_id: commander.session_id,
      planetId: targetPlanetId,
    });

    if (!targetPlanet) {
      return {
        success: false,
        message: '대상 행성을 찾을 수 없습니다.',
      };
    }

    // 아군 행성에는 침입 불가
    if (targetPlanet.owner === commander.getFactionType()) {
      return {
        success: false,
        message: '아군 행성에는 침입할 수 없습니다.',
      };
    }

    try {
      // IntrusionOperationService를 통해 침입 공작 계획
      const result = await intrusionOperationService.planIntrusion(
        commander.session_id,
        String(commander.no),
        objective as IntrusionObjective,
        targetPlanetId,
        targetFacilityId,
        targetCharacterId
      );

      if (!result.success) {
        return {
          success: false,
          message: result.message || '침입 공작 계획에 실패했습니다.',
        };
      }

      // CP 소모
      commander.consumeCommandPoints(this.getRequiredCommandPoints());
      await commander.save();

      logger.info(`[IntrusionOperationCommand] Intrusion planned by ${commander.no} to ${targetPlanetId}`);

      return {
        success: true,
        message: `${targetPlanet.name}에 대한 침입 공작이 시작되었습니다. (목표: ${this.getObjectiveName(objective)})`,
        effects: [
          {
            type: 'intrusion_started',
            operationId: result.operationId,
            targetPlanetId,
            targetPlanetName: targetPlanet.name,
            objective,
          },
        ],
      };
    } catch (error: any) {
      logger.error('[IntrusionOperationCommand] Error:', error);
      return {
        success: false,
        message: '침입 공작 처리 중 오류가 발생했습니다.',
      };
    }
  }

  private getObjectiveName(objective: string): string {
    const names: Record<string, string> = {
      [IntrusionObjective.DATA_THEFT]: '데이터 탈취',
      [IntrusionObjective.PLANTING_BUG]: '도청 장치 설치',
      [IntrusionObjective.SABOTAGE]: '파괴 공작',
      [IntrusionObjective.RESCUE]: '구출',
      [IntrusionObjective.ASSASSINATION]: '암살',
    };
    return names[objective] || objective;
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // 턴 종료 시 처리 (필요 시)
  }
}





