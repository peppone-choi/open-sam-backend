/**
 * GIN7 Job Card Service
 * 
 * 직위 권한 카드 → 커맨드 실행 권한 매핑 서비스
 * position_definitions.ts의 authorities 플래그와 
 * command_definitions.ts의 카테고리를 연결합니다.
 * 
 * @see gin7manual Chapter3 §직무권한
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { RankLadder } from '../../models/gin7/RankLadder';
import { POSITION_DEFINITIONS, IPositionDefinition } from '../../constants/gin7/position_definitions';
import { 
  COMMAND_DEFINITIONS, 
  ICommandDefinition, 
  CommandCategory 
} from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';

// ============================================================================
// Types
// ============================================================================

/** 권한 플래그 → 커맨드 카테고리 매핑 */
export const AUTHORITY_TO_COMMAND_CATEGORY: Record<string, CommandCategory[]> = {
  personnel: ['PERSONNEL'],
  personnel_high: ['PERSONNEL'],
  military: ['COMMAND', 'OPERATION'],
  fleet: ['TACTICAL', 'OPERATION', 'TRAINING'],
  finance: ['POLITICS'],
  intelligence: ['INTELLIGENCE', 'SECURITY'],
  admin: ['POLITICS', 'LOGISTICS'],
  diplomacy: ['POLITICS'],
};

/** 개인 커맨드 (직위 무관하게 실행 가능) */
export const PERSONAL_COMMANDS = new Set([
  'MOVE_LONG', 'MOVE_SHORT', 'RETIRE', 'VOLUNTEER', 'DEFECTION',
  'MEET', 'ATTEND_LECTURE', 'WAR_GAME', 'PLOT_REBELLION', 'CONSPIRE',
  'PERSUADE_TROOPS', 'REBEL', 'JOIN_REBELLION', 'INVEST_FUNDS', 'BUY_FLAGSHIP',
]);

/** 기본 군인 커맨드 (계급 있으면 실행 가능) */
export const BASIC_MILITARY_COMMANDS = new Set([
  'WARP', 'REFUEL', 'MOVE_SYSTEM',
  'MAINTAIN_DISCIPLINE', 'TRAIN_FLEET', 'TRAIN_GROUND', 'TRAIN_AIR',
  'TACTICS_GROUND', 'TACTICS_AIR',
]);

export interface CommandAuthCheckResult {
  allowed: boolean;
  commandId: string;
  commandName: string;
  reason?: string;
  requiredAuthority?: string;
  characterPosition?: string;
}

export interface CharacterAuthoritySummary {
  characterId: string;
  characterName: string;
  positionId: string | null;
  positionName: string | null;
  authorities: string[];
  availableCommands: string[];
  restrictedCommands: string[];
}

// ============================================================================
// Service Implementation
// ============================================================================

export class JobCardService extends EventEmitter {
  private static instance: JobCardService;
  private positionMap: Map<string, IPositionDefinition>;
  private commandMap: Map<string, ICommandDefinition>;

  private constructor() {
    super();
    this.positionMap = new Map(POSITION_DEFINITIONS.map((p) => [p.id, p]));
    this.commandMap = new Map(COMMAND_DEFINITIONS.map((c) => [c.id, c]));
  }

  public static getInstance(): JobCardService {
    if (!JobCardService.instance) {
      JobCardService.instance = new JobCardService();
    }
    return JobCardService.instance;
  }

  // ==========================================================================
  // Command Authorization
  // ==========================================================================

