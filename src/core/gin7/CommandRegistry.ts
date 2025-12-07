/**
 * GIN7 Command Registry
 * 
 * 직무 권한 카드 시스템에서 사용되는 커맨드를 등록하고 관리합니다.
 * 다른 에이전트들은 이 레지스트리에 커맨드를 등록하여 
 * 직무 카드를 통해 실행할 수 있습니다.
 * 
 * @see agents/gin7-agents/gin7-auth-card/INITIAL_PROMPT.md
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';

/**
 * 커맨드 실행 컨텍스트
 */
export interface Gin7CommandContext {
  sessionId: string;
  character: IGin7Character;
  cardId: string;
  args: Record<string, any>;
}

/**
 * 커맨드 실행 결과
 */
export interface Gin7CommandResult {
  success: boolean;
  message: string;
  data?: any;
  cpConsumed?: { pcp?: number; mcp?: number };
  experienceGained?: number;
}

/**
 * 커맨드 인터페이스
 * 
 * 모든 GIN7 커맨드는 이 인터페이스를 구현해야 합니다.
 */
export interface IGin7Command {
  /** 커맨드 고유 ID */
  id: string;
  
  /** 커맨드 이름 (표시용) */
  name: string;
  
  /** CP 소모 타입 */
  costType: 'PCP' | 'MCP' | 'BOTH' | 'NONE';
  
  /** CP 소모량 */
  costAmount: number;
  
  /** 이 커맨드를 사용할 수 있는 카드 타입들 */
  requiredCardTypes: string[];
  
  /**
   * 커맨드 실행 조건 검증
   * @returns null이면 실행 가능, 문자열이면 에러 메시지
   */
  validate(context: Gin7CommandContext): Promise<string | null>;
  
  /**
   * 커맨드 실행
   */
  execute(context: Gin7CommandContext): Promise<Gin7CommandResult>;
}

/**
 * 커맨드 메타데이터
 */
export interface Gin7CommandMeta {
  id: string;
  name: string;
  costType: 'PCP' | 'MCP' | 'BOTH' | 'NONE';
  costAmount: number;
  requiredCardTypes: string[];
  description?: string;
  group?: string;
}

/**
 * GIN7 Command Registry
 * 
 * 싱글톤 패턴으로 구현된 커맨드 레지스트리.
 * 모든 GIN7 커맨드의 등록, 조회, 실행을 담당합니다.
 */
export class Gin7CommandRegistry extends EventEmitter {
  private static instance: Gin7CommandRegistry;
  
