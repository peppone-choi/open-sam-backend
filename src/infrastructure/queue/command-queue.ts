import { RedisService } from '../cache/redis.service';
import { CommandType } from '../../@types';

/**
 * 커맨드 큐 (Redis Streams)
 * API 서버에서 명령을 발행하면 Game Daemon이 소비
 */
export class CommandQueue {
  private redis: RedisService;
  private streamName = 'cmd:game';

  constructor(redisService?: RedisService) {
    this.redis = redisService || new RedisService();
  }

  /**
   * 커맨드 발행 (API 서버에서 호출)
   */
  async publish(command: {
    generalId: string;
    type: CommandType;
    payload: Record<string, any>;
  }): Promise<string> {
    // TODO: 구현
    const messageId = await this.redis.xadd(this.streamName, {
      generalId: command.generalId,
      type: command.type,
      payload: JSON.stringify(command.payload),
      timestamp: Date.now(),
    });

    return messageId;
  }

  /**
   * 커맨드 소비 (Game Daemon에서 호출)
   * 
   * TODO: Consumer Group 구현
   * - XREADGROUP 사용
   * - ACK 처리
   * - 재시도 로직
   */
  async consume(
    groupName: string,
    consumerName: string,
    callback: (command: any) => Promise<void>
  ): Promise<void> {
    // TODO: 구현
    // 1. Consumer Group 생성 (없으면)
    // 2. XREADGROUP으로 메시지 읽기
    // 3. callback 실행
    // 4. XACK로 ACK
    // 5. 실패 시 재시도 또는 DLQ
    
    throw new Error('Not implemented yet');
  }

  /**
   * Pending 메시지 확인
   */
  async getPending(groupName: string): Promise<any[]> {
    // TODO: XPENDING 구현
    throw new Error('Not implemented yet');
  }
}
