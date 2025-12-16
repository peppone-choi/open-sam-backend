/**
 * event_부대탑승즉시이동 (TroopJoinImmediateMove)
 * 
 * PHP 대응: core/hwe/sammo/StaticEvent/event_부대탑승즉시이동.php
 * 
 * 부대 가입(JoinTroop) 시 호출됩니다.
 * 장수가 부대장과 다른 도시에 있으면 부대장 도시로 즉시 이동합니다.
 */

import { EventHandler, EventContext } from '../StaticEventHandler';
import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';

export class TroopJoinImmediateMoveHandler implements EventHandler {
  async execute(context: EventContext): Promise<void> {
    const { generalObj, arg, env } = context;
    
    const troopID = arg?.troopID;
    if (!troopID || typeof troopID !== 'number') {
      logger.warn('[TroopJoinImmediateMove] troopID가 없거나 유효하지 않습니다', { troopID });
      return;
    }

    const sessionId = env?.session_id || generalObj?.session_id || 'sangokushi_default';

    // 부대장 정보 조회
    const troopLeader = await generalRepository.findBySessionAndNo(sessionId, troopID);
    if (!troopLeader) {
      logger.warn('[TroopJoinImmediateMove] 부대장을 찾을 수 없습니다', { troopID, sessionId });
      return;
    }

    const leaderData = troopLeader.data || troopLeader;

    // 부대장 여부 확인
    if (leaderData.troop !== troopID && leaderData.no !== troopID) {
      logger.warn('[TroopJoinImmediateMove] 대상이 부대장이 아닙니다', { 
        troopID, 
        leaderTroop: leaderData.troop 
      });
      return;
    }

    // 같은 국가 확인
    const generalNationId = generalObj.getNationID?.() || generalObj.data?.nation || generalObj.nation;
    const leaderNationId = leaderData.nation;
    
    if (generalNationId !== leaderNationId) {
      logger.warn('[TroopJoinImmediateMove] 국가가 다릅니다', {
        generalNation: generalNationId,
        leaderNation: leaderNationId
      });
      return;
    }

    // 같은 도시면 이동 필요 없음
    const generalCityId = generalObj.getCityID?.() || generalObj.data?.city || generalObj.city;
    const leaderCityId = leaderData.city;
    
    if (generalCityId === leaderCityId) {
      logger.debug('[TroopJoinImmediateMove] 이미 같은 도시에 있습니다', {
        generalCityId,
        leaderCityId
      });
      return;
    }

    // 도시 이름 가져오기
    const { CityConst } = await import('../../CityConst');
    const cityInfo = CityConst.byID(leaderCityId);
    const cityName = cityInfo?.name || `도시 ${leaderCityId}`;

    // 장수 도시 변경
    if (typeof generalObj.setVar === 'function') {
      generalObj.setVar('city', leaderCityId);
    } else if (generalObj.data) {
      generalObj.data.city = leaderCityId;
    }

    // 로그 추가
    const { JosaUtil } = await import('../../utils/JosaUtil');
    const josaRo = JosaUtil.pick(cityName, '로');
    const logMessage = `부대 주둔지인 <G><b>${cityName}</b></>${josaRo} 즉시 이동합니다.`;

    if (typeof generalObj.getLogger === 'function') {
      const generalLogger = generalObj.getLogger();
      generalLogger.pushGeneralActionLog(logMessage, 'PLAIN');
    } else {
      logger.info('[TroopJoinImmediateMove]', { logMessage, generalId: generalObj.no || generalObj.data?.no });
    }

    // 장수 DB 저장
    if (typeof generalObj.applyDB === 'function') {
      await generalObj.applyDB();
    } else {
      // 직접 저장
      const generalNo = generalObj.no || generalObj.data?.no;
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, 'data.no': generalNo },
        { $set: { 'data.city': leaderCityId } }
      );
    }

    logger.info('[TroopJoinImmediateMove] 부대 가입 즉시 이동 완료', {
      generalId: generalObj.no || generalObj.data?.no,
      fromCity: generalCityId,
      toCity: leaderCityId,
      cityName
    });
  }
}

// 싱글톤 인스턴스
export const troopJoinImmediateMoveHandler = new TroopJoinImmediateMoveHandler();








