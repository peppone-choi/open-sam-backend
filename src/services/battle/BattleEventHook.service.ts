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
      'data.city': cityId
    });

    if (!city) {
      logger.error('[BattleEventHook] 도시를 찾을 수 없습니다.', { sessionId, cityId });
      return;
    }

    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      logger.error('[BattleEventHook] 세션을 찾을 수 없습니다.', { sessionId });
      return;
    }

    const sessionData = session.data || {};
    const gameEnv = {
      year: sessionData.year || 184,
      month: sessionData.month || 1,
      session_id: sessionId
    };

    // 도시 소유권 변경
    const oldNationId = city.data?.nation || city.nation || 0;
    const cityName = city.data?.name || city.name || '도시';
    
    // 1. 도시 내 장수들 처리 (일반 장수 & NPC 이동)
    await moveGeneralsOnOccupation(sessionId, cityId, oldNationId, attackerNationId);
    
    // 2. 도시 자원 일부 흡수 (금/군량의 50%)
    const cityGold = city.data?.gold || 0;
    const cityRice = city.data?.rice || 0;
    const absorbedGold = Math.floor(cityGold * 0.5);
    const absorbedRice = Math.floor(cityRice * 0.5);
    
    // 공격자 국가에 자원 추가
    if (absorbedGold > 0 || absorbedRice > 0) {
      await transferCityResources(sessionId, attackerNationId, absorbedGold, absorbedRice);
    }
    
    // 3. 도시 소유권 변경 및 conflict 초기화
    await cityRepository.updateByCityNum(sessionId, cityId, {
      nation: attackerNationId,
      gold: cityGold - absorbedGold,
      rice: cityRice - absorbedRice,
      conflict: '{}' // conflict 초기화
    });

    logger.info('[BattleEventHook] City occupied', {
      sessionId,
      cityId,
      cityName,
      oldNationId,
      newNationId: attackerNationId,
      attackerGeneralId,
      absorbedGold,
      absorbedRice
    });
    
    // 4. 외교 로그 생성
    await createDiplomaticLog(sessionId, gameEnv.year, gameEnv.month, {
      type: 'CITY_OCCUPIED',
      attackerNationId,
      defenderNationId: oldNationId,
      cityId,
      cityName,
      attackerGeneralId
    });

    // OCCUPY_CITY 이벤트 트리거
    await ExecuteEngineService.runEventHandler(sessionId, 'OCCUPY_CITY', {
      ...gameEnv,
      cityId,
      cityName,
      oldNationId,
      newNationId: attackerNationId,
      attackerNationId,
      attackerGeneralId,
      absorbedGold,
      absorbedRice
    });

    // 국가 멸망 체크 (해당 국가의 도시가 0개가 되면)
    if (oldNationId && oldNationId !== 0) {
      const remainingCities = await cityRepository.count({
        session_id: sessionId,
        'data.nation': oldNationId
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
      logger.error('[BattleEventHook] 세션을 찾을 수 없습니다.', { sessionId });
      return;
    }

    const sessionData = session.data || {};
    const gameEnv = {
      year: sessionData.year || 184,
      month: sessionData.month || 1,
      session_id: sessionId
    };

    const destroyedNation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': destroyedNationId
    });

    if (!destroyedNation) {
      logger.error('[BattleEventHook] 국가를 찾을 수 없습니다.', { sessionId, destroyedNationId });
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
      logger.error('[BattleEventHook] 세션을 찾을 수 없습니다.', { sessionId });
      return;
    }

    const sessionData = session.data || {};
    const gameEnv = {
      year: sessionData.year || 184,
      month: sessionData.month || 1,
      session_id: sessionId
    };

    const unifiedNation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': unifiedNationId
    });

    if (!unifiedNation) {
      logger.error('[BattleEventHook] 국가를 찾을 수 없습니다.', { sessionId, unifiedNationId });
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

/**
 * 도시 점령 시 장수 이동 처리
 * - 일반 장수: 인접 아군 도시로 이동
 * - NPC 장수: 포로로 전환 또는 사망
 */
async function moveGeneralsOnOccupation(
  sessionId: string,
  cityId: number,
  oldNationId: number,
  newNationId: number
): Promise<void> {
  try {
    // 도시 내 모든 장수 조회
    const generalsInCity = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': oldNationId,
      'data.city': cityId
    });

    if (!generalsInCity || generalsInCity.length === 0) {
      return;
    }

    // 인접 아군 도시 찾기
    const adjacentCities = await cityRepository.findByFilter({
      session_id: sessionId,
      'data.nation': oldNationId
    });

    let targetCityId = 0;
    if (adjacentCities.length > 0) {
      // 첫 번째 남은 아군 도시로 이동
      targetCityId = adjacentCities[0].data?.city || adjacentCities[0].city || 0;
    }

    for (const general of generalsInCity) {
      const generalData = general.data || {};
      const generalNo = generalData.no || general.no;
      const isNPC = generalData.npc === 1 || generalData.npc === true;

      if (isNPC) {
        // NPC 장수: 50% 확률로 포로, 50% 확률로 재야 전환
        if (Math.random() < 0.5) {
          // 포로로 전환
          await generalRepository.updateOneByFilter(
            { session_id: sessionId, 'data.no': generalNo },
            {
              $set: {
                'data.nation': 0,
                'data.city': 0,
                'data.officer_level': 1,
                'data.penalty': 'PRISONER',
                'data.prisoner_until': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일 후
              }
            }
          );
        } else {
          // 재야로 전환
          await generalRepository.updateOneByFilter(
            { session_id: sessionId, 'data.no': generalNo },
            {
              $set: {
                'data.nation': 0,
                'data.city': 0,
                'data.officer_level': 1
              }
            }
          );
        }
      } else {
        // 일반 장수: 아군 도시로 이동 (없으면 재야)
        if (targetCityId > 0) {
          await generalRepository.updateOneByFilter(
            { session_id: sessionId, 'data.no': generalNo },
            {
              $set: {
                'data.city': targetCityId,
                'data.officer_level': 1 // 관직 박탈
              }
            }
          );
        } else {
          // 아군 도시 없음 -> 재야
          await generalRepository.updateOneByFilter(
            { session_id: sessionId, 'data.no': generalNo },
            {
              $set: {
                'data.nation': 0,
                'data.city': 0,
                'data.officer_level': 1
              }
            }
          );
        }
      }
    }

    logger.info('[BattleEventHook] Generals moved on occupation', {
      sessionId,
      cityId,
      generalCount: generalsInCity.length,
      targetCityId
    });
  } catch (error: any) {
    logger.error('[BattleEventHook] Error moving generals on occupation', {
      sessionId,
      cityId,
      error: error.message
    });
  }
}

