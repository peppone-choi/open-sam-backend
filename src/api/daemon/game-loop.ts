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
    logger.info('🕐 게임 루프 시작 (24배속)');

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
    logger.info('⏸️  게임 루프 중지됨');
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
      logger.error('게임 루프 틱 오류:', error);
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
    logger.info('💰 월간 세금 징수 중...');
    // TODO: Implement tax collection
  }
}
