/**
 * CPManager - Command Point 및 커맨드 파이프라인 매니저
 * 
 * 전략 커맨드의 실행 흐름을 관리합니다:
 * 1. CP 소모 검증
 * 2. 대기 시간(wait) 처리
 * 3. 실행 시간(duration) 처리
 * 4. 완료 및 결과 콜백
 * 
 * @see gin7manual Chapter3 §전략커맨드
 * @see command_definitions.ts
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { 
  COMMAND_DEFINITIONS, 
  ICommandDefinition, 
  CommandType 
} from '../../constants/gin7/command_definitions';
import { TimeEngine, GIN7_EVENTS, TimeTickPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================================
// Constants
// ============================================================================

/**
 * 게임 시간 변환 상수
 * 매뉴얼: 실시간 1분 = 게임 24분, timeScale=24
 * 따라서: 게임 1시간 = 실시간 2.5분 = 150초
 * 틱 기준: 1틱 = 1초 (실시간), timeScale=24 → 1틱 = 24 게임초
 */
export const CP_TIME_CONSTANTS = {
  GAME_HOURS_TO_TICKS: (hours: number) => Math.ceil((hours * 60 * 60) / 24), // 게임 시간 → 틱
  TICKS_TO_GAME_HOURS: (ticks: number) => (ticks * 24) / (60 * 60),          // 틱 → 게임 시간
  
  // 대용 소모 배율
  SUBSTITUTION_MULTIPLIER: 2,
  
  // 최대 동시 실행 커맨드 수 (캐릭터당)
  MAX_CONCURRENT_COMMANDS: 3,
};

// ============================================================================
// Types
// ============================================================================

export type CommandPipelineState = 
  | 'PENDING'      // 대기열에 등록됨
  | 'WAITING'      // wait 시간 대기 중
  | 'EXECUTING'    // duration 실행 중
  | 'COMPLETED'    // 완료
  | 'CANCELLED'    // 취소됨
  | 'FAILED';      // 실패

export interface CommandPipelineEntry {
  id: string;
  sessionId: string;
  characterId: string;
  commandId: string;
  commandName: string;
  
  // CP 정보
  cpType: CommandType;
  cpCost: number;
  cpDeducted: boolean;
  
  // 타이밍 (틱 단위)
  createdAt: Date;
  waitTicks: number;         // 대기 시간 (틱)
  durationTicks: number;     // 실행 시간 (틱)
  startTick: number;         // 시작 틱
  waitEndTick: number;       // 대기 완료 틱
  executionEndTick: number;  // 실행 완료 틱
  
  // 상태
  state: CommandPipelineState;
  currentTick: number;
  
  // 파라미터 (커맨드별 추가 데이터)
  params?: Record<string, unknown>;
  
  // 결과
  result?: Record<string, unknown>;
  error?: string;
}

export interface ExecuteCommandRequest {
  sessionId: string;
  characterId: string;
  commandId: string;
  params?: Record<string, unknown>;
  allowSubstitution?: boolean; // CP 대용 소모 허용 (기본: true)
}

export interface ExecuteCommandResult {
  success: boolean;
  pipelineId?: string;
  estimatedCompletionTicks?: number;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Service
// ============================================================================

export class CPManager extends EventEmitter {
  private static instance: CPManager;
  private commandMap: Map<string, ICommandDefinition>;
  
  // 활성 파이프라인 (sessionId:characterId → entries[])
  private pipelines: Map<string, CommandPipelineEntry[]> = new Map();
  
  // 전체 파이프라인 인덱스 (pipelineId → entry)
  private pipelineIndex: Map<string, CommandPipelineEntry> = new Map();
  
  private isSubscribed: boolean = false;

  private constructor() {
    super();
    this.commandMap = new Map(COMMAND_DEFINITIONS.map((c) => [c.id, c]));
    this.setMaxListeners(100);
  }

  public static getInstance(): CPManager {
    if (!CPManager.instance) {
      CPManager.instance = new CPManager();
    }
    return CPManager.instance;
  }

  /**
   * TimeEngine 구독
   */
  public subscribe(): void {
    if (this.isSubscribed) return;

    const timeEngine = TimeEngine.getInstance();
    timeEngine.on(GIN7_EVENTS.TIME_TICK, this.handleTimeTick.bind(this));
    this.isSubscribed = true;

    logger.info('[CPManager] Subscribed to TimeEngine');
  }

