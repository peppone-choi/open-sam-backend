/**
 * 귀환 공작 (ReturnOperation / 帰還工作)
 * 매뉴얼 5565-5573행: 침입한 행성/요새에서 자기 진영으로 귀환
 * CP 소모: 320 PCP
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';
import { spyService } from '../../../services/gin7/SpyService';
import { logger } from '../../../common/logger';

export class ReturnOperationCommand extends BaseLoghCommand {
  getName(): string {
    return 'return_operation';
  }

  getDisplayName(): string {
    return '귀환 공작';
  }

  getDescription(): string {
    return '침입한 행성/요새에서 본국으로 귀환합니다.';
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

    // 귀환할 첩보관 ID (기본값: 자신)
    const agentId = env?.agentId || String(commander.no);

    try {
      // SpyService를 통해 귀환 공작 실행
      const response = await spyService.returnOperationCommand(
        commander.session_id,
        agentId,
        {}
      );

      // CP 소모 (성공/실패 상관없이)
      commander.consumeCommandPoints(this.getRequiredCommandPoints());
      await commander.save();

      if (!response.success) {
        logger.warn(`[ReturnOperationCommand] Return failed for agent ${agentId}: ${response.error}`);
        
        // result에서 상세 정보 추출
        const result = response.result;
        const consequences = result?.consequences || [];
        
        return {
          success: false,
          message: result?.message || response.error || '귀환 공작에 실패했습니다.',
          effects: [
            {
              type: 'return_failed',
              agentId,
              consequences,
            },
          ],
        };
      }

      logger.info(`[ReturnOperationCommand] Agent ${agentId} returned successfully`);

      // result에서 상세 정보 추출
      const result = response.result;

      return {
        success: true,
        message: result?.message || '안전하게 본국으로 귀환했습니다.',
        effects: [
          {
            type: 'return_success',
            agentId,
            intelTransmitted: true,
          },
        ],
      };
    } catch (error: any) {
      logger.error('[ReturnOperationCommand] Error:', error);
      return {
        success: false,
        message: '귀환 공작 처리 중 오류가 발생했습니다.',
      };
    }
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // 턴 종료 시 처리 (필요 시)
  }
}





