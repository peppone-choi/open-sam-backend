/**
 * CommandDelayService
 * 
 * 전술 명령 지연 및 스케줄링 시스템
 * 명령 발령 후 실제 실행까지의 지연을 관리합니다.
 * 
 * @module gin7-command-delay
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger';
import {
  DelayedCommand,
  DelayedCommandStatus,
  DelayBreakdown,
  CommandPriority,
  TacticalCommand,
  COMMAND_DELAY_CONSTANTS,
  JammingLevel,
  JAMMING_DELAY_MULTIPLIERS,
  CommandQueueEvent,
  CommandQueueSummary,
} from '../../types/gin7/tactical.types';
import { electronicWarfareService } from './ElectronicWarfareService';

/**
 * 명령 지연 서비스 인터페이스
 */
interface QueueCommandParams {
  battleId: string;
  commanderId: string;
  factionId: string;
  command: TacticalCommand;
  priority?: CommandPriority;
  currentTick: number;
  commanderDistance?: number;  // 지휘관과 유닛 간 거리
  commanderSkill?: number;     // 지휘관 통솔 스킬 (0-100)
}

interface QueueCommandResult {
  success: boolean;
  message: string;
  delayedCommand?: DelayedCommand;
  error?: string;
}

/**
 * CommandDelayService
 * 
 * 명령 지연 및 큐 관리 서비스
 */
export class CommandDelayService extends EventEmitter {
  // 전투별 명령 큐: battleId -> DelayedCommand[]
  private commandQueues: Map<string, DelayedCommand[]> = new Map();
  
  // 명령 ID -> DelayedCommand (빠른 조회용)
  private commandIndex: Map<string, DelayedCommand> = new Map();

  constructor() {
    super();
    logger.info('[CommandDelayService] 초기화됨');
  }