  private commands: Map<string, IGin7Command> = new Map();
  private commandMeta: Map<string, Gin7CommandMeta> = new Map();
  private cardTypeCommands: Map<string, Set<string>> = new Map(); // cardType -> commandIds

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): Gin7CommandRegistry {
    if (!Gin7CommandRegistry.instance) {
      Gin7CommandRegistry.instance = new Gin7CommandRegistry();
    }
    return Gin7CommandRegistry.instance;
  }

  /**
   * 커맨드 등록
   * 
   * 다른 에이전트들은 이 메서드를 통해 자신의 커맨드를 등록합니다.
   * 
   * @example
   * Gin7CommandRegistry.getInstance().register(new RecruitCommand());
   */
  public register(command: IGin7Command): void {
    if (this.commands.has(command.id)) {
      logger.warn(`[Gin7CommandRegistry] Command '${command.id}' already registered, overwriting...`);
    }

    this.commands.set(command.id, command);

    // 메타데이터 저장
    this.commandMeta.set(command.id, {
      id: command.id,
      name: command.name,
      costType: command.costType,
      costAmount: command.costAmount,
      requiredCardTypes: command.requiredCardTypes,
    });

    // 카드 타입별 커맨드 인덱싱
    for (const cardType of command.requiredCardTypes) {
      if (!this.cardTypeCommands.has(cardType)) {
        this.cardTypeCommands.set(cardType, new Set());
      }
      this.cardTypeCommands.get(cardType)!.add(command.id);
    }

    logger.info(`[Gin7CommandRegistry] Command registered: ${command.id}`);
    this.emit('command:registered', { commandId: command.id });
  }

  /**
   * 여러 커맨드 일괄 등록
   */
  public registerAll(commands: IGin7Command[]): void {
    for (const command of commands) {
      this.register(command);
    }
    logger.info(`[Gin7CommandRegistry] ${commands.length} commands registered`);
  }

  /**
   * 커맨드 조회
   */
  public get(commandId: string): IGin7Command | undefined {
    return this.commands.get(commandId);
  }

  /**
   * 커맨드 메타데이터 조회
   */
  public getMeta(commandId: string): Gin7CommandMeta | undefined {
    return this.commandMeta.get(commandId);
  }

  /**
   * 특정 카드 타입으로 사용 가능한 커맨드 목록 조회
   */
  public getByCardType(cardType: string): string[] {
    return Array.from(this.cardTypeCommands.get(cardType) || []);
  }

  /**
   * 모든 등록된 커맨드 ID 조회
   */
  public getAllIds(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * 모든 등록된 커맨드 메타데이터 조회
   */
  public getAllMeta(): Gin7CommandMeta[] {
    return Array.from(this.commandMeta.values());
  }

  /**
   * 커맨드 등록 해제
   */
  public unregister(commandId: string): boolean {
    const command = this.commands.get(commandId);
    if (!command) return false;

    this.commands.delete(commandId);
    this.commandMeta.delete(commandId);

    // 카드 타입 인덱스에서도 제거
    for (const cardType of command.requiredCardTypes) {
      this.cardTypeCommands.get(cardType)?.delete(commandId);
    }

    logger.info(`[Gin7CommandRegistry] Command unregistered: ${commandId}`);
    this.emit('command:unregistered', { commandId });
    return true;
  }

  /**
   * 커맨드 실행
   * 
   * 검증 -> CP 차감 -> 실행 순으로 처리합니다.
   */
  public async execute(
    commandId: string,
    context: Gin7CommandContext
  ): Promise<Gin7CommandResult> {
    const command = this.commands.get(commandId);
    
    if (!command) {
      return {
        success: false,
        message: `커맨드 '${commandId}'를 찾을 수 없습니다.`
      };
    }

    // 1. 검증
    const validationError = await command.validate(context);
    if (validationError) {
      return {
        success: false,
        message: validationError
      };
    }

    // 2. CP 검증 및 Atomic 차감
    const cpResult = await this.validateAndDeductCPAtomic(context, command);
    if (!cpResult.success) {
      return cpResult;
    }

    // 3. 실행
    try {
      const result = await command.execute(context);

      this.emit('command:executed', {
        commandId,
        sessionId: context.sessionId,
        characterId: context.character.characterId,
        success: result.success
      });

      return {
        ...result,
        cpConsumed: cpResult.cpConsumed
      };
    } catch (error: any) {
      logger.error(`[Gin7CommandRegistry] Command execution failed:`, {
        commandId,
        error: error.message
      });

      // 실패 시 CP 롤백 (Atomic rollback)
      if (cpResult.cpConsumed) {
        const rollbackQuery: Record<string, number> = {};
        if (cpResult.cpConsumed.pcp) {
          rollbackQuery['commandPoints.pcp'] = cpResult.cpConsumed.pcp;
        }
        if (cpResult.cpConsumed.mcp) {
          rollbackQuery['commandPoints.mcp'] = cpResult.cpConsumed.mcp;
        }
        
        await Gin7Character.findOneAndUpdate(
          { sessionId: context.sessionId, characterId: context.character.characterId },
          { $inc: rollbackQuery }
        );
      }

      return {
        success: false,
        message: error.message || '커맨드 실행 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * CP 검증 및 Atomic 차감 (내부 메서드)
   * 
   * 동시 요청 시 Race Condition을 방지하기 위해
   * MongoDB findOneAndUpdate + $inc 연산을 사용합니다.
   */
  private async validateAndDeductCPAtomic(
    context: Gin7CommandContext,
    command: IGin7Command
  ): Promise<Gin7CommandResult & { cpConsumed?: { pcp?: number; mcp?: number } }> {
    if (command.costType === 'NONE' || command.costAmount === 0) {
      return { success: true, message: '' };
    }

    const character = context.character;
    const cp = character.commandPoints || { pcp: 0, mcp: 0 };
    const cost = command.costAmount;

    // 차감할 CP 타입 및 금액 결정
    let cpToDeduct: { pcp?: number; mcp?: number } = {};

    if (command.costType === 'PCP') {
      if (cp.pcp >= cost) {
        cpToDeduct = { pcp: cost };
      } else if (cp.mcp >= cost * 2) {
        // 대용 소모 (MCP 2배)
        cpToDeduct = { mcp: cost * 2 };
      } else {
        return {
          success: false,
          message: `정략 CP가 부족합니다. (필요: ${cost}, 보유: ${cp.pcp})`
        };
      }
    } else if (command.costType === 'MCP') {
      if (cp.mcp >= cost) {
        cpToDeduct = { mcp: cost };
      } else if (cp.pcp >= cost * 2) {
        // 대용 소모 (PCP 2배)
        cpToDeduct = { pcp: cost * 2 };
      } else {
        return {
          success: false,
          message: `군사 CP가 부족합니다. (필요: ${cost}, 보유: ${cp.mcp})`
        };
      }
    } else if (command.costType === 'BOTH') {
      if (cp.pcp >= cost && cp.mcp >= cost) {
        cpToDeduct = { pcp: cost, mcp: cost };
      } else {
        return {
          success: false,
          message: `CP가 부족합니다. (필요: PCP ${cost}, MCP ${cost})`
        };
      }
    }

    // Atomic 차감 실행
    const pcpCost = cpToDeduct.pcp || 0;
    const mcpCost = cpToDeduct.mcp || 0;

    const updateQuery: Record<string, number> = {};
    const matchQuery: Record<string, any> = {
      sessionId: context.sessionId,
      characterId: character.characterId
    };

    if (pcpCost > 0) {
      updateQuery['commandPoints.pcp'] = -pcpCost;
      matchQuery['commandPoints.pcp'] = { $gte: pcpCost };
    }
    if (mcpCost > 0) {
      updateQuery['commandPoints.mcp'] = -mcpCost;
      matchQuery['commandPoints.mcp'] = { $gte: mcpCost };
    }

    const result = await Gin7Character.findOneAndUpdate(
      matchQuery,
      { $inc: updateQuery },
      { new: true }
    );

    if (!result) {
      // Race Condition 발생
      return {
        success: false,
        message: 'CP 차감 실패: 동시 요청으로 인해 CP가 부족합니다. 다시 시도해주세요.'
      };
    }

    // 캐릭터 객체의 CP도 업데이트 (후속 로직에서 참조할 수 있도록)
    character.commandPoints.pcp = result.commandPoints?.pcp ?? 0;
    character.commandPoints.mcp = result.commandPoints?.mcp ?? 0;

    return { success: true, message: '', cpConsumed: cpToDeduct };
  }

  /**
   * 레지스트리 상태 조회
   */
  public getStats(): {
    totalCommands: number;
    cardTypes: string[];
    commandsByCardType: Record<string, number>;
  } {
    const commandsByCardType: Record<string, number> = {};
    for (const [cardType, commands] of this.cardTypeCommands) {
      commandsByCardType[cardType] = commands.size;
    }

    return {
      totalCommands: this.commands.size,
      cardTypes: Array.from(this.cardTypeCommands.keys()),
      commandsByCardType
    };
  }

  /**
   * 모든 커맨드 초기화 (테스트용)
   */
  public clear(): void {
    this.commands.clear();
    this.commandMeta.clear();
    this.cardTypeCommands.clear();
    logger.info('[Gin7CommandRegistry] Registry cleared');
  }
}

/**
 * 커맨드 등록 데코레이터 (선택적 사용)
 * 
 * @example
 * @registerGin7Command
 * class MyCommand implements IGin7Command { ... }
 */
export function registerGin7Command(target: new () => IGin7Command) {
  const instance = new target();
  Gin7CommandRegistry.getInstance().register(instance);
  return target;
}

export default Gin7CommandRegistry;

