import { logger } from '../../shared/utils/logger';

/**
 * Event Handler - 게임 이벤트 발행
 * 
 * 역할:
 * - 도메인 이벤트를 Redis Pub/Sub으로 발행
 * - 프론트엔드에 실시간 알림
 */
export class EventHandler {
  async publishEvent(eventType: string, data: any) {
    // TODO: Redis Pub/Sub으로 이벤트 발행
    // TODO: WebSocket 서버가 구독하여 클라이언트에 전송
    
    logger.debug(`Event published: ${eventType}`);
  }
}