  /**
   * TimeEngine 구독 해제
   */
  public unsubscribe(): void {
    if (!this.isSubscribed) return;

    const timeEngine = TimeEngine.getInstance();
    timeEngine.off(GIN7_EVENTS.TIME_TICK, this.handleTimeTick.bind(this));
    this.isSubscribed = false;

    logger.info('[CPManager] Unsubscribed from TimeEngine');
  }

  // ==========================================================================
  // Command Execution
  // ==========================================================================

  /**
   * 커맨드 실행 요청
   */
  async executeCommand(request: ExecuteCommandRequest): Promise<ExecuteCommandResult> {
    const { sessionId, characterId, commandId, params, allowSubstitution = true } = request;

    // 1. 커맨드 정의 조회
    const command = this.commandMap.get(commandId);
    if (!command) {
      return {
        success: false,
        error: `Unknown command: ${commandId}`,
        errorCode: 'UNKNOWN_COMMAND',
      };
    }

    // 2. 캐릭터 조회
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return {
        success: false,
        error: 'Character not found',
        errorCode: 'CHARACTER_NOT_FOUND',
      };
    }

    // 3. 동시 실행 제한 체크
    const key = `${sessionId}:${characterId}`;
    const activeCommands = this.getActiveCommands(sessionId, characterId);
    if (activeCommands.length >= CP_TIME_CONSTANTS.MAX_CONCURRENT_COMMANDS) {
      return {
        success: false,
        error: `Maximum concurrent commands (${CP_TIME_CONSTANTS.MAX_CONCURRENT_COMMANDS}) reached`,
        errorCode: 'MAX_COMMANDS_REACHED',
      };
    }

    // 4. CP 검증 및 차감
    const cpResult = await this.deductCP(
      character as IGin7Character, 
      command.cost, 
      command.costType, 
      allowSubstitution
    );
    
    if (!cpResult.success) {
      return {
        success: false,
        error: cpResult.error,
        errorCode: 'INSUFFICIENT_CP',
      };
    }

    // 5. 파이프라인 엔트리 생성
    const pipelineId = `CMD-${uuidv4().slice(0, 8)}`;
    const currentTick = this.getCurrentTick(sessionId);
    const waitTicks = CP_TIME_CONSTANTS.GAME_HOURS_TO_TICKS(command.wait);
    const durationTicks = CP_TIME_CONSTANTS.GAME_HOURS_TO_TICKS(command.duration);

    const entry: CommandPipelineEntry = {
      id: pipelineId,
      sessionId,
      characterId,
      commandId,
      commandName: command.name,
      cpType: command.costType,
      cpCost: cpResult.actualCost,
      cpDeducted: true,
      createdAt: new Date(),
      waitTicks,
      durationTicks,
      startTick: currentTick,
      waitEndTick: currentTick + waitTicks,
      executionEndTick: currentTick + waitTicks + durationTicks,
      state: waitTicks > 0 ? 'WAITING' : (durationTicks > 0 ? 'EXECUTING' : 'COMPLETED'),
      currentTick,
      params,
    };

    // 6. 파이프라인 등록
    if (!this.pipelines.has(key)) {
      this.pipelines.set(key, []);
    }
    this.pipelines.get(key)!.push(entry);
    this.pipelineIndex.set(pipelineId, entry);

    // 7. 이벤트 발행
    this.emit('command:queued', {
      pipelineId,
      sessionId,
      characterId,
      commandId,
      commandName: command.name,
      state: entry.state,
      waitTicks,
      durationTicks,
    });

    // 8. 즉시 완료 처리 (wait=0, duration=0)
    if (entry.state === 'COMPLETED') {
      await this.completeCommand(entry);
    }

    logger.info('[CPManager] Command queued', {
      pipelineId,
      sessionId,
      characterId,
      commandId,
      waitTicks,
      durationTicks,
      state: entry.state,
    });

    return {
      success: true,
      pipelineId,
      estimatedCompletionTicks: waitTicks + durationTicks,
    };
  }