/**
 * 도시 자원을 공격자 국가로 이전
 */
async function transferCityResources(
  sessionId: string,
  nationId: number,
  gold: number,
  rice: number
): Promise<void> {
  try {
    const nation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': nationId
    });

    if (!nation) {
      logger.error('[BattleEventHook] 국가를 찾을 수 없습니다.', { sessionId, nationId });
      return;
    }

    const currentGold = nation.data?.gold || nation.gold || 0;
    const currentRice = nation.data?.rice || nation.rice || 0;

    await nationRepository.updateByNationNum(sessionId, nationId, {
      'data.gold': currentGold + gold,
      'data.rice': currentRice + rice
    });

    logger.info('[BattleEventHook] City resources transferred', {
      sessionId,
      nationId,
      gold,
      rice
    });
  } catch (error: any) {
    logger.error('[BattleEventHook] Error transferring city resources', {
      sessionId,
      nationId,
      error: error.message
    });
  }
}

/**
 * 외교 로그 생성
 */
async function createDiplomaticLog(
  sessionId: string,
  year: number,
  month: number,
  event: {
    type: string;
    attackerNationId: number;
    defenderNationId: number;
    cityId?: number;
    cityName?: string;
    attackerGeneralId?: number;
  }
): Promise<void> {
  try {
    const { ActionLogger } = await import('../logger/ActionLogger');
    const { LogFormatType } = await import('../../types/log.types');

    // 공격자 국가 로그
    const attackerLogger = new ActionLogger(
      0, // generalId (국가 로그이므로 0)
      event.attackerNationId,
      year,
      month,
      sessionId,
      false
    );

    // 수비자 국가 로그
    const defenderLogger = new ActionLogger(
      0,
      event.defenderNationId,
      year,
      month,
      sessionId,
      false
    );

    if (event.type === 'CITY_OCCUPIED') {
      const attackMsg = `<G>${event.cityName}</G> 도시를 점령하였습니다!`;
      const defenseMsg = `<R>${event.cityName}</R> 도시를 빼앗겼습니다.`;

      attackerLogger.pushGlobalActionLog(attackMsg, LogFormatType.PLAIN);
      defenderLogger.pushGlobalActionLog(defenseMsg, LogFormatType.PLAIN);
    }

    await attackerLogger.flush();
    await defenderLogger.flush();

    logger.info('[BattleEventHook] Diplomatic log created', {
      sessionId,
      type: event.type,
      attackerNationId: event.attackerNationId,
      defenderNationId: event.defenderNationId
    });
  } catch (error: any) {
    logger.error('[BattleEventHook] Error creating diplomatic log', {
      sessionId,
      error: error.message
    });
  }
}

