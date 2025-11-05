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
}


