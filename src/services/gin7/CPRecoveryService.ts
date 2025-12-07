/**
 * GIN7 CP Recovery Service
 * 
 * Command Point 자연 회복 스케줄러
 * TimeEngine과 연동하여 게임 시간 기반으로 CP를 회복합니다.
 * 
 * @see agents/gin7-agents/gin7-auth-card/INITIAL_PROMPT.md
 * - 자연 회복: 게임 2시간마다 (현실 5분)
 * - 회복량: 관련 스탯 비례 (politics -> PCP, command -> MCP)
 * - 대용 소모: 부족 시 다른 CP로 2배 소모
 */

import { EventEmitter } from 'events';
import { TimeEngine, GIN7_EVENTS, TimeTickPayload } from '../../core/gin7/TimeEngine';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

/** CP 회복 설정 */
export interface CPRecoveryConfig {
  /** 회복 주기 (게임 시간 단위, 기본 2시간 = 120분) */
  recoveryIntervalGameMinutes: number;
  /** 기본 회복량 */
  baseRecoveryAmount: number;
  /** 최대 PCP */
  maxPcp: number;
  /** 최대 MCP */
  maxMcp: number;
  /** 스탯 보너스 계수 (스탯 50 기준, 10당 추가량) */
  statBonusPerTen: number;
}

const DEFAULT_CONFIG: CPRecoveryConfig = {
  recoveryIntervalGameMinutes: 120, // 게임 2시간
  baseRecoveryAmount: 1,
  maxPcp: 24,
  maxMcp: 24,
  statBonusPerTen: 0.2,
};

/**
 * CP Recovery Service
 * 
 * TimeEngine의 TIME_TICK 이벤트를 구독하여 
 * 일정 간격으로 모든 활성 캐릭터의 CP를 회복합니다.
 */
export class CPRecoveryService extends EventEmitter {
  private static instance: CPRecoveryService;
  private config: CPRecoveryConfig;
  private lastRecoveryTick: Map<string, number> = new Map(); // sessionId -> lastTick
  private isSubscribed: boolean = false;

  // 게임 1분 = 현실 몇 초? (timeScale 24 기준: 24 게임초 = 1 현실초, 즉 1 게임분 = 60/24 = 2.5초)
  // 따라서 게임 120분 = 120 * 2.5초 = 300초 = 5분 (현실)
  // 틱 기준: 1틱 = 1초, timeScale=24 → 1틱 = 24 게임초
  // 게임 120분 = 7200 게임초 = 7200/24 = 300 틱

  private constructor(config?: Partial<CPRecoveryConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<CPRecoveryConfig>): CPRecoveryService {
    if (!CPRecoveryService.instance) {
      CPRecoveryService.instance = new CPRecoveryService(config);
    }
    return CPRecoveryService.instance;
  }

  /**
   * TimeEngine에 구독 시작
   */
  public subscribe(): void {
    if (this.isSubscribed) {
      logger.warn('[CPRecoveryService] Already subscribed to TimeEngine');
      return;
    }

    const timeEngine = TimeEngine.getInstance();
    timeEngine.on(GIN7_EVENTS.TIME_TICK, this.handleTimeTick.bind(this));
    this.isSubscribed = true;

    logger.info('[CPRecoveryService] Subscribed to TimeEngine');
  }

  /**
   * TimeEngine 구독 해제
   */
  public unsubscribe(): void {
    if (!this.isSubscribed) return;

    const timeEngine = TimeEngine.getInstance();
    timeEngine.off(GIN7_EVENTS.TIME_TICK, this.handleTimeTick.bind(this));
    this.isSubscribed = false;

    logger.info('[CPRecoveryService] Unsubscribed from TimeEngine');
  }

  /**
   * TIME_TICK 이벤트 핸들러
   * 
   * 게임 120분 (약 300틱, timeScale=24 기준)마다 CP 회복 실행
   */
  private async handleTimeTick(payload: TimeTickPayload): Promise<void> {
    const { sessionId, tick, gameDate } = payload;
    
    // 회복 주기 계산 (틱 단위)
    // 게임 분 -> 틱 변환: gameMinutes * 60 / timeScale
    // timeScale=24 기준: 120 * 60 / 24 = 300 틱
    const ticksPerRecovery = Math.floor(
      (this.config.recoveryIntervalGameMinutes * 60) / (payload.realtimeSpeed || 24)
    );

    const lastTick = this.lastRecoveryTick.get(sessionId) || 0;
    
    // 회복 주기가 지났는지 확인
    if (tick - lastTick < ticksPerRecovery) {
      return;
    }

    // 회복 실행
    this.lastRecoveryTick.set(sessionId, tick);

    try {
      await this.recoverAllCharacters(sessionId, gameDate);
    } catch (error) {
      logger.error('[CPRecoveryService] Recovery failed:', { sessionId, error });
    }
  }