  /**
   * 커맨드 취소
   */
  async cancelCommand(
    sessionId: string,
    characterId: string,
    pipelineId: string
  ): Promise<{ success: boolean; refundedCp?: number; error?: string }> {
    const entry = this.pipelineIndex.get(pipelineId);

    if (!entry) {
      return { success: false, error: 'Command not found' };
    }

    if (entry.sessionId !== sessionId || entry.characterId !== characterId) {
      return { success: false, error: 'Command does not belong to this character' };
    }

    if (entry.state === 'COMPLETED' || entry.state === 'CANCELLED' || entry.state === 'FAILED') {
      return { success: false, error: `Cannot cancel command in state: ${entry.state}` };
    }

    // WAITING 상태에서 취소 시 CP 일부 환불 (50%)
    let refundedCp = 0;
    if (entry.state === 'WAITING' && entry.cpDeducted) {
      refundedCp = Math.floor(entry.cpCost * 0.5);
      await this.refundCP(sessionId, characterId, refundedCp, entry.cpType);
    }

    entry.state = 'CANCELLED';
    this.cleanupEntry(pipelineId);

    this.emit('command:cancelled', {
      pipelineId,
      sessionId,
      characterId,
      commandId: entry.commandId,
      refundedCp,
    });

    logger.info('[CPManager] Command cancelled', {
      pipelineId,
      refundedCp,
    });

    return { success: true, refundedCp };
  }

  /**
   * 캐릭터의 활성 커맨드 목록
   */
  getActiveCommands(sessionId: string, characterId: string): CommandPipelineEntry[] {
    const key = `${sessionId}:${characterId}`;
    const entries = this.pipelines.get(key) || [];
    return entries.filter(e => 
      e.state === 'PENDING' || e.state === 'WAITING' || e.state === 'EXECUTING'
    );
  }

  /**
   * 커맨드 상태 조회
   */
  getCommandStatus(pipelineId: string): CommandPipelineEntry | undefined {
    return this.pipelineIndex.get(pipelineId);
  }

  /**
   * 커맨드 진행률 (0-100)
   */
  getCommandProgress(pipelineId: string, currentTick: number): number {
    const entry = this.pipelineIndex.get(pipelineId);
    if (!entry) return 100;

    const totalTicks = entry.waitTicks + entry.durationTicks;
    if (totalTicks === 0) return 100;

    const elapsed = currentTick - entry.startTick;
    return Math.min(100, Math.max(0, Math.round((elapsed / totalTicks) * 100)));
  }

  // ==========================================================================
  // Time Tick Handler
  // ==========================================================================

  /**
   * 시간 틱 처리
   */
  private async handleTimeTick(payload: TimeTickPayload): Promise<void> {
    const { sessionId, tick } = payload;

    for (const [key, entries] of this.pipelines) {
      if (!key.startsWith(`${sessionId}:`)) continue;

      for (const entry of entries) {
        if (entry.state === 'COMPLETED' || entry.state === 'CANCELLED' || entry.state === 'FAILED') {
          continue;
        }

        entry.currentTick = tick;

        // WAITING → EXECUTING 전환
        if (entry.state === 'WAITING' && tick >= entry.waitEndTick) {
          entry.state = 'EXECUTING';
          this.emit('command:executing', {
            pipelineId: entry.id,
            sessionId: entry.sessionId,
            characterId: entry.characterId,
            commandId: entry.commandId,
          });
        }

        // EXECUTING → COMPLETED 전환
        if (entry.state === 'EXECUTING' && tick >= entry.executionEndTick) {
          await this.completeCommand(entry);
        }
      }
    }
  }

  /**
   * 커맨드 완료 처리
   */
  private async completeCommand(entry: CommandPipelineEntry): Promise<void> {
    entry.state = 'COMPLETED';

    this.emit('command:completed', {
      pipelineId: entry.id,
      sessionId: entry.sessionId,
      characterId: entry.characterId,
      commandId: entry.commandId,
      commandName: entry.commandName,
      params: entry.params,
    });

    logger.info('[CPManager] Command completed', {
      pipelineId: entry.id,
      commandId: entry.commandId,
    });

    // 일정 시간 후 정리 (5분)
    setTimeout(() => this.cleanupEntry(entry.id), 5 * 60 * 1000);
  }

  /**
   * 파이프라인 엔트리 정리
   */
  private cleanupEntry(pipelineId: string): void {
    const entry = this.pipelineIndex.get(pipelineId);
    if (!entry) return;

    const key = `${entry.sessionId}:${entry.characterId}`;
    const entries = this.pipelines.get(key);
    
    if (entries) {
      const idx = entries.findIndex(e => e.id === pipelineId);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
    }

    this.pipelineIndex.delete(pipelineId);
  }

  // ==========================================================================
  // CP Management
  // ==========================================================================

