/**
 * event_부대발령즉시집합 (TroopOrderImmediateGather)
 * 
 * PHP 대응: core/hwe/sammo/StaticEvent/event_부대발령즉시집합.php
 * 
 * 발령(che_발령) 커맨드 실행 시 부대장이 대상인 경우 호출됩니다.
 * 부대장 외 다른 도시에 있는 부대원들도 모두 발령 대상 도시로 즉시 이동합니다.
 */

import { EventHandler, EventContext } from '../StaticEventHandler';
import { generalRepository } from '../../repositories/general.repository';
import { troopRepository } from '../../repositories/troop.repository';
import { logger } from '../../common/logger';
import { LogFormatType } from '../../types/log.types';

export class TroopOrderImmediateGatherHandler implements EventHandler {
  async execute(context: EventContext): Promise<void> {
    const { generalObj, destGeneralObj, arg, env } = context;

    // destGeneralObj가 발령 대상 장수
    if (!destGeneralObj) {
      logger.debug('[TroopOrderImmediateGather] destGeneralObj가 없습니다');
      return;
    }

    const destCityID = arg?.destCityID;
    if (!destCityID || typeof destCityID !== 'number') {
      logger.warn('[TroopOrderImmediateGather] destCityID가 없거나 유효하지 않습니다', { destCityID });
      return;
    }

    const sessionId = env?.session_id || generalObj?.session_id || destGeneralObj?.session_id || 'sangokushi_default';

    // 발령 대상 장수의 데이터
    const destData = destGeneralObj.data || destGeneralObj;
    const destGeneralNo = destData.no || destGeneralObj.no;
    const destTroopId = destData.troop;

    // 부대장 발령이 아니면 무시 (부대원이 부대장 ID와 일치해야 부대장)
    if (destGeneralNo !== destTroopId) {
      logger.debug('[TroopOrderImmediateGather] 부대장 발령이 아닙니다', {
        destGeneralNo,
        destTroopId
      });
      return;
    }

    // 같은 국가 확인
    const generalNationId = generalObj?.getNationID?.() || generalObj?.data?.nation || generalObj?.nation;
    const destNationId = destData.nation || destGeneralObj.getNationID?.();

    if (generalNationId !== destNationId) {
      logger.warn('[TroopOrderImmediateGather] 국가가 다릅니다', {
        generalNation: generalNationId,
        destNation: destNationId
      });
      return;
    }

    // 부대 이름 조회
    const troop = await troopRepository.findOneByFilter({ 
      session_id: sessionId, 
      'data.troop_leader': destGeneralNo 
    });
    const troopName = troop?.data?.name || troop?.name || '부대';

    // 도시 이름 가져오기
    const { CityConst } = await import('../../CityConst');
    const cityInfo = CityConst.byID(destCityID);
    const cityName = cityInfo?.name || `도시 ${destCityID}`;

    // 부대원 목록 조회 (부대장 제외, 다른 도시에 있는 장수들)
    const troopMembers = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': destNationId,
      'data.troop': destGeneralNo,
      'data.no': { $ne: destGeneralNo },
      'data.city': { $ne: destCityID }
    });

    if (!troopMembers || troopMembers.length === 0) {
      logger.debug('[TroopOrderImmediateGather] 이동할 부대원이 없습니다', {
        troopId: destGeneralNo,
        destCityID
      });
      return;
    }

    // 부대원 도시 일괄 변경
    const memberIds = troopMembers.map((m: any) => m.data?.no || m.no);
    
    await generalRepository.updateManyByFilter(
      { 
        session_id: sessionId, 
        'data.no': { $in: memberIds } 
      },
      { 'data.city': destCityID }
    );

    // 현재 장수도 같은 부대원이면 이동
    const generalTroopId = generalObj?.data?.troop || generalObj?.troop;
    if (generalTroopId === destGeneralNo) {
      if (typeof generalObj.setVar === 'function') {
        generalObj.setVar('city', destCityID);
      } else if (generalObj.data) {
        generalObj.data.city = destCityID;
      }
    }

    // 각 부대원에게 로그 추가
    const { JosaUtil } = await import('../../utils/JosaUtil');
    const josaRo = JosaUtil.pick(cityName, '로');
    const logMessage = `${troopName} 부대원들은 <G><b>${cityName}</b></>${josaRo} 즉시 집합되었습니다.`;

    // ActionLogger를 통해 각 장수에게 로그 추가
    try {
      const { ActionLogger } = await import('../../services/logger/ActionLogger');
      const year = env?.year || 184;
      const month = env?.month || 1;

      for (const memberId of memberIds) {
        const memberLogger = new ActionLogger(
          memberId,
          destNationId,
          year,
          month,
          sessionId,
          true // silent mode
        );
        memberLogger.pushGeneralActionLog(logMessage, LogFormatType.PLAIN);
        await memberLogger.flush();
      }
    } catch (error) {
      logger.warn('[TroopOrderImmediateGather] 로그 추가 실패', { error });
    }

    logger.info('[TroopOrderImmediateGather] 부대 발령 즉시 집합 완료', {
      troopId: destGeneralNo,
      troopName,
      destCityID,
      cityName,
      movedMembers: memberIds.length
    });
  }
}

// 싱글톤 인스턴스
export const troopOrderImmediateGatherHandler = new TroopOrderImmediateGatherHandler();






