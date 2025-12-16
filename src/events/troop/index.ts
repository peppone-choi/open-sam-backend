/**
 * 부서(Troop) 관련 StaticEvent 핸들러 등록
 * 
 * PHP 대응:
 * - event_부대탑승즉시이동.php → TroopJoinImmediateMove
 * - event_부대발령즉시집합.php → TroopOrderImmediateGather
 */

import { StaticEventHandler } from '../StaticEventHandler';
import { troopJoinImmediateMoveHandler } from './TroopJoinImmediateMove';
import { troopOrderImmediateGatherHandler } from './TroopOrderImmediateGather';

/**
 * 부서 관련 이벤트 핸들러 등록
 * 
 * 서버 시작 시 호출해야 합니다.
 */
export function registerTroopEventHandlers(): void {
  // 부대 가입 시 즉시 이동 이벤트
  // JoinTroop API 호출 후 발생
  StaticEventHandler.registerEvent('JoinTroop', troopJoinImmediateMoveHandler);

  // 발령 시 부대원 즉시 집합 이벤트
  // che_발령 (appointOfficer) 커맨드 실행 후 발생
  StaticEventHandler.registerEvent('발령', troopOrderImmediateGatherHandler);
  StaticEventHandler.registerEvent('che_발령', troopOrderImmediateGatherHandler);
  StaticEventHandler.registerEvent('appointOfficer', troopOrderImmediateGatherHandler);

  console.log('[TroopEvents] 부서 관련 이벤트 핸들러 등록 완료');
}

export { troopJoinImmediateMoveHandler } from './TroopJoinImmediateMove';
export { troopOrderImmediateGatherHandler } from './TroopOrderImmediateGather';








