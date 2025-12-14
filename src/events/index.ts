/**
 * 이벤트 핸들러 통합 등록
 * 
 * 서버 시작 시 호출하여 모든 StaticEvent 핸들러를 등록합니다.
 */

export { StaticEventHandler } from './StaticEventHandler';
export * from './troop';

import { registerTroopEventHandlers } from './troop';

/**
 * 모든 이벤트 핸들러 등록
 * 
 * 서버 시작 시 한 번만 호출해야 합니다.
 */
export function registerAllEventHandlers(): void {
  // 부서 관련 이벤트 핸들러
  registerTroopEventHandlers();

  console.log('[Events] 모든 이벤트 핸들러 등록 완료');
}




