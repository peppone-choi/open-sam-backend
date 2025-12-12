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

import mongoose from 'mongoose';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { logger } from '../../common/logger';
import { ExecuteEngineService } from '../global/ExecuteEngine.service';
import { GameEventEmitter } from '../gameEventEmitter';
import { Hall } from '../../models/hall.model';
import { CheckHallService } from '../admin/CheckHall.service';

/**
 * 도시 점령 처리 및 이벤트 트리거
 * 
 * @param sessionId 세션 ID
 * @param cityId 점령된 도시 ID
 * @param attackerNationId 공격자 국가 ID
 * @param attackerGeneralId 공격자 장수 ID
 * @param providedOldNationId 이전 소유 국가 ID (선택적, 이미 소유권이 변경된 경우 전달)
 */
export async function onCityOccupied(
  sessionId: string,
  cityId: number,
  attackerNationId: number,
  attackerGeneralId: number,
  providedOldNationId?: number
): Promise<void> {
  try {
    // CQRS: 캐시 우선 조회
    const city = await cityRepository.findByCityNum(sessionId, cityId);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cityAny = city as any;
    const cityData = cityAny.data as Record<string, unknown> | undefined;
    const cityDoc = cityAny as Record<string, unknown>;
    // providedOldNationId가 전달되면 사용, 아니면 도시에서 조회
    const oldNationId = providedOldNationId ?? (cityData?.nation ?? cityDoc.nation ?? 0) as number;
    const cityName = (cityData?.name ?? cityDoc.name ?? '도시') as string;
    
    // 이미 같은 국가 소유인 경우 (providedOldNationId가 없고 도시가 이미 변경된 경우)
    // providedOldNationId가 전달되면 정상 처리
    if (providedOldNationId === undefined && oldNationId === attackerNationId) {
      logger.warn('[BattleEventHook] 도시가 이미 공격자 국가 소유입니다. 중복 점령 처리 무시.', {
        sessionId,
        cityId,
        cityName,
        nationId: attackerNationId
      });
      return;
    }
    
    // 1. 도시 내 장수들 처리 (일반 장수 & NPC 이동)
    await moveGeneralsOnOccupation(sessionId, cityId, oldNationId, attackerNationId);
    
    // 2. 도시 자원 일부 흡수 (금/군량의 50%)
    const cityGold = (cityData?.gold ?? 0) as number;
    const cityRice = (cityData?.rice ?? 0) as number;
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

    // Socket 브로드캐스트: 도시 점령
    GameEventEmitter.broadcastCityOccupied(
      sessionId,
      cityId,
      cityName,
      oldNationId,
      attackerNationId,
      attackerGeneralId
    );

    // 도시 정보 업데이트 브로드캐스트
    GameEventEmitter.broadcastCityUpdate(sessionId, cityId, {
      nation: attackerNationId,
      occupied: true,
      timestamp: new Date()
    });

    // 국가 멸망 체크 (해당 국가의 도시가 0개가 되면)
    if (oldNationId && oldNationId !== 0) {
      const remainingCities = await cityRepository.count({
        session_id: sessionId,
        'data.nation': oldNationId
      });

      if (remainingCities === 0) {
        await onNationDestroyed(sessionId, oldNationId, attackerNationId, attackerGeneralId);
      } else {
        // 멸망하지 않았지만 수도가 함락된 경우 긴급천도
        const oldNation = await nationRepository.findByNationNum(sessionId, oldNationId);
        if (oldNation) {
          const capital = oldNation.data?.capital || oldNation.capital;
          if (capital === cityId) {
            await processEmergencyCapitalMove(sessionId, oldNationId, cityId, gameEnv.year, gameEnv.month);
          }
        }
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

    // CQRS: 캐시 우선 조회
    const destroyedNation = await nationRepository.findByNationNum(sessionId, destroyedNationId);

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

    // 공격자 국가에 자원 추가 (CQRS: 캐시 우선 조회)
    const attackerNation = await nationRepository.findByNationNum(sessionId, attackerNationId);

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

    // 공격자 국가 이름 조회
    let attackerNationName = '무명';
    const attackerNation2 = await nationRepository.findByNationNum(sessionId, attackerNationId);
    if (attackerNation2) {
      attackerNationName = attackerNation2.data?.name || attackerNation2.name || '무명';
    }

    // Socket 브로드캐스트: 국가 멸망
    GameEventEmitter.broadcastNationDestroyed(
      sessionId,
      destroyedNationId,
      nationName,
      attackerNationId,
      attackerNationName
    );

    // 국가 정보 업데이트 브로드캐스트
    GameEventEmitter.broadcastNationUpdate(sessionId, destroyedNationId, {
      destroyed: true,
      destroyedBy: attackerNationId,
      timestamp: new Date()
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

    // CQRS: 캐시 우선 조회
    const unifiedNation = await nationRepository.findByNationNum(sessionId, unifiedNationId);

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

    // Socket 브로드캐스트: 천하통일
    GameEventEmitter.broadcastGameUnified(
      sessionId,
      unifiedNationId,
      nationName,
      gameEnv.year,
      gameEnv.month
    );

    // 국가 정보 업데이트 브로드캐스트
    GameEventEmitter.broadcastNationUpdate(sessionId, unifiedNationId, {
      unified: true,
      unifiedYear: gameEnv.year,
      unifiedMonth: gameEnv.month,
      timestamp: new Date()
    });

    // 명예의 전당 기록 (통일 시 모든 장수)
    await recordHallOfFame(sessionId, unifiedNationId, gameEnv.year, gameEnv.month);

    try {
      const { HistoryService } = await import('../HistoryService');
      await HistoryService.saveGameResult(sessionId, unifiedNationId);
    } catch (historyError: any) {
      logger.error('[BattleEventHook] HistoryService 저장 실패', {
        sessionId,
        unifiedNationId,
        error: historyError?.message
      });
    }

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
    // CQRS: 캐시 우선 조회
    const nation = await nationRepository.findByNationNum(sessionId, nationId);

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
 * 트랜잭션을 사용한 도시 점령 처리 (권장)
 * 
 * 도시 점령 → 국가 멸망 체크 → 통일 체크를 원자적으로 처리합니다.
 * 
 * @param sessionId 세션 ID
 * @param cityId 점령된 도시 ID
 * @param attackerNationId 공격자 국가 ID
 * @param attackerGeneralId 공격자 장수 ID
 */
export async function onCityOccupiedWithTransaction(
  sessionId: string,
  cityId: number,
  attackerNationId: number,
  attackerGeneralId: number
): Promise<{ success: boolean; error?: string }> {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // 도시 점령 처리 (내부에서 국가 멸망 및 통일 체크도 수행)
    await onCityOccupied(sessionId, cityId, attackerNationId, attackerGeneralId);
    
    await session.commitTransaction();
    
    logger.info('[BattleEventHook] Transaction committed successfully', {
      sessionId,
      cityId,
      attackerNationId,
      attackerGeneralId
    });
    
    return { success: true };
  } catch (error: any) {
    await session.abortTransaction();
    
    logger.error('[BattleEventHook] Transaction aborted', {
      sessionId,
      cityId,
      error: error.message,
      stack: error.stack
    });
    
    return { success: false, error: error.message };
  } finally {
    session.endSession();
  }
}

/**
 * 전투 종료 후 월드 반영 처리 (트랜잭션 사용)
 * 
 * @param sessionId 세션 ID
 * @param battleResult 전투 결과
 */
export async function onBattleEnded(params: {
  sessionId: string;
  battleId: string;
  winner: 'attacker' | 'defender' | 'draw';
  cityId?: number;
  attackerNationId: number;
  defenderNationId: number;
  attackerGeneralId: number;
  casualties: { attacker: number; defender: number };
}): Promise<void> {
  const {
    sessionId,
    battleId,
    winner,
    cityId,
    attackerNationId,
    defenderNationId,
    attackerGeneralId,
    casualties
  } = params;

  try {
    logger.info('[BattleEventHook] Processing battle end', {
      sessionId,
      battleId,
      winner,
      cityId,
      casualties
    });

    // 공격자 승리 + 도시 공격인 경우 도시 점령 처리
    if (winner === 'attacker' && cityId && cityId > 0) {
      const result = await onCityOccupiedWithTransaction(
        sessionId,
        cityId,
        attackerNationId,
        attackerGeneralId
      );

      if (!result.success) {
        logger.error('[BattleEventHook] City occupation failed', {
          sessionId,
          cityId,
          error: result.error
        });
      }
    }

    // 전투 통계 업데이트 (선택적)
    GameEventEmitter.broadcastGameEvent(sessionId, 'battle:world_updated', {
      battleId,
      winner,
      cityId,
      attackerNationId,
      defenderNationId,
      timestamp: new Date()
    });

    logger.info('[BattleEventHook] Battle end processing completed', {
      sessionId,
      battleId,
      winner
    });
  } catch (error: any) {
    logger.error('[BattleEventHook] Error processing battle end', {
      sessionId,
      battleId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 국가 멸망 체크 (외부 호출용)
 * 
 * @param sessionId 세션 ID
 * @param nationId 체크할 국가 ID
 * @returns 멸망 여부
 */
export async function checkNationDestroyed(sessionId: string, nationId: number): Promise<boolean> {
  try {
    if (!nationId || nationId === 0) {
      return false;
    }

    const remainingCities = await cityRepository.count({
      session_id: sessionId,
      'data.nation': nationId
    });

    return remainingCities === 0;
  } catch (error: any) {
    logger.error('[BattleEventHook] Error checking nation destroyed', {
      sessionId,
      nationId,
      error: error.message
    });
    return false;
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
      
      // 공격자와 수비자가 같은 국가가 아닌 경우에만 수비자 로그 생성
      if (event.attackerNationId !== event.defenderNationId && event.defenderNationId > 0) {
        defenderLogger.pushGlobalActionLog(defenseMsg, LogFormatType.PLAIN);
      }
    }

    await attackerLogger.flush();
    
    // 공격자와 수비자가 다른 경우에만 수비자 로그 flush
    if (event.attackerNationId !== event.defenderNationId && event.defenderNationId > 0) {
      await defenderLogger.flush();
    }

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

/**
 * 긴급천도 처리
 * PHP 참조: process_war.php 라인 710-754
 * 
 * @param sessionId 세션 ID
 * @param nationId 국가 ID
 * @param oldCapitalId 이전 수도 ID
 * @param year 현재 년도
 * @param month 현재 월
 */
async function processEmergencyCapitalMove(
  sessionId: string,
  nationId: number,
  oldCapitalId: number,
  year: number,
  month: number
): Promise<void> {
  try {
    // 1. 새 수도 찾기 (인구가 가장 많은 남은 도시)
    const remainingCities = await cityRepository.findByFilter({
      session_id: sessionId,
      'data.nation': nationId,
      'data.city': { $ne: oldCapitalId }
    });

    if (remainingCities.length === 0) {
      logger.warn('[BattleEventHook] No remaining cities for emergency capital move', {
        sessionId,
        nationId
      });
      return;
    }

    // 인구 순으로 정렬하여 가장 인구가 많은 도시 선택
    const sortedCities = remainingCities.sort((a, b) => {
      const popA = a.data?.pop || a.pop || 0;
      const popB = b.data?.pop || b.pop || 0;
      return popB - popA;
    });

    const newCapital = sortedCities[0];
    const newCapitalId = newCapital.data?.city || newCapital.city;
    const newCapitalName = newCapital.data?.name || newCapital.name || '도시';

    // 2. 국가 정보 업데이트 (수도 변경, 국고 50% 감소)
    const nation = await nationRepository.findByNationNum(sessionId, nationId);
    if (!nation) {
      return;
    }

    const nationData = nation.data || {};
    const nationName = nationData.name || nation.name || '무명';
    const currentGold = nationData.gold || 0;
    const currentRice = nationData.rice || 0;

    await nationRepository.updateByNationNum(sessionId, nationId, {
      'data.capital': newCapitalId,
      'data.gold': Math.floor(currentGold * 0.5),
      'data.rice': Math.floor(currentRice * 0.5)
    });

    // 3. 새 수도를 보급도시로 설정
    await cityRepository.updateByCityNum(sessionId, newCapitalId, {
      supply: 1
    });

    // 4. 수뇌부 (officer_level >= 5) 새 수도로 이동
    await generalRepository.updateManyByFilter(
      {
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $gte: 5 }
      },
      {
        $set: {
          'data.city': newCapitalId
        }
      }
    );

    // 5. 모든 장수 사기 20% 감소
    const allGenerals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': nationId
    });

    for (const general of allGenerals) {
      const generalData = general.data || {};
      const generalNo = generalData.no || general.no;
      const currentAtmos = generalData.atmos || 100;

      await generalRepository.updateOneByFilter(
        { session_id: sessionId, 'data.no': generalNo },
        {
          $set: {
            'data.atmos': Math.floor(currentAtmos * 0.8)
          }
        }
      );
    }

    // 6. 로그 생성
    const { ActionLogger } = await import('../logger/ActionLogger');
    const { LogFormatType } = await import('../../types/log.types');

    // 전역 역사 로그
    const globalLogger = new ActionLogger(0, nationId, year, month, sessionId, false);
    globalLogger.pushGlobalHistoryLog(
      `<M><b>【긴급천도】</b></><D><b>${nationName}</b></>이(가) 수도가 함락되어 <G><b>${newCapitalName}</b></>으로 긴급천도하였습니다.`,
      LogFormatType.PLAIN
    );
    await globalLogger.flush();

    // 각 장수에게 알림
    for (const general of allGenerals) {
      const generalData = general.data || {};
      const generalNo = generalData.no || general.no;
      const officerLevel = generalData.officer_level || 1;

      const genLogger = new ActionLogger(generalNo, nationId, year, month, sessionId, false);
      genLogger.pushGeneralActionLog(
        `수도가 함락되어 <G><b>${newCapitalName}</b></>으로 <M>긴급천도</>합니다.`,
        LogFormatType.PLAIN
      );
      
      if (officerLevel >= 5) {
        genLogger.pushGeneralActionLog(
          `수뇌는 <G><b>${newCapitalName}</b></>으로 집합되었습니다.`,
          LogFormatType.PLAIN
        );
      }
      await genLogger.flush();
    }

    // 7. Socket 브로드캐스트
    GameEventEmitter.broadcastGameEvent(sessionId, 'nation:capital_moved', {
      nationId,
      nationName,
      oldCapitalId,
      newCapitalId,
      newCapitalName,
      reason: 'emergency',
      timestamp: new Date()
    });

    logger.info('[BattleEventHook] Emergency capital move completed', {
      sessionId,
      nationId,
      nationName,
      oldCapitalId,
      newCapitalId,
      newCapitalName
    });
  } catch (error: any) {
    logger.error('[BattleEventHook] Error processing emergency capital move', {
      sessionId,
      nationId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 명예의 전당 기록
 * 통일 시 모든 장수의 통계를 Hall에 기록
 * 
 * @param sessionId 세션 ID
 * @param unifiedNationId 통일 국가 ID
 * @param year 통일 년도
 * @param month 통일 월
 */
async function recordHallOfFame(
  sessionId: string,
  unifiedNationId: number,
  year: number,
  month: number
): Promise<void> {
  try {
    // 세션 정보 조회
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      return;
    }

    const sessionData = session.data || {};
    const season = sessionData.season || 1;
    const scenario = sessionData.scenario || 0;

    // 1. 통일 국가 정보 조회
    const unifiedNation = await nationRepository.findByNationNum(sessionId, unifiedNationId);
    const nationName = unifiedNation?.data?.name || unifiedNation?.name || '무명';

    // 2. 통일 국가의 군주 (officer_level = 12) 조회 - 황제로 기록
    const lord = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': unifiedNationId,
      'data.officer_level': 12
    });

    if (lord.length > 0) {
      const emperor = lord[0];
      const emperorData = emperor.data || {};
      const emperorNo = emperorData.no || emperor.no;
      const emperorName = emperorData.name || emperor.name || '무명';

      // 황제 기록
      await Hall.findOneAndUpdate(
        {
          server_id: sessionId,
          season,
          scenario,
          type: 'emperor'
        },
        {
          server_id: sessionId,
          season,
          scenario,
          general_no: emperorNo,
          type: 'emperor',
          value: year * 100 + month, // 통일 시점
          owner: emperor.owner ? parseInt(String(emperor.owner)) : null,
          aux: {
            name: emperorName,
            nationName,
            unifiedYear: year,
            unifiedMonth: month,
            picture: emperorData.picture || '',
            color: emperorData.color || '#000000'
          }
        },
        { upsert: true, new: true }
      );

      logger.info('[BattleEventHook] Emperor recorded in Hall of Fame', {
        sessionId,
        emperorNo,
        emperorName,
        nationName,
        year,
        month
      });
    }

    // 3. 통일 국가의 수뇌부 (officer_level >= 5)를 공신으로 기록
    const chiefs = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': unifiedNationId,
      'data.officer_level': { $gte: 5, $lt: 12 }
    });

    for (let i = 0; i < chiefs.length; i++) {
      const chief = chiefs[i];
      const chiefData = chief.data || {};
      const chiefNo = chiefData.no || chief.no;
      const chiefName = chiefData.name || chief.name || '무명';
      const officerLevel = chiefData.officer_level || 5;

      await Hall.findOneAndUpdate(
        {
          server_id: sessionId,
          season,
          scenario,
          general_no: chiefNo,
          type: 'merit_official'
        },
        {
          server_id: sessionId,
          season,
          scenario,
          general_no: chiefNo,
          type: 'merit_official',
          value: officerLevel * 1000 + i, // 관직 수준 + 순위
          owner: chief.owner ? parseInt(String(chief.owner)) : null,
          aux: {
            name: chiefName,
            nationName,
            officerLevel,
            rank: i + 1,
            unifiedYear: year,
            unifiedMonth: month,
            picture: chiefData.picture || '',
            color: chiefData.color || '#000000'
          }
        },
        { upsert: true, new: true }
      );
    }

    logger.info('[BattleEventHook] Merit officials recorded in Hall of Fame', {
      sessionId,
      count: chiefs.length
    });

    // 4. 모든 플레이어 장수의 통계 기록 (CheckHallService 사용)
    const allGenerals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.npc': { $in: [0, false, null] } // NPC가 아닌 장수만
    });

    let recordedCount = 0;
    for (const general of allGenerals) {
      const generalData = general.data || {};
      const generalNo = generalData.no || general.no;

      if (generalNo && generalNo > 0) {
        await CheckHallService.execute(generalNo, sessionId);
        recordedCount++;
      }
    }

    logger.info('[BattleEventHook] Hall of Fame recording completed', {
      sessionId,
      totalRecorded: recordedCount,
      emperorRecorded: lord.length > 0,
      meritOfficialsRecorded: chiefs.length
    });

    // 5. Socket 브로드캐스트
    GameEventEmitter.broadcastGameEvent(sessionId, 'hall:updated', {
      sessionId,
      season,
      scenario,
      unifiedNationId,
      nationName,
      year,
      month,
      timestamp: new Date()
    });

  } catch (error: any) {
    logger.error('[BattleEventHook] Error recording Hall of Fame', {
      sessionId,
      unifiedNationId,
      error: error.message,
      stack: error.stack
    });
  }
}