  /**
   * 커맨드 실행 권한 체크
   * 
   * 체크 순서:
   * 1. 개인 커맨드 → 무조건 허용
   * 2. 기본 군인 커맨드 → 계급 있으면 허용
   * 3. 직위 기반 커맨드 → 해당 권한 플래그 필요
   */
  async checkCommandAuth(
    sessionId: string,
    characterId: string,
    commandId: string
  ): Promise<CommandAuthCheckResult> {
    const command = this.commandMap.get(commandId);
    
    if (!command) {
      return {
        allowed: false,
        commandId,
        commandName: 'Unknown',
        reason: 'Invalid command ID',
      };
    }

    // 1. 개인 커맨드 체크
    if (PERSONAL_COMMANDS.has(commandId) || command.category === 'PERSONAL') {
      return {
        allowed: true,
        commandId,
        commandName: command.name,
        reason: 'Personal command - no authority required',
      };
    }

    // 캐릭터 정보 조회
    const [character, rankEntry] = await Promise.all([
      Gin7Character.findOne({ sessionId, characterId }),
      RankLadder.findOne({ sessionId, characterId, status: 'active' }),
    ]);

    if (!character) {
      return {
        allowed: false,
        commandId,
        commandName: command.name,
        reason: 'Character not found',
      };
    }

    // 2. 기본 군인 커맨드 체크
    if (BASIC_MILITARY_COMMANDS.has(commandId)) {
      if (rankEntry) {
        return {
          allowed: true,
          commandId,
          commandName: command.name,
          reason: 'Basic military command - rank exists',
          characterPosition: rankEntry.position?.positionName || 'None',
        };
      }
      
      return {
        allowed: false,
        commandId,
        commandName: command.name,
        reason: 'Military rank required for this command',
      };
    }

    // 3. 직위 기반 권한 체크
    const positionId = rankEntry?.position?.positionId;
    if (!positionId) {
      return {
        allowed: false,
        commandId,
        commandName: command.name,
        reason: 'Position required for this command',
      };
    }

    const position = this.positionMap.get(positionId as string);
    if (!position) {
      return {
        allowed: false,
        commandId,
        commandName: command.name,
        reason: 'Invalid position',
        characterPosition: positionId as string,
      };
    }

    // 직위 권한과 커맨드 카테고리 매칭
    const requiredAuthority = this.findRequiredAuthority(command.category);
    
    if (!requiredAuthority) {
      // 매핑되지 않은 카테고리 → 기본 허용 (추후 세분화)
      return {
        allowed: true,
        commandId,
        commandName: command.name,
        reason: 'Category not restricted',
        characterPosition: position.name,
      };
    }

    // 권한 플래그 체크
    const hasAuthority = this.checkPositionAuthority(position, requiredAuthority);
    
    if (hasAuthority) {
      return {
        allowed: true,
        commandId,
        commandName: command.name,
        characterPosition: position.name,
      };
    }

    // 권한 카드 체크 (commandCards에 해당 권한이 있는지)
    const hasCardAuthority = this.checkCardAuthority(character, command.category);
    
    if (hasCardAuthority) {
      return {
        allowed: true,
        commandId,
        commandName: command.name,
        reason: 'Authority granted via command card',
        characterPosition: position.name,
      };
    }

    return {
      allowed: false,
      commandId,
      commandName: command.name,
      reason: `Authority '${requiredAuthority}' required`,
      requiredAuthority,
      characterPosition: position.name,
    };
  }

