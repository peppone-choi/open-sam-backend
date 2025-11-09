/**
 * BattleEventHook Service
 * 
 * 전투 후 이벤트 훅 처리
 * - 도시 점령 시 OCCUPY_CITY 이벤트
 * - 국가 멸망 시 DESTROY_NATION 이벤트
 * - 천하통일 시 UNITED 이벤트
 * 
 * PHP 참조: hwe/process_war.php (라인 586, 700), func_gamerule.php (라인 755)
 */

import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { logger } from '../../common/logger';
import { ExecuteEngineService } from '../global/ExecuteEngine.service';

/**
 * 도시 점령 처리 및 이벤트 트리거
 * 
 * @param sessionId 세션 ID
 * @param cityId 점령된 도시 ID
 * @param attackerNationId 공격자 국가 ID
 * @param attackerGeneralId 공격자 장수 ID
 */
export async function onCityOccupied(
  sessionId: string,
  cityId: number,
  attackerNationId: number,
  attackerGeneralId: number
): Promise<void> {
  try {
    const city = await cityRepository.findOneByFilter({
      session_id: sessionId,
      'data.id': cityId
    });

    if (!city) {
      logger.error('[BattleEventHook] City not found', { sessionId, cityId });
      return;
    }

    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      logger.error('[BattleEventHook] Session not found', { sessionId });
      return;
    }

    const sessionData = session.data || {};
    const gameEnv = {
      year: sessionData.year || 180,
      month: sessionData.month || 1,
      session_id: sessionId
    };

    // 도시 소유권 변경
    const oldNationId = city.nation || 0;
    await cityRepository.updateOneByFilter(
      { session_id: sessionId, id: cityId },
      { $set: { nation: attackerNationId } }
    );

    logger.info('[BattleEventHook] City occupied', {
      sessionId,
      cityId,
      cityName: city.name,
      oldNationId,
      newNationId: attackerNationId,
      attackerGeneralId
    });

    // OCCUPY_CITY 이벤트 트리거
    await ExecuteEngineService.runEventHandler(sessionId, 'OCCUPY_CITY', {
      ...gameEnv,
      cityId,
      cityName: city.name,
      oldNationId,
      newNationId: attackerNationId,
      attackerNationId,
      attackerGeneralId
    });

    // 국가 멸망 체크 (해당 국가의 도시가 0개가 되면)
    if (oldNationId && oldNationId !== 0) {
      const remainingCities = await cityRepository.count({
        session_id: sessionId,
        nation: oldNationId
      });

      if (remainingCities === 0) {
        await onNationDestroyed(sessionId, oldNationId, attackerNationId, attackerGeneralId);
      }
    }

    // 천하통일 체크 (모든 도시가 한 국가에 속하면)
    await checkUnified(sessionId, attackerNationId);
  } catch (error: any) {
    logger.error('[BattleEventHook] Error processing city occupation', {
      sessionId,
      cityId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 국가 멸망 처리 및 이벤트 트리거
 * 
 * @param sessionId 세션 ID
 * @param destroyedNationId 멸망한 국가 ID
 * @param attackerNationId 공격자 국가 ID
 * @param attackerGeneralId 공격자 장수 ID
 */
export async function onNationDestroyed(
  sessionId: string,
  destroyedNationId: number,
  attackerNationId: number,
  attackerGeneralId: number
): Promise<void> {
  try {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      logger.error('[BattleEventHook] Session not found', { sessionId });
      return;
    }

    const sessionData = session.data || {};
    const gameEnv = {
      year: sessionData.year || 180,
      month: sessionData.month || 1,
      session_id: sessionId
    };

    const destroyedNation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': destroyedNationId
    });

    if (!destroyedNation) {
      logger.error('[BattleEventHook] Nation not found', { sessionId, destroyedNationId });
      return;
    }

    const nationName = destroyedNation.data?.name || destroyedNation.name || '무명';

    logger.info('[BattleEventHook] Nation destroyed', {
      sessionId,
      destroyedNationId,
      nationName,
      attackerNationId,
      attackerGeneralId
    });

    // 멸망한 국가의 장수들을 재야로 전환
    await generalRepository.updateManyByFilter(
      {
        session_id: sessionId,
        'data.nation': destroyedNationId
      },
      {
        $set: {
          'data.nation': 0,
          'data.officer_level': 1,
          'data.officer_city': 0
        }
      }
    );

    // 멸망한 국가의 관직자들을 일반으로 전환
    await generalRepository.updateManyByFilter(
      {
        session_id: sessionId,
        'data.nation': destroyedNationId,
        'data.officer_level': { $gte: 2 }
      },
      {
        $set: {
          'data.officer_level': 1,
          'data.officer_city': 0
        }
      }
    );

    // 국가 자원 일부 흡수 (기본량 제외 금쌀의 50%)
    const destroyedNationData = destroyedNation.data || {};
    const baseGold = 0; // GameConst.basegold
    const baseRice = 2000; // GameConst.baserice
    
    const loseNationGold = Math.max((destroyedNationData.gold || 0) - baseGold, 0);
    const loseNationRice = Math.max((destroyedNationData.rice || 0) - baseRice, 0);
    
    const absorbedGold = Math.floor(loseNationGold / 2);
    const absorbedRice = Math.floor(loseNationRice / 2);

    // 공격자 국가에 자원 추가
    const attackerNation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': attackerNationId
    });

    if (attackerNation) {
      const currentGold = attackerNation.data?.gold || attackerNation.gold || 0;
      const currentRice = attackerNation.data?.rice || attackerNation.rice || 0;
      const attackerNationNum = attackerNation.data?.nation || attackerNation.nation;
      
      await nationRepository.updateByNationNum(sessionId, attackerNationNum, {
        'data.gold': currentGold + absorbedGold,
        'data.rice': currentRice + absorbedRice
      });
    }

    // DESTROY_NATION 이벤트 트리거
    await ExecuteEngineService.runEventHandler(sessionId, 'DESTROY_NATION', {
      ...gameEnv,
      destroyedNationId,
      destroyedNationName: nationName,
      attackerNationId,
      attackerGeneralId,
      absorbedGold,
      absorbedRice
    });

    logger.info('[BattleEventHook] Nation destruction processed', {
      sessionId,
      destroyedNationId,
      nationName,
      absorbedGold,
      absorbedRice
    });
  } catch (error: any) {
    logger.error('[BattleEventHook] Error processing nation destruction', {
      sessionId,
      destroyedNationId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 천하통일 체크 및 이벤트 트리거
 * 
 * @param sessionId 세션 ID
 * @param nationId 확인할 국가 ID
 */
export async function checkUnified(sessionId: string, nationId: number): Promise<void> {
  try {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      return;
    }

    const sessionData = session.data || {};
    
    // 이미 통일되었으면 무시
    if (sessionData.isunited === 2 || sessionData.isunited === 3) {
      return;
    }

    // 모든 도시가 해당 국가에 속하는지 확인
    const totalCities = await cityRepository.count({
      session_id: sessionId
    });

    const unifiedCities = await cityRepository.count({
      session_id: sessionId,
      'data.nation': nationId
    });

    if (totalCities > 0 && unifiedCities === totalCities) {
      // 천하통일 달성!
      await onUnified(sessionId, nationId);
    }
  } catch (error: any) {
    logger.error('[BattleEventHook] Error checking unified', {
      sessionId,
      nationId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 천하통일 처리 및 이벤트 트리거
 * 
 * @param sessionId 세션 ID
 * @param unifiedNationId 통일한 국가 ID
 */
export async function onUnified(sessionId: string, unifiedNationId: number): Promise<void> {
  try {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      logger.error('[BattleEventHook] Session not found', { sessionId });
      return;
    }

    const sessionData = session.data || {};
    const gameEnv = {
      year: sessionData.year || 180,
      month: sessionData.month || 1,
      session_id: sessionId
    };

    const unifiedNation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': unifiedNationId
    });

    if (!unifiedNation) {
      logger.error('[BattleEventHook] Nation not found', { sessionId, unifiedNationId });
      return;
    }

    const nationName = unifiedNation.data?.name || unifiedNation.name || '무명';

    logger.info('[BattleEventHook] World unified!', {
      sessionId,
      unifiedNationId,
      nationName,
      year: gameEnv.year,
      month: gameEnv.month
    });

    // 세션 상태 업데이트
    sessionData.isunited = 2; // 통일 완료
    sessionData.refreshLimit = (sessionData.refreshLimit || 1000) * 100; // refreshLimit 증가
    session.data = sessionData;
    await session.save();

    // UNITED 이벤트 트리거
    await ExecuteEngineService.runEventHandler(sessionId, 'UNITED', {
      ...gameEnv,
      unifiedNationId,
      unifiedNationName: nationName
    });

    logger.info('[BattleEventHook] Unified event processed', {
      sessionId,
      unifiedNationId,
      nationName
    });
  } catch (error: any) {
    logger.error('[BattleEventHook] Error processing unified', {
      sessionId,
      unifiedNationId,
      error: error.message,
      stack: error.stack
    });
  }
}

