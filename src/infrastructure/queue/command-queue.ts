import { RedisService } from './redis.service';
import { logger } from '../../common/logger';

export interface CommandMessage {
  commandId: string;
  category: string;
  type: string;
  generalId: string;
  sessionId: string;
  arg?: any;
  timestamp: number;
}

export class CommandQueue {
  private streamName: string;
  private redis: RedisService | null = null;

  constructor(streamName = 'game:commands') {
    this.streamName = streamName;
  }

  async init(): Promise<void> {
    this.redis = await RedisService.connect();
    logger.info('CommandQueue 초기화', { streamName: this.streamName });
  }

  async publish(command: Omit<CommandMessage, 'timestamp'>): Promise<string> {
    if (!this.redis) {
      throw new Error('CommandQueue가 초기화되지 않았습니다. init()을 먼저 호출하세요.');
    }

    const client = this.redis.getClient();
    const message = {
      ...command,
      arg: command.arg ? JSON.stringify(command.arg) : '{}',
      timestamp: Date.now().toString()
    };

    try {
      const messageId = await client.xadd(
        this.streamName,
        '*',
        'commandId', message.commandId,
        'category', message.category,
        'type', message.type,
        'generalId', message.generalId,
        'sessionId', message.sessionId,
        'arg', message.arg,
        'timestamp', message.timestamp
      );

      logger.debug('커맨드 발행 완료', {
        streamName: this.streamName,
        messageId,
        commandId: command.commandId
      });

      return messageId || '';
    } catch (error) {
      logger.error('커맨드 발행 실패', {
        streamName: this.streamName,
        error: error instanceof Error ? error.message : String(error),
        command
      });
      throw error;
    }
  }

  async consume(
    groupName: string,
    consumerName: string,
    callback: (message: CommandMessage) => Promise<void>
  ): Promise<void> {
    if (!this.redis) {
      throw new Error('CommandQueue가 초기화되지 않았습니다. init()을 먼저 호출하세요.');
    }

    const client = this.redis.getClient();

    try {
      await client.xgroup('CREATE', this.streamName, groupName, '0', 'MKSTREAM');
      logger.info('Consumer Group 생성 완료', { groupName, streamName: this.streamName });
    } catch (error: any) {
      if (!error.message?.includes('BUSYGROUP')) {
        throw error;
      }
    }

    const result = await client.xreadgroup(
      'GROUP',
      groupName,
      consumerName,
      'COUNT',
      10,
      'BLOCK',
      1000,
      'STREAMS',
      this.streamName,
      '>'
    );

    if (!result || result.length === 0) {
      return;
    }

    for (const [streamName, messages] of result as any[]) {
      for (const [messageId, fields] of messages as any[]) {
        const data: any = {};
        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i];
          const value = fields[i + 1];
          data[key] = value;
        }

        const message: CommandMessage = {
          commandId: data.commandId,
          category: data.category,
          type: data.type,
          generalId: data.generalId,
          sessionId: data.sessionId,
          arg: data.arg ? JSON.parse(data.arg) : undefined,
          timestamp: parseInt(data.timestamp, 10)
        };

        try {
          await callback(message);

          await client.xack(this.streamName, groupName, messageId);

          logger.debug('메시지 처리 완료', {
            messageId,
            commandId: message.commandId
          });
        } catch (error) {
          logger.error('메시지 처리 실패', {
            messageId,
            commandId: message.commandId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });

          await this.handleFailedMessage(messageId, groupName, error);
        }
      }
    }
  }

  private async handleFailedMessage(
    messageId: string,
    groupName: string,
    error: any
  ): Promise<void> {
    const maxRetries = 3;

    try {
      const client = this.redis!.getClient();
      const pending = await client.xpending(
        this.streamName,
        groupName,
        '-',
        '+',
        10,
        messageId
      );

      if (pending && pending.length > 0) {
        const [id, consumer, idle, deliveryCount] = pending[0] as any[];

        if (deliveryCount >= maxRetries) {
          logger.error('메시지 최대 재시도 횟수 초과', {
            messageId,
            deliveryCount,
            maxRetries
          });

          await client.xack(this.streamName, groupName, messageId);
          return;
        }
      }

      logger.warn('메시지 재시도 예약', {
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
    } catch (err) {
      logger.error('실패 메시지 처리 중 에러', {
        messageId,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  async getPending(groupName: string): Promise<any[]> {
    if (!this.redis) {
      throw new Error('CommandQueue가 초기화되지 않았습니다. init()을 먼저 호출하세요.');
    }

    const client = this.redis.getClient();

    try {
      const result = await client.xpending(
        this.streamName,
        groupName,
        '-',
        '+',
        100
      );

      if (!result || result.length === 0) {
        return [];
      }

      const pending = result.map((item: any) => ({
        messageId: item[0],
        consumer: item[1],
        idle: item[2],
        deliveryCount: item[3]
      }));

      logger.debug('Pending 메시지 조회', {
        count: pending.length,
        groupName
      });

      return pending;
    } catch (error) {
      logger.error('Pending 메시지 조회 실패', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async claimPendingMessages(
    groupName: string,
    consumerName: string,
    minIdleTime = 60000
  ): Promise<number> {
    if (!this.redis) {
      throw new Error('CommandQueue가 초기화되지 않았습니다.');
    }

    const client = this.redis.getClient();

    try {
      const pending = await this.getPending(groupName);
      let claimedCount = 0;

      for (const msg of pending) {
        if (msg.idle > minIdleTime) {
          await client.xclaim(
            this.streamName,
            groupName,
            consumerName,
            minIdleTime,
            msg.messageId
          );
          claimedCount++;
        }
      }

      if (claimedCount > 0) {
        logger.info('Pending 메시지 재할당 완료', {
          claimedCount,
          consumerName
        });
      }

      return claimedCount;
    } catch (error) {
      logger.error('Pending 메시지 재할당 실패', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
