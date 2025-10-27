import { logger } from '../common/utils/logger';

export class GameLoop {
  private startTime: number;
  private isRunning = false;
  private tickInterval?: NodeJS.Timeout;

  constructor() {
    this.startTime = Date.now();
  }

  start() {
    this.isRunning = true;
    logger.info('🕐 Game loop started (24x speed)');

    this.tickInterval = setInterval(() => {
      if (this.isRunning) {
        this.tick();
      }
    }, 1000);
  }

  stop() {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    logger.info('⏸️  Game loop stopped');
  }

  private async tick() {
    try {
      const now = this.getGameTime();

      // TODO: 1. 커맨드 완료 확인
      await this.checkCommandCompletion(now);

      // TODO: 2. 이동 업데이트
      await this.updateMovements(now);

      // TODO: 3. 생산 업데이트
      await this.updateProductions(now);

      // TODO: 4. PCP/MCP 자동 회복
      await this.recoverCP(now);

      // TODO: 5. 월간 이벤트 (세금)
      if (this.isFirstDayOfMonth(now)) {
        await this.collectTaxes();
      }
    } catch (error) {
      logger.error('Game loop tick error:', error);
    }
  }

  private getGameTime(): Date {
    const elapsed = Date.now() - this.startTime;
    return new Date(elapsed * 24);
  }

  private async checkCommandCompletion(now: Date) {
    // TODO: Implement command completion check
  }

  private async updateMovements(now: Date) {
    // TODO: Implement movement updates
  }

  private async updateProductions(now: Date) {
    // TODO: Implement production updates
  }

  private async recoverCP(now: Date) {
    // TODO: Implement PCP/MCP recovery
  }

  private isFirstDayOfMonth(date: Date): boolean {
    return date.getDate() === 1;
  }

  private async collectTaxes() {
    logger.info('💰 Collecting monthly taxes...');
    // TODO: Implement tax collection
  }
}