  /**
   * 명령을 큐에 추가
   */
  queueCommand(params: QueueCommandParams): QueueCommandResult {
    const { battleId, commanderId, factionId, command, priority = 'NORMAL', currentTick } = params;

    // 전자전 상태 확인
    const ewState = electronicWarfareService.getState(battleId, factionId);
    const jammingLevel = ewState?.jammingLevel || 'CLEAR';

    // BLACKOUT 상태면 명령 불가
    if (jammingLevel === 'BLACKOUT') {
      logger.warn('[CommandDelayService] 통신 두절로 명령 불가', {
        battleId,
        commanderId,
        factionId,
      });
      return {
        success: false,
        message: '통신 두절 상태입니다. 명령을 내릴 수 없습니다.',
        error: 'COMMUNICATION_BLACKOUT',
      };
    }

    // 지연 시간 계산
    const delayBreakdown = this.calculateDelay({
      priority,
      commanderDistance: params.commanderDistance || 0,
      commanderSkill: params.commanderSkill || 50,
      jammingLevel,
    });

    // 지연된 명령 생성
    const delayedCommand: DelayedCommand = {
      id: uuidv4(),
      battleId,
      commanderId,
      factionId,
      command,
      issueTime: currentTick,
      executeTime: currentTick + delayBreakdown.totalDelay,
      delayBreakdown,
      status: 'QUEUED',
      priority,
      cancellable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 큐에 추가
    if (!this.commandQueues.has(battleId)) {
      this.commandQueues.set(battleId, []);
    }
    this.commandQueues.get(battleId)!.push(delayedCommand);
    this.commandIndex.set(delayedCommand.id, delayedCommand);

    // 이벤트 발생
    this.emitEvent({
      type: 'COMMAND_QUEUED',
      delayedCommand,
      timestamp: Date.now(),
    });

    logger.info('[CommandDelayService] 명령 큐에 추가됨', {
      commandId: delayedCommand.id,
      battleId,
      commandType: command.type,
      issueTime: currentTick,
      executeTime: delayedCommand.executeTime,
      totalDelay: delayBreakdown.totalDelay,
    });

    return {
      success: true,
      message: `명령이 대기열에 추가되었습니다. 예상 실행까지 ${Math.ceil(delayBreakdown.totalDelay / 16)}초`,
      delayedCommand,
    };
  }

  /**
   * 지연 시간 계산
   */
  private calculateDelay(params: {
    priority: CommandPriority;
    commanderDistance: number;
    commanderSkill: number;
    jammingLevel: JammingLevel;
  }): DelayBreakdown {
    const { priority, commanderDistance, commanderSkill, jammingLevel } = params;
    const C = COMMAND_DELAY_CONSTANTS;

    // 1. 기본 지연 (무작위 0~20초)
    const baseDelay = Math.floor(
      C.MIN_BASE_DELAY_TICKS + Math.random() * (C.MAX_BASE_DELAY_TICKS - C.MIN_BASE_DELAY_TICKS)
    );

    // 2. 거리 페널티
    const distancePenalty = Math.floor((commanderDistance / 1000) * C.DISTANCE_DELAY_PER_1000);

    // 3. 전자전 페널티 (BLACKOUT은 여기서 처리 안 함 - 이미 차단됨)
    const jammingMultiplier = JAMMING_DELAY_MULTIPLIERS[jammingLevel];
    const jammingPenalty = jammingMultiplier > 1 
      ? Math.floor((baseDelay + distancePenalty) * (jammingMultiplier - 1))
      : 0;

    // 4. 지휘관 스킬 보너스 (최대 50% 감소)
    const skillReduction = (commanderSkill / 100) * C.MAX_COMMANDER_BONUS;
    const commanderSkillBonus = Math.floor((baseDelay + distancePenalty + jammingPenalty) * skillReduction);

    // 5. 우선순위 배율 적용
    const priorityMultiplier = C.PRIORITY_MULTIPLIERS[priority];
    const subtotal = baseDelay + distancePenalty + jammingPenalty - commanderSkillBonus;
    const totalDelay = Math.max(0, Math.floor(subtotal * priorityMultiplier));

    return {
      baseDelay,
      distancePenalty,
      jammingPenalty,
      commanderSkillBonus,
      totalDelay,
    };
  }

  /**
   * 매 틱마다 호출하여 실행할 명령 확인
   */
  processTick(battleId: string, currentTick: number): TacticalCommand[] {
    const queue = this.commandQueues.get(battleId);
    if (!queue || queue.length === 0) {
      return [];
    }

    const readyCommands: TacticalCommand[] = [];
    const completedIds: string[] = [];

    for (const delayed of queue) {
      if (delayed.status !== 'QUEUED') continue;

      // 실행 시간 도달 확인
      if (currentTick >= delayed.executeTime) {
        // 실행 직전에 전자전 상태 재확인
        const ewState = electronicWarfareService.getState(battleId, delayed.factionId);
        if (ewState?.jammingLevel === 'BLACKOUT') {
          // 통신 두절로 실패
          delayed.status = 'FAILED';
          delayed.updatedAt = new Date();
          this.emitEvent({
            type: 'COMMAND_FAILED',
            delayedCommand: delayed,
            timestamp: Date.now(),
          });
          completedIds.push(delayed.id);
          continue;
        }

        // 상태 변경
        delayed.status = 'EXECUTING';
        delayed.cancellable = false;
        delayed.updatedAt = new Date();

        this.emitEvent({
          type: 'COMMAND_EXECUTING',
          delayedCommand: delayed,
          timestamp: Date.now(),
        });

        // 명령 반환
        readyCommands.push(delayed.command);

        // 완료 처리
        delayed.status = 'COMPLETED';
        delayed.updatedAt = new Date();

        this.emitEvent({
          type: 'COMMAND_COMPLETED',
          delayedCommand: delayed,
          timestamp: Date.now(),
        });

        completedIds.push(delayed.id);

        logger.debug('[CommandDelayService] 명령 실행됨', {
          commandId: delayed.id,
          battleId,
          commandType: delayed.command.type,
          tick: currentTick,
        });
      }
    }

    // 완료된 명령 제거
    if (completedIds.length > 0) {
      this.cleanupCommands(battleId, completedIds);
    }

    return readyCommands;
  }

  /**
   * 명령 취소
   */
  cancelCommand(commandId: string): { success: boolean; message: string; chaosProbability?: number } {
    const delayed = this.commandIndex.get(commandId);
    if (!delayed) {
      return { success: false, message: '명령을 찾을 수 없습니다.' };
    }

    if (!delayed.cancellable) {
      return { success: false, message: '이미 실행 중인 명령은 취소할 수 없습니다.' };
    }

    if (delayed.status !== 'QUEUED') {
      return { success: false, message: `현재 상태(${delayed.status})에서는 취소할 수 없습니다.` };
    }

    // 취소 처리
    delayed.status = 'CANCELLED';
    delayed.updatedAt = new Date();

    this.emitEvent({
      type: 'COMMAND_CANCELLED',
      delayedCommand: delayed,
      timestamp: Date.now(),
    });

    // 큐에서 제거
    this.cleanupCommands(delayed.battleId, [commandId]);

    // 혼란 발생 확률 반환
    const chaosProbability = COMMAND_DELAY_CONSTANTS.CANCEL_CHAOS_PROBABILITY;

    logger.info('[CommandDelayService] 명령 취소됨', {
      commandId,
      battleId: delayed.battleId,
      commandType: delayed.command.type,
      chaosProbability,
    });

    return {
      success: true,
      message: '명령이 취소되었습니다.',
      chaosProbability,
    };
  }

  /**
   * 특정 전투의 명령 큐 조회
   */
  getQueue(battleId: string, factionId?: string): DelayedCommand[] {
    const queue = this.commandQueues.get(battleId) || [];
    if (factionId) {
      return queue.filter(cmd => cmd.factionId === factionId && cmd.status === 'QUEUED');
    }
    return queue.filter(cmd => cmd.status === 'QUEUED');
  }

  /**
   * 명령 조회
   */
  getCommand(commandId: string): DelayedCommand | undefined {
    return this.commandIndex.get(commandId);
  }

  /**
   * 명령 큐 요약 정보
   */
  getQueueSummary(battleId: string, factionId: string): CommandQueueSummary {
    const queue = this.getQueue(battleId, factionId);
    const ewState = electronicWarfareService.getState(battleId, factionId);

    const totalQueued = queue.length;
    const executing = queue.filter(cmd => cmd.status === 'EXECUTING').length;
    const averageDelay = totalQueued > 0
      ? queue.reduce((sum, cmd) => sum + cmd.delayBreakdown.totalDelay, 0) / totalQueued
      : 0;

    return {
      battleId,
      factionId,
      totalQueued,
      executing,
      averageDelay: Math.round(averageDelay),
      jammingLevel: ewState?.jammingLevel || 'CLEAR',
    };
  }

  /**
   * 남은 대기 시간 계산 (tick 단위)
   */
  getRemainingDelay(commandId: string, currentTick: number): number {
    const delayed = this.commandIndex.get(commandId);
    if (!delayed || delayed.status !== 'QUEUED') {
      return 0;
    }
    return Math.max(0, delayed.executeTime - currentTick);
  }

  /**
   * 남은 대기 시간을 진행률로 반환 (0-100)
   */
  getProgress(commandId: string, currentTick: number): number {
    const delayed = this.commandIndex.get(commandId);
    if (!delayed) return 100;
    if (delayed.status !== 'QUEUED') return 100;

    const totalDelay = delayed.delayBreakdown.totalDelay;
    if (totalDelay === 0) return 100;

    const elapsed = currentTick - delayed.issueTime;
    return Math.min(100, Math.max(0, Math.round((elapsed / totalDelay) * 100)));
  }

  /**
   * 전투 종료 시 정리
   */
  clearBattle(battleId: string): void {
    const queue = this.commandQueues.get(battleId);
    if (queue) {
      for (const cmd of queue) {
        this.commandIndex.delete(cmd.id);
      }
      this.commandQueues.delete(battleId);
    }
    logger.info('[CommandDelayService] 전투 명령 큐 정리됨', { battleId });
  }

  /**
   * 완료/취소된 명령 정리
   */
  private cleanupCommands(battleId: string, commandIds: string[]): void {
    const queue = this.commandQueues.get(battleId);
    if (!queue) return;

    const remaining = queue.filter(cmd => !commandIds.includes(cmd.id));
    this.commandQueues.set(battleId, remaining);

    for (const id of commandIds) {
      this.commandIndex.delete(id);
    }
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(event: CommandQueueEvent): void {
    this.emit('commandEvent', event);
    this.emit(event.type, event.delayedCommand);
  }
}

// 싱글톤 인스턴스
export const commandDelayService = new CommandDelayService();

export default CommandDelayService;













