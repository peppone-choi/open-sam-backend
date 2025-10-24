import { AppConfig } from '../config/app.config';
import { logger } from '../shared/utils/logger';
import { TurnHandler } from './handlers/turn.handler';
import { BattleHandler } from './handlers/battle.handler';

/**
 * Game Loop - 100ms마다 실행
 * 
 * 역할:
 * 1. 턴 진행 (24시간마다)
 * 2. 커맨드 완료 확인 (completionTime 체크)
 * 3. 전투 진행 (60 FPS)
 * 4. 이벤트 발생
 */
export class GameLoop {
  private intervalId: NodeJS.Timeout | null = null;
  private turnHandler: TurnHandler;
  private battleHandler: BattleHandler;
  private startTime: Date;

  constructor() {
    this.turnHandler = new TurnHandler();
    this.battleHandler = new BattleHandler();
    this.startTime = new Date();
  }

  start() {
    const interval = AppConfig.game.loopInterval; // 100ms

    this.intervalId = setInterval(() => {
      this.tick();
    }, interval);

    logger.info(`Game Loop started (${interval}ms interval)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Game Loop stopped');
    }
  }

  private async tick() {
    try {
      const now = this.getGameTime();

      // TODO: 1. 커맨드 완료 확인 (completionTime <= now)
      // TODO: 2. 턴 진행 (24시간 = 실시간 1시간)
      // TODO: 3. 전투 진행 (모든 ONGOING 전투)
      // TODO: 4. 자동 이벤트 (세금 징수, 자원 생산 등)

    } catch (error) {
      logger.error('Game Loop tick error:', error);
    }
  }

  /**
   * 현재 게임 시간 (24배속)
   * Hint: 실시간 경과 * 24
   */
  private getGameTime(): Date {
    const elapsed = Date.now() - this.startTime.getTime();
    const gameElapsed = elapsed * AppConfig.game.speedMultiplier;
    return new Date(this.startTime.getTime() + gameElapsed);
  }
}