  /**
   * 캐릭터가 실행 가능한 모든 커맨드 목록
   */
  async getAvailableCommands(
    sessionId: string,
    characterId: string
  ): Promise<CharacterAuthoritySummary> {
    const [character, rankEntry] = await Promise.all([
      Gin7Character.findOne({ sessionId, characterId }),
      RankLadder.findOne({ sessionId, characterId, status: 'active' }),
    ]);

    if (!character) {
      return {
        characterId,
        characterName: 'Unknown',
        positionId: null,
        positionName: null,
        authorities: [],
        availableCommands: [],
        restrictedCommands: [],
      };
    }

    const positionId = rankEntry?.position?.positionId as string | null;
    const position = positionId ? this.positionMap.get(positionId) : null;
    
    // 직위 권한 플래그 수집
    const authorities = position ? this.getPositionAuthorities(position) : [];
    
    // 커맨드 카드에서 추가 권한 수집
    const cardAuthorities = this.getCardAuthorities(character);
    const allAuthorities = [...new Set([...authorities, ...cardAuthorities])];

    const availableCommands: string[] = [];
    const restrictedCommands: string[] = [];

    for (const command of COMMAND_DEFINITIONS) {
      // 개인 커맨드
      if (PERSONAL_COMMANDS.has(command.id) || command.category === 'PERSONAL') {
        availableCommands.push(command.id);
        continue;
      }

      // 기본 군인 커맨드
      if (BASIC_MILITARY_COMMANDS.has(command.id)) {
        if (rankEntry) {
          availableCommands.push(command.id);
        } else {
          restrictedCommands.push(command.id);
        }
        continue;
      }

      // 직위/카드 기반 권한
      const requiredAuthority = this.findRequiredAuthority(command.category);
      if (!requiredAuthority || allAuthorities.includes(requiredAuthority)) {
        availableCommands.push(command.id);
      } else {
        restrictedCommands.push(command.id);
      }
    }

    return {
      characterId,
      characterName: character.name,
      positionId,
      positionName: position?.name || null,
      authorities: allAuthorities,
      availableCommands,
      restrictedCommands,
    };
  }

  /**
   * 특정 직위가 실행 가능한 커맨드 목록
   */
  getPositionCommands(positionId: string): string[] {
    const position = this.positionMap.get(positionId);
    if (!position) return [];

    const authorities = this.getPositionAuthorities(position);
    const availableCommands: string[] = [];

    for (const command of COMMAND_DEFINITIONS) {
      if (PERSONAL_COMMANDS.has(command.id)) {
        continue; // 개인 커맨드 제외
      }

      const requiredAuthority = this.findRequiredAuthority(command.category);
      if (!requiredAuthority || authorities.includes(requiredAuthority)) {
        availableCommands.push(command.id);
      }
    }

    return availableCommands;
  }

  // ==========================================================================
  // Authority Card Management
  // ==========================================================================

  /**
   * 직위 임명 시 권한 카드 발급
   */
  async grantPositionCards(
    sessionId: string,
    characterId: string,
    positionId: string
  ): Promise<string[]> {
    const position = this.positionMap.get(positionId);
    if (!position) return [];

    const cardIds = this.generateCardIds(position);
    
    if (cardIds.length === 0) return [];

    const newCards = cardIds.map((cardId) => ({
      cardId,
      name: this.getCardName(cardId, position),
      category: 'position' as const,
      commands: this.getCardCommands(position),
    }));

    await Gin7Character.updateOne(
      { sessionId, characterId },
      { $push: { commandCards: { $each: newCards } } }
    );

    logger.info('[JobCardService] Position cards granted', {
      sessionId,
      characterId,
      positionId,
      cardIds,
    });

    this.emit('cards:granted', {
      sessionId,
      characterId,
      positionId,
      cardIds,
    });

    return cardIds;
  }

