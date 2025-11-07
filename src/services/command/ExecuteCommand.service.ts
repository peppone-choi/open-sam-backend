import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { BattleInstance } from '../../models/battle-instance.model';

export interface CommandExecution {
  success: boolean;
  status: 'executed' | 'failed' | 'refunded';
  reason?: string;
  message?: string;
  refund?: {
    gold?: number;
    rice?: number;
    troops?: number;
  };
  result?: any;
}

export interface CommandContext {
  sessionId: string;
  generalId: number;
  turnIdx: number;
  action: string;
  arg?: any;
  queuedAtTurn?: number;
  targetCity?: number;
  ownerAtQueue?: number;
  requiresOwnership?: boolean;
  cost?: {
    gold?: number;
    rice?: number;
    troops?: number;
  };
}

export class ExecuteCommandService {
  static async execute(context: CommandContext): Promise<CommandExecution> {
    try {
      const validationResult = await this.validateExecution(context);
      if (!validationResult.valid) {
        return {
          success: false,
          status: 'failed',
          reason: validationResult.reason,
          message: validationResult.message,
          refund: context.cost
        };
      }

      const executionResult = await this.executeCommandLogic(context);

      if (executionResult.success && context.cost) {
        await this.deductCosts(context);
      }

      return executionResult;

    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        reason: 'execution_error',
        message: error.message,
        refund: context.cost
      };
    }
  }

  private static async validateExecution(context: CommandContext): Promise<{ valid: boolean; reason?: string; message?: string }> {
    const general = await generalRepository.findOneByFilter({ 
      session_id: context.sessionId,
      $or: [
        { 'data.no': context.generalId },
        { no: context.generalId }
      ]
    });

    if (!general) {
      return {
        valid: false,
        reason: 'general_not_found',
        message: '장수를 찾을 수 없습니다.'
      };
    }

    if (context.requiresOwnership && context.targetCity && context.ownerAtQueue !== undefined) {
      const city = await cityRepository.findOneByFilter({ 
        session_id: context.sessionId,
        $or: [
          { 'data.city': context.targetCity },
          { city: context.targetCity }
        ]
      });

      if (!city) {
        return {
          valid: false,
          reason: 'city_not_found',
          message: '도시를 찾을 수 없습니다.'
        };
      }

      const cityNation = city.data?.nation || city.nation;
      if (cityNation !== context.ownerAtQueue) {
        const cityName = city.data?.name || city.name;
        return {
          valid: false,
          reason: 'city_ownership_changed',
          message: `${cityName}의 소유권이 변경되어 커맨드가 취소되었습니다.`
        };
      }
    }

    const generalStatus = await this.getGeneralStatus(general);
    if (generalStatus !== 'idle') {
      return {
        valid: false,
        reason: 'general_not_available',
        message: `${general.name}이(가) ${this.getStatusMessage(generalStatus)} 상태입니다.`
      };
    }

    if (context.cost?.gold && general.data.gold < context.cost.gold) {
      return {
        valid: false,
        reason: 'insufficient_gold',
        message: '금이 부족합니다.'
      };
    }

    if (context.cost?.rice && general.data.rice < context.cost.rice) {
      return {
        valid: false,
        reason: 'insufficient_rice',
        message: '군량이 부족합니다.'
      };
    }

    if (context.cost?.troops && general.data.crew < context.cost.troops) {
      return {
        valid: false,
        reason: 'insufficient_troops',
        message: '병력이 부족합니다.'
      };
    }

    return { valid: true };
  }

  private static async getGeneralStatus(general: any): Promise<string> {
    const inBattle = await BattleInstance.findOne({
      $or: [
        { 'attacker.generals': general.no },
        { 'defender.generals': general.no }
      ],
      status: { $in: ['preparing', 'active'] }
    });

    if (inBattle) return 'in_battle';

    if (general.data.battle_status === 'in_battle') {
      return 'in_battle';
    }

    return 'idle';
  }

  private static getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      'in_battle': '전투 중',
      'marching': '이동 중',
      'captured': '포로',
      'dead': '사망'
    };
    return messages[status] || status;
  }

  private static async executeCommandLogic(context: CommandContext): Promise<CommandExecution> {
    const battleCommands = ['출병', 'che_출병'];
    
    if (battleCommands.includes(context.action)) {
      return await this.executeBattleCommand(context);
    }

    return {
      success: true,
      status: 'executed',
      message: `${context.action} 커맨드가 실행되었습니다.`
    };
  }

  private static async executeBattleCommand(context: CommandContext): Promise<CommandExecution> {
    return {
      success: true,
      status: 'executed',
      message: '전투 커맨드가 실행되었습니다. (DeployCommand.ts에서 처리)'
    };
  }

  private static async deductCosts(context: CommandContext): Promise<void> {
    if (!context.cost) return;

    const general = await generalRepository.findOneByFilter({
      session_id: context.sessionId,
      $or: [
        { 'data.no': context.generalId },
        { no: context.generalId }
      ]
    });

    if (general) {
      general.data = general.data || {};
      if (context.cost.gold) {
        general.data.gold = (general.data.gold || 0) - context.cost.gold;
      }
      if (context.cost.rice) {
        general.data.rice = (general.data.rice || 0) - context.cost.rice;
      }
      if (context.cost.troops) {
        general.data.crew = (general.data.crew || 0) - context.cost.troops;
      }
      await generalRepository.save(general);
    }
  }

  static async refundCommand(context: CommandContext, reason: string): Promise<void> {
    if (!context.cost) return;

    const general = await generalRepository.findOneByFilter({
      session_id: context.sessionId,
      $or: [
        { 'data.no': context.generalId },
        { no: context.generalId }
      ]
    });

    if (general) {
      general.data = general.data || {};
      if (context.cost.gold) {
        general.data.gold = (general.data.gold || 0) + context.cost.gold;
      }
      if (context.cost.rice) {
        general.data.rice = (general.data.rice || 0) + context.cost.rice;
      }
      if (context.cost.troops) {
        general.data.crew = (general.data.crew || 0) + context.cost.troops;
      }
      await generalRepository.save(general);
    }
  }

  static async checkAndRefundFailedCommands(sessionId: string, turnIdx: number): Promise<void> {
    const commands = await generalTurnRepository.findBySession(sessionId, {
      'data.turn_idx': turnIdx,
      'data.status': { $ne: 'executed' }
    });

    for (const cmd of commands) {
      const context: CommandContext = {
        sessionId,
        generalId: cmd.data.general_id,
        turnIdx: cmd.data.turn_idx,
        action: cmd.data.action,
        arg: cmd.data.arg,
        targetCity: cmd.data.target_city,
        ownerAtQueue: cmd.data.owner_at_queue,
        requiresOwnership: cmd.data.requires_ownership,
        cost: cmd.data.cost
      };

      const result = await this.execute(context);

      if (!result.success && result.refund) {
        await this.refundCommand(context, result.reason || 'unknown');
        
        cmd.data.status = 'refunded';
        cmd.data.failure_reason = result.reason;
        cmd.data.failure_message = result.message;
        await cmd.save();
      }
    }
  }
}
