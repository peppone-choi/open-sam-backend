/**
 * TrafficManager Service
 * 
 * 트래픽 관리 및 서버 부하 체크
 * PHP func.php의 updateTraffic, CheckOverhead 이식
 */

import { KVStorage } from '../../utils/KVStorage';
import { GeneralAccessLog } from '../../models/general_access_log.model';
import { Session } from '../../models/session.model';
import { logger } from '../../common/logger';
import { Util } from '../../utils/Util';
import { GameConst } from '../../const/GameConst';

// refreshLimit 계수 (PHP GameConst::$refreshLimitCoef)
const REFRESH_LIMIT_COEF = 1.0;

/**
 * 온라인 사용자 수 조회
 */
async function getOnlineNum(sessionId: string): Promise<number> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const onlineUserCnt = await gameStor.getValue('online_user_cnt');
    return onlineUserCnt || 0;
  } catch (error: any) {
    logger.error('[TrafficManager] Error getting online user count', {
      error: error.message
    });
    return 0;
  }
}

/**
 * 트래픽 업데이트
 * 
 * 매월 refresh 카운트를 집계하고 최대값을 업데이트
 */
export async function updateTraffic(sessionId: string): Promise<void> {
  try {
    const online = await getOnlineNum(sessionId);
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    
    // 현재 게임 환경 변수 조회
    const year = await gameStor.getValue('year') || 180;
    const month = await gameStor.getValue('month') || 1;
    const refresh = await gameStor.getValue('refresh') || 0;
    const maxonline = await gameStor.getValue('maxonline') || 0;
    const maxrefresh = await gameStor.getValue('maxrefresh') || 0;
    const recentTraffic = await gameStor.getValue('recentTraffic') || [];

    // 최대값 업데이트
    let newMaxRefresh = maxrefresh;
    let newMaxOnline = maxonline;
    
    if (maxrefresh < refresh) {
      newMaxRefresh = refresh;
    }
    if (maxonline < online) {
      newMaxOnline = online;
    }

    // KVStorage 업데이트
    await gameStor.setValue('refresh', 0);
    await gameStor.setValue('maxrefresh', newMaxRefresh);
    await gameStor.setValue('maxonline', newMaxOnline);

    // 최근 트래픽 기록 (최대 5개)
    const updatedRecentTraffic = [...recentTraffic];
    if (updatedRecentTraffic.length >= 5) {
      updatedRecentTraffic.shift();
    }
    
    updatedRecentTraffic.push({
      year,
      month,
      refresh,
      online,
      date: new Date().toISOString()
    });

    await gameStor.setValue('recentTraffic', updatedRecentTraffic);

    // GeneralAccessLog의 refresh 카운트 리셋
    await (GeneralAccessLog as any).updateMany(
      { session_id: sessionId },
      { $set: { 'data.refresh': 0 } }
    );

    // 디버그 모드에서만 자세한 로그 출력 (너무 자주 출력되므로 기본적으로는 비활성화)
    if (process.env.DEBUG_TRAFFIC === 'true') {
      logger.info('[TrafficManager] Traffic updated', {
        sessionId,
        year,
        month,
        refresh,
        online,
        maxRefresh: newMaxRefresh,
        maxOnline: newMaxOnline
      });
    }
  } catch (error: any) {
    logger.error('[TrafficManager] Error updating traffic', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 서버 부하 체크 및 refreshLimit 동적 조정
 * 
 * turnterm에 따라 refreshLimit을 자동으로 조정
 */
export async function CheckOverhead(sessionId: string): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const turnterm = await gameStor.getValue('turnterm') || 60;
    const refreshLimit = await gameStor.getValue('refreshLimit') || 1000;

    // refreshLimit 계산: (turnterm^0.6) * 3 * refreshLimitCoef
    const nextRefreshLimit = Util.round(
      Math.pow(turnterm, 0.6) * 3 * REFRESH_LIMIT_COEF
    );

    if (nextRefreshLimit !== refreshLimit) {
      await gameStor.setValue('refreshLimit', nextRefreshLimit);
      
      logger.info('[TrafficManager] RefreshLimit updated', {
        sessionId,
        turnterm,
        oldLimit: refreshLimit,
        newLimit: nextRefreshLimit
      });
    }
  } catch (error: any) {
    logger.error('[TrafficManager] Error checking overhead', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
  }
}