  /**
   * CP 차감
   */
  private async deductCP(
    character: IGin7Character,
    cost: number,
    cpType: CommandType,
    allowSubstitution: boolean
  ): Promise<{ success: boolean; actualCost: number; actualType: CommandType; error?: string }> {
    if (cost <= 0) {
      return { success: true, actualCost: 0, actualType: cpType };
    }

    const cp = character.commandPoints || { pcp: 0, mcp: 0, maxPcp: 24, maxMcp: 24, lastRecoveredAt: new Date() };

    // 기본 CP 타입으로 차감 시도
    if (cpType === 'PCP') {
      if (cp.pcp >= cost) {
        await Gin7Character.updateOne(
          { sessionId: character.sessionId, characterId: character.characterId },
          { $inc: { 'commandPoints.pcp': -cost } }
        );
        return { success: true, actualCost: cost, actualType: 'PCP' };
      }

      // 대용 소모 (MCP로 2배)
      if (allowSubstitution) {
        const subCost = cost * CP_TIME_CONSTANTS.SUBSTITUTION_MULTIPLIER;
        if (cp.mcp >= subCost) {
          await Gin7Character.updateOne(
            { sessionId: character.sessionId, characterId: character.characterId },
            { $inc: { 'commandPoints.mcp': -subCost } }
          );
          return { success: true, actualCost: subCost, actualType: 'MCP' };
        }
      }

      return { success: false, actualCost: 0, actualType: cpType, error: `Insufficient PCP (need: ${cost}, have: ${cp.pcp})` };
    }

    if (cpType === 'MCP') {
      if (cp.mcp >= cost) {
        await Gin7Character.updateOne(
          { sessionId: character.sessionId, characterId: character.characterId },
          { $inc: { 'commandPoints.mcp': -cost } }
        );
        return { success: true, actualCost: cost, actualType: 'MCP' };
      }

      // 대용 소모 (PCP로 2배)
      if (allowSubstitution) {
        const subCost = cost * CP_TIME_CONSTANTS.SUBSTITUTION_MULTIPLIER;
        if (cp.pcp >= subCost) {
          await Gin7Character.updateOne(
            { sessionId: character.sessionId, characterId: character.characterId },
            { $inc: { 'commandPoints.pcp': -subCost } }
          );
          return { success: true, actualCost: subCost, actualType: 'PCP' };
        }
      }

      return { success: false, actualCost: 0, actualType: cpType, error: `Insufficient MCP (need: ${cost}, have: ${cp.mcp})` };
    }

    return { success: false, actualCost: 0, actualType: cpType, error: 'Invalid CP type' };
  }

  /**
   * CP 환불
   */
  private async refundCP(
    sessionId: string,
    characterId: string,
    amount: number,
    cpType: CommandType
  ): Promise<void> {
    if (amount <= 0) return;

    const field = cpType === 'PCP' ? 'commandPoints.pcp' : 'commandPoints.mcp';
    const maxField = cpType === 'PCP' ? 'commandPoints.maxPcp' : 'commandPoints.maxMcp';

    // 최대치 초과 방지를 위해 현재 값 확인 후 업데이트
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) return;

    const currentCp = cpType === 'PCP' 
      ? (character.commandPoints?.pcp || 0)
      : (character.commandPoints?.mcp || 0);
    const maxCp = cpType === 'PCP'
      ? (character.commandPoints?.maxPcp || 24)
      : (character.commandPoints?.maxMcp || 24);

    const actualRefund = Math.min(amount, maxCp - currentCp);
    
    if (actualRefund > 0) {
      await Gin7Character.updateOne(
        { sessionId, characterId },
        { $inc: { [field]: actualRefund } }
      );
    }
  }

  /**
   * 현재 틱 조회 (TimeEngine에서)
   */
  private getCurrentTick(sessionId: string): number {
    try {
      const timeEngine = TimeEngine.getInstance();
      // TimeEngine에서 세션별 틱 조회 (구현에 따라 다름)
      // 여기서는 기본값 반환
      return 0;
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * 커맨드 정의 조회
   */
  getCommandDefinition(commandId: string): ICommandDefinition | undefined {
    return this.commandMap.get(commandId);
  }

  /**
   * 예상 완료 시간 계산 (게임 시간)
   */
  estimateCompletionTime(commandId: string): { waitHours: number; durationHours: number; totalHours: number } | null {
    const command = this.commandMap.get(commandId);
    if (!command) return null;

    return {
      waitHours: command.wait,
      durationHours: command.duration,
      totalHours: command.wait + command.duration,
    };
  }
}

// 싱글톤 인스턴스
export const cpManager = CPManager.getInstance();

export default CPManager;