  /**
   * 직위 해임 시 권한 카드 회수
   */
  async revokePositionCards(
    sessionId: string,
    characterId: string,
    positionId: string
  ): Promise<string[]> {
    const position = this.positionMap.get(positionId);
    if (!position) return [];

    const cardIds = this.generateCardIds(position);
    
    if (cardIds.length === 0) return [];

    await Gin7Character.updateOne(
      { sessionId, characterId },
      { $pull: { commandCards: { cardId: { $in: cardIds } } } }
    );

    logger.info('[JobCardService] Position cards revoked', {
      sessionId,
      characterId,
      positionId,
      cardIds,
    });

    this.emit('cards:revoked', {
      sessionId,
      characterId,
      positionId,
      cardIds,
    });

    return cardIds;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * 커맨드 카테고리 → 필요 권한 플래그
   */
  private findRequiredAuthority(category: CommandCategory): string | null {
    for (const [authority, categories] of Object.entries(AUTHORITY_TO_COMMAND_CATEGORY)) {
      if (categories.includes(category)) {
        return authority;
      }
    }
    return null;
  }

  /**
   * 직위 권한 플래그 체크
   */
  private checkPositionAuthority(
    position: IPositionDefinition,
    authority: string
  ): boolean {
    if (!position.authorities) return false;
    return (position.authorities as Record<string, boolean>)[authority] === true;
  }

  /**
   * 직위의 모든 권한 플래그 추출
   */
  private getPositionAuthorities(position: IPositionDefinition): string[] {
    if (!position.authorities) return [];
    
    return Object.entries(position.authorities)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  }

  /**
   * 커맨드 카드 기반 권한 체크
   */
  private checkCardAuthority(
    character: IGin7Character,
    category: CommandCategory
  ): boolean {
    if (!character.commandCards?.length) return false;

    const requiredAuthority = this.findRequiredAuthority(category);
    if (!requiredAuthority) return false;

    // 카드 ID에 권한 플래그가 포함되어 있는지 체크
    return character.commandCards.some((card) => {
      const cardId = card.cardId?.toLowerCase() || '';
      return cardId.includes(requiredAuthority);
    });
  }

  /**
   * 커맨드 카드에서 권한 플래그 추출
   */
  private getCardAuthorities(character: IGin7Character): string[] {
    if (!character.commandCards?.length) return [];

    const authorities: Set<string> = new Set();
    
    for (const card of character.commandCards) {
      const cardId = card.cardId?.toLowerCase() || '';
      
      for (const authority of Object.keys(AUTHORITY_TO_COMMAND_CATEGORY)) {
        if (cardId.includes(authority)) {
          authorities.add(authority);
        }
      }
    }

    return [...authorities];
  }

  /**
   * 직위 권한 플래그 → 카드 ID 생성
   */
  private generateCardIds(position: IPositionDefinition): string[] {
    const cardIds: string[] = [];
    const prefix = `position:${position.id}`;
    const authorities = position.authorities || {};

    for (const [key, value] of Object.entries(authorities)) {
      if (value === true) {
        cardIds.push(`${prefix}:${key}`);
      }
    }

    return cardIds;
  }

  /**
   * 카드 이름 생성
   */
  private getCardName(cardId: string, position: IPositionDefinition): string {
    const parts = cardId.split(':');
    const authority = parts[parts.length - 1];
    
    const authorityNames: Record<string, string> = {
      personnel: '인사권',
      personnel_high: '고위 인사권',
      military: '군령권',
      fleet: '함대 지휘권',
      finance: '재정권',
      intelligence: '첩보/치안권',
      admin: '행정권',
      diplomacy: '외교권',
    };

    return `${position.name} - ${authorityNames[authority] || authority}`;
  }

  /**
   * 직위의 실행 가능 커맨드 목록
   */
  private getCardCommands(position: IPositionDefinition): string[] {
    return this.getPositionCommands(position.id);
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * 커맨드 정의 조회
   */
  getCommandDefinition(commandId: string): ICommandDefinition | undefined {
    return this.commandMap.get(commandId);
  }

  /**
   * 직위 정의 조회
   */
  getPositionDefinition(positionId: string): IPositionDefinition | undefined {
    return this.positionMap.get(positionId);
  }

  /**
   * 모든 커맨드 카테고리별 분류
   */
  getCommandsByCategory(): Record<CommandCategory, ICommandDefinition[]> {
    const result: Record<CommandCategory, ICommandDefinition[]> = {
      OPERATION: [],
      TRAINING: [],
      SECURITY: [],
      TACTICAL: [],
      PERSONAL: [],
      COMMAND: [],
      LOGISTICS: [],
      PERSONNEL: [],
      POLITICS: [],
      INTELLIGENCE: [],
    };

    for (const command of COMMAND_DEFINITIONS) {
      result[command.category].push(command);
    }

    return result;
  }
}

export default JobCardService;