  /**
   * 세션의 모든 활성 캐릭터 CP 회복
   */
  private async recoverAllCharacters(sessionId: string, gameDate: any): Promise<void> {
    // 활성 상태의 모든 캐릭터 조회
    const characters = await Gin7Character.find({
      sessionId,
      state: { $nin: ['dead', 'battle'] } // 사망/전투 중이 아닌 캐릭터만
    });

    if (characters.length === 0) return;

    let recoveredCount = 0;

    for (const character of characters) {
      const recovered = await this.recoverCharacterCP(character as IGin7Character);
      if (recovered) recoveredCount++;
    }

    if (recoveredCount > 0) {
      logger.info('[CPRecoveryService] CP recovered', {
        sessionId,
        recoveredCount,
        totalCharacters: characters.length,
        gameTime: gameDate
      });

      this.emit('cp:recovered', {
        sessionId,
        recoveredCount,
        gameTime: gameDate
      });
    }
  }

  /**
   * 단일 캐릭터 CP 회복
   * 
   * 회복량 계산:
   * - PCP: baseAmount + (politics - 50) * bonusPerTen / 10
   * - MCP: baseAmount + (command - 50) * bonusPerTen / 10
   */
  private async recoverCharacterCP(character: IGin7Character): Promise<boolean> {
    if (!character.commandPoints) {
      character.commandPoints = {
        pcp: this.config.maxPcp,
        mcp: this.config.maxMcp,
        maxPcp: this.config.maxPcp,
        maxMcp: this.config.maxMcp,
        lastRecoveredAt: new Date()
      };
      await character.save();
      return true;
    }

    const stats = character.stats || { politics: 50, command: 50 };
    const politics = stats.politics || 50;
    const command = stats.command || 50;

    // 회복량 계산
    const pcpRecovery = Math.max(1, Math.round(
      this.config.baseRecoveryAmount + 
      ((politics - 50) / 10) * this.config.statBonusPerTen
    ));
    
    const mcpRecovery = Math.max(1, Math.round(
      this.config.baseRecoveryAmount + 
      ((command - 50) / 10) * this.config.statBonusPerTen
    ));

    const prevPcp = character.commandPoints.pcp;
    const prevMcp = character.commandPoints.mcp;
    const maxPcp = character.commandPoints.maxPcp || this.config.maxPcp;
    const maxMcp = character.commandPoints.maxMcp || this.config.maxMcp;

    // 회복 (최대치 초과 방지)
    character.commandPoints.pcp = Math.min(maxPcp, prevPcp + pcpRecovery);
    character.commandPoints.mcp = Math.min(maxMcp, prevMcp + mcpRecovery);
    character.commandPoints.lastRecoveredAt = new Date();

    // 변화가 있을 때만 저장
    if (character.commandPoints.pcp !== prevPcp || character.commandPoints.mcp !== prevMcp) {
      await character.save();
      return true;
    }

    return false;
  }

  /**
   * 수동 CP 회복 (테스트/어드민용)
   */
  public async forceRecover(sessionId: string, characterId?: string): Promise<number> {
    if (characterId) {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) return 0;
      const recovered = await this.recoverCharacterCP(character as IGin7Character);
      return recovered ? 1 : 0;
    }

    const characters = await Gin7Character.find({ sessionId });
    let count = 0;
    for (const char of characters) {
      const recovered = await this.recoverCharacterCP(char as IGin7Character);
      if (recovered) count++;
    }
    return count;
  }

  /**
   * 설정 업데이트
   */
  public updateConfig(config: Partial<CPRecoveryConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[CPRecoveryService] Config updated', this.config);
  }

  /**
   * 현재 설정 조회
   */
  public getConfig(): CPRecoveryConfig {
    return { ...this.config };
  }
}

export default CPRecoveryService;

