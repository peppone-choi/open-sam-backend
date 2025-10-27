import { RedisService } from '../infrastructure/cache/redis.service';
import { logger } from '../common/utils/logger';

export class CommandProcessor {
  private redis: RedisService;
  private isRunning = false;

  constructor() {
    this.redis = new RedisService();
  }

  async start() {
    this.isRunning = true;
    logger.info('🔄 Command processor started');

    // TODO: Consumer Group 생성
    try {
      // await this.redis.xgroupCreate('cmd:game', 'game-daemon', '0');
    } catch (error) {
      // Group already exists
    }

    this.poll();
  }

  stop() {
    this.isRunning = false;
    logger.info('⏸️  Command processor stopped');
  }

  private async poll() {
    while (this.isRunning) {
      try {
        // TODO: Implement xreadgroup
        const messages = await this.redis.xreadgroup(
          'game-daemon',
          'consumer-1',
          { 'cmd:game': '>' },
          { COUNT: 10, BLOCK: 1000 }
        );

        // TODO: Process messages
        if (messages && messages.length > 0) {
          // for (const [stream, streamMessages] of messages) {
          //   for (const [id, data] of streamMessages) {
          //     await this.processCommand(id, data);
          //   }
          // }
        }
      } catch (error) {
        logger.error('Poll error:', error);
        await this.sleep(1000);
      }
    }
  }

  private async processCommand(id: string, data: any) {
    try {
      const command = JSON.parse(data.payload);

      logger.info(`Processing command: ${command.type} (${id})`);

      switch (command.type) {
        case 'TRAIN_GENERAL':
          // TODO: Handle train
          break;

        case 'MOVE_GENERAL':
          // TODO: Handle move
          break;

        default:
          logger.warn(`Unknown command type: ${command.type}`);
      }

      // TODO: ACK
      await this.redis.xack('cmd:game', 'game-daemon', id);

    } catch (error) {
      logger.error(`Error processing command ${id}:`, error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
