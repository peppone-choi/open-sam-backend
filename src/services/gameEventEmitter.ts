import { getSocketManager } from '../socket/socketManager';

/**
 * 게임 이벤트 에미터
 * 게임 상태 변경 시 Socket.IO를 통해 실시간 업데이트를 전송합니다.
 */
export class GameEventEmitter {
  /**
   * 턴 완료 브로드캐스트
   */
  static broadcastTurnComplete(sessionId: string, turnNumber: number, nextTurnAt: Date) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastTurnComplete(sessionId, turnNumber, nextTurnAt);
    }
  }

  /**
   * 장수 정보 업데이트 브로드캐스트
   */
  static broadcastGeneralUpdate(sessionId: string, generalId: number, updates: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastGeneralUpdate(sessionId, generalId, updates);
    }
  }

  /**
   * 국가 정보 업데이트 브로드캐스트
   */
  static broadcastNationUpdate(sessionId: string, nationId: number, updates: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastNationUpdate(sessionId, nationId, updates);
    }
  }

  /**
   * 도시 정보 업데이트 브로드캐스트
   */
  static broadcastCityUpdate(sessionId: string, cityId: number, updates: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastCityUpdate(sessionId, cityId, updates);
    }
  }

  /**
   * 메시지 알림 브로드캐스트
   */
  static broadcastMessage(sessionId: string, message: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastMessage(sessionId, message);
    }
  }

  /**
   * 전투 시작 알림
   */
  static broadcastBattleStart(sessionId: string, battleId: string, participants: number[]) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastBattleStart(sessionId, battleId, participants);
    }
  }

  /**
   * 특정 사용자에게 이벤트 전송
   */
  static sendToUser(userId: string, event: string, data: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.sendToUser(userId, event, data);
    }
  }

  /**
   * 게임 이벤트 브로드캐스트 (범용)
   */
  static broadcastGameEvent(sessionId: string, event: string, data: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastGameEvent(sessionId, event, data);
    }
  }

  /**
   * 로그 업데이트 브로드캐스트
   * @param sessionId 세션 ID
   * @param generalId 장수 ID (장수동향/개인기록용, 중원정세는 0)
   * @param logType 'action' | 'history'
   * @param logId 로그 ID
   * @param logText 로그 텍스트
   */
  static broadcastLogUpdate(sessionId: string, generalId: number, logType: 'action' | 'history', logId: number, logText: string) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastLogUpdate(sessionId, generalId, logType, logId, logText);
    }
  }

  /**
   * 경매 상태 변경 브로드캐스트
   */
  static broadcastAuctionUpdate(sessionId: string, auctionId: string, updates: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastGameEvent(sessionId, 'auction:updated', {
        auctionId,
        ...updates
      });
    }
  }

  /**
   * 토너먼트 상태 변경 브로드캐스트
   */
  static broadcastTournamentUpdate(sessionId: string, updates: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastGameEvent(sessionId, 'tournament:updated', updates);
    }
  }

  /**
   * 베팅 상태 변경 브로드캐스트
   */
  static broadcastBettingUpdate(sessionId: string, bettingId: number, updates: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastGameEvent(sessionId, 'betting:updated', {
        bettingId,
        ...updates
      });
    }
  }

  /**
   * 국가 재정 업데이트 브로드캐스트
   */
  static broadcastFinanceUpdate(sessionId: string, nationId: number, financeData: any) {
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.broadcastGameEvent(sessionId, 'finance:updated', {
        nationId,
        ...financeData
      });
    }
  }
}


