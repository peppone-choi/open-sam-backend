import { logger } from '../../shared/utils/logger';

/**
 * Turn Handler - 턴 진행 처리
 * 
 * 역할:
 * - 24시간(게임시간)마다 턴 종료
 * - 세금 징수
 * - CP(커맨드 포인트) 회복
 * - 자원 자동 생산
 */
export class TurnHandler {
  private lastTurnTime: Date;

  constructor() {
    this.lastTurnTime = new Date();
  }

  async processTurn(currentTime: Date) {
    // TODO: 마지막 턴 이후 24시간(게임시간) 경과했는지 확인
    // TODO: 턴 경과 시:
    //   1. 모든 장수 CP 회복 (PCP, MCP)
    //   2. 도시별 세금 징수
    //   3. 도시별 자동 식량 생산
    //   4. 급여 지급
    
    logger.info('Turn processed');
  }

  async checkCommandCompletion(currentTime: Date) {
    // TODO: completionTime이 currentTime 이전인 커맨드 찾기
    // TODO: 해당 커맨드들 완료 처리
    // TODO: 결과 적용 (이동 완료, 생산 완료 등)
    
    logger.debug('Command completion checked');
  }
}
