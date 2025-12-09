/**
 * NationDestruction.service.ts - 국가 멸망/통일 서비스
 * 
 * 국가 멸망 및 천하통일 처리를 담당합니다.
 * 
 * PHP 참조: 
 * - core/hwe/process_war.php (국가 멸망 처리, line 606~)
 * - core/hwe/func_gamerule.php (통일 처리, line 730~)
 */

import mongoose from 'mongoose';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { logger } from '../../common/logger';
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { GameEventEmitter } from '../gameEventEmitter';
import { ExecuteEngineService } from '../global/ExecuteEngine.service';

/**
 * 국가 멸망 조건
 */
export interface DestructionCondition {
  /** 도시 0개로 인한 멸망 */
  noCities: boolean;
  /** 군주 사망/포로로 인한 멸망 */
  leaderIncapacitated: boolean;
  /** 후계자 없음 */
  noSuccessor: boolean;
}

/**
 * 국가 멸망 결과
 */
export interface DestructionResult {
  success: boolean;
  nationId: number;
  nationName: string;
  generalCount: number;
  absorbedGold: number;
  absorbedRice: number;
  error?: string;
}

/**
 * 통일 결과
 */
export interface UnificationResult {
  success: boolean;
  nationId: number;
  nationName: string;
  year: number;
  month: number;
  error?: string;
}

/**
 * 국가 멸망 서비스 클래스
 */
export class NationDestructionService {
  /**
   * 국가 멸망 조건 체크
   * 
   * 멸망 조건:
   * 1. 해당 국가가 소유한 도시가 0개
   * 2. 군주가 사망/포로 상태이고 후계자가 없음
   * 
   * @param sessionId 세션 ID
   * @param nationId 국가 ID
   * @returns 멸망 조건 및 여부
   */
  static async checkNationDestruction(
    sessionId: string,
    nationId: number
  ): Promise<{ shouldDestroy: boolean; conditions: DestructionCondition }> {
    const conditions: DestructionCondition = {
      noCities: false,
      leaderIncapacitated: false,
      noSuccessor: false
    };

    if (!nationId || nationId === 0) {
      return { shouldDestroy: false, conditions };
    }

    try {
      // 1. 도시 수 체크
      const cityCount = await cityRepository.count({
        session_id: sessionId,
        $or: [
          { nation: nationId },
          { 'data.nation': nationId }
        ]
      });

      if (cityCount === 0) {
        conditions.noCities = true;
        logger.info('[NationDestruction] 도시 0개로 멸망 조건 충족', {
          sessionId,
          nationId,
          cityCount
        });
        return { shouldDestroy: true, conditions };
      }

      // 2. 군주 상태 체크
      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      if (!nation) {
        return { shouldDestroy: false, conditions };
      }

      const leaderId = nation.data?.leader || nation.leader;
      if (!leaderId) {
        // 군주가 없으면 후계자 체크
        conditions.leaderIncapacitated = true;
        conditions.noSuccessor = true;

        // 관직 5 이상(태수급) 장수가 있으면 후계자 존재
        const potentialSuccessors = await generalRepository.findByFilter({
          session_id: sessionId,
          $and: [
            { $or: [{ 'data.nation': nationId }, { nation: nationId }] },
            { $or: [{ 'data.officer_level': { $gte: 5 } }, { officer_level: { $gte: 5 } }] }
          ]
        });

        if (potentialSuccessors.length > 0) {
          conditions.noSuccessor = false;
        }

        if (conditions.leaderIncapacitated && conditions.noSuccessor) {
          logger.info('[NationDestruction] 군주 부재 + 후계자 없음으로 멸망 조건 충족', {
            sessionId,
            nationId
          });
          return { shouldDestroy: true, conditions };
        }
      } else {
        // 군주 상태 확인
        const leader = await generalRepository.findBySessionAndNo(sessionId, leaderId);
        if (leader) {
          const leaderData = leader.data || {};
          const penalty = leaderData.penalty || leader.penalty;
          const isDead = leaderData.is_dead || leader.is_dead;

          if (isDead || penalty === 'PRISONER' || penalty === 'DEAD') {
            conditions.leaderIncapacitated = true;

            // 후계자 체크 (관직 11 = 왕/황후, 관직 10 = 승상 등)
            const successors = await generalRepository.findByFilter({
              session_id: sessionId,
              $and: [
                { $or: [{ 'data.nation': nationId }, { nation: nationId }] },
                { $or: [{ 'data.officer_level': { $gte: 10 } }, { officer_level: { $gte: 10 } }] },
                { $nor: [{ 'data.no': leaderId }, { no: leaderId }] }
              ]
            });

            if (successors.length === 0) {
              conditions.noSuccessor = true;
              logger.info('[NationDestruction] 군주 무력화 + 후계자 없음으로 멸망 조건 충족', {
                sessionId,
                nationId,
                leaderId,
                penalty,
                isDead
              });
              return { shouldDestroy: true, conditions };
            }
          }
        }
      }

      return { shouldDestroy: false, conditions };
    } catch (error: any) {
      logger.error('[NationDestruction] 멸망 조건 체크 실패', {
        sessionId,
        nationId,
        error: error.message
      });
      return { shouldDestroy: false, conditions };
    }
  }

  /**
   * 국가 멸망 처리
   * 
   * 처리 내용:
   * 1. 모든 소속 장수를 재야(nation=0)로 전환
   * 2. 외교 관계 정리
   * 3. 국고 자원 승전국에 일부 이전
   * 4. 역사 로그 기록
   * 5. 이벤트 트리거
   * 
   * @param sessionId 세션 ID
   * @param nationId 멸망하는 국가 ID
   * @param conquerorNationId 승전국 ID (선택)
   * @param conquerorGeneralId 점령 장수 ID (선택)
   * @returns 멸망 처리 결과
   */
  static async destroyNation(
    sessionId: string,
    nationId: number,
    conquerorNationId?: number,
    conquerorGeneralId?: number
  ): Promise<DestructionResult> {
    const result: DestructionResult = {
      success: false,
      nationId,
      nationName: '',
      generalCount: 0,
      absorbedGold: 0,
      absorbedRice: 0
    };

    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        // 1. 국가 정보 조회
        const nation = await nationRepository.findByNationNum(sessionId, nationId);
        if (!nation) {
          throw new Error(`국가를 찾을 수 없음: ${nationId}`);
        }

        const nationData = nation.data || {};
        result.nationName = nationData.name || nation.name || '무명';

        // 2. 세션 정보 조회
        const session = await sessionRepository.findBySessionId(sessionId);
        const sessionData = session?.data || {};
        const year = sessionData.year || 184;
        const month = sessionData.month || 1;

        logger.info('[NationDestruction] 국가 멸망 처리 시작', {
          sessionId,
          nationId,
          nationName: result.nationName,
          conquerorNationId
        });

        // 3. 소속 장수 조회 및 재야 전환
        const generals = await generalRepository.findByFilter({
          session_id: sessionId,
          $or: [
            { 'data.nation': nationId },
            { nation: nationId }
          ]
        });

        let totalGeneralGold = 0;
        let totalGeneralRice = 0;

        for (const general of generals) {
          const generalData = general.data || {};
          const generalNo = generalData.no || general.no;

          // 장수 자원 수집 (멸망 시 장수 자원 일부 흡수)
          totalGeneralGold += (generalData.gold || 0);
          totalGeneralRice += (generalData.rice || 0);

          // 재야 전환
          await generalRepository.updateOneByFilter(
            { session_id: sessionId, $or: [{ 'data.no': generalNo }, { no: generalNo }] },
            {
              $set: {
                'data.nation': 0,
                'data.officer_level': 1,
                'data.officer_city': 0,
                'data.gold': Math.floor((generalData.gold || 0) * 0.5), // 자원 50% 유지
                'data.rice': Math.floor((generalData.rice || 0) * 0.5)
              }
            }
          );
        }

        result.generalCount = generals.length;

        // 4. 국고 자원 계산 (기본량 제외)
        const baseGold = 0;
        const baseRice = 2000;
        const nationGold = Math.max((nationData.gold || nation.gold || 0) - baseGold, 0);
        const nationRice = Math.max((nationData.rice || nation.rice || 0) - baseRice, 0);

        // 흡수량: 국고 50% + 장수 자원 50%
        result.absorbedGold = Math.floor((nationGold + totalGeneralGold) / 2);
        result.absorbedRice = Math.floor((nationRice + totalGeneralRice) / 2);

        // 5. 승전국에 자원 이전
        if (conquerorNationId && conquerorNationId > 0) {
          const conqueror = await nationRepository.findByNationNum(sessionId, conquerorNationId);
          if (conqueror) {
            const conquerorData = conqueror.data || {};
            const currentGold = conquerorData.gold || conqueror.gold || 0;
            const currentRice = conquerorData.rice || conqueror.rice || 0;

            await nationRepository.updateByNationNum(sessionId, conquerorNationId, {
              'data.gold': currentGold + result.absorbedGold,
              'data.rice': currentRice + result.absorbedRice
            });

            logger.info('[NationDestruction] 승전국 자원 이전', {
              sessionId,
              conquerorNationId,
              gold: result.absorbedGold,
              rice: result.absorbedRice
            });
          }
        }

        // 6. 외교 관계 정리
        try {
          const { Diplomacy } = await import('../../models/diplomacy.model');
          // @ts-ignore - mongoose union type compatibility
          await Diplomacy.deleteMany({
            session_id: sessionId,
            $or: [
              { me: nationId },
              { you: nationId }
            ]
          });
        } catch (e) {
          logger.warn('[NationDestruction] 외교 관계 정리 실패 (무시)', { error: e });
        }

        // 7. 국가 상태 업데이트 (멸망 표시)
        await nationRepository.updateByNationNum(sessionId, nationId, {
          'data.destroyed': true,
          'data.destroyed_at': new Date(),
          'data.destroyed_by': conquerorNationId || null,
          'data.gold': 0,
          'data.rice': 0,
          'data.gennum': 0
        });

        // 8. 역사 로그 기록
        const { ActionLogger } = await import('../logger/ActionLogger');
        const globalLogger = new ActionLogger(0, nationId, year, month, sessionId, false);
        
        let historyMsg = `<R><b>【멸망】</b></><D><b>${result.nationName}</b></>이(가) 멸망하였습니다.`;
        if (conquerorNationId) {
          const conquerorNation = await nationRepository.findByNationNum(sessionId, conquerorNationId);
          const conquerorName = conquerorNation?.data?.name || conquerorNation?.name || '적국';
          historyMsg = `<R><b>【멸망】</b></><D><b>${result.nationName}</b></>이(가) <D><b>${conquerorName}</b></>에 의해 멸망하였습니다.`;
        }
        
        globalLogger.pushGlobalHistoryLog(historyMsg);
        await globalLogger.flush();

        // 9. 이벤트 트리거
        await ExecuteEngineService.runEventHandler(sessionId, 'DESTROY_NATION', {
          year,
          month,
          session_id: sessionId,
          destroyedNationId: nationId,
          destroyedNationName: result.nationName,
          attackerNationId: conquerorNationId,
          attackerGeneralId: conquerorGeneralId,
          absorbedGold: result.absorbedGold,
          absorbedRice: result.absorbedRice,
          generalCount: result.generalCount
        });

        // 10. Socket 브로드캐스트
        GameEventEmitter.broadcastGameEvent(sessionId, 'nation:destroyed', {
          nationId,
          nationName: result.nationName,
          conquerorNationId,
          generalCount: result.generalCount,
          timestamp: new Date()
        });

        result.success = true;
      }, {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: 60000
      });

      // 트랜잭션 성공 후 캐시 무효화
      await Promise.all([
        invalidateCache('nation', sessionId, nationId, { targets: ['entity', 'lists'] }),
        invalidateCache('general', sessionId, undefined, { targets: ['lists'] })
        // diplomacy 캐시는 별도로 처리 (invalidateCache에서 미지원)
      ]);

      logger.info('[NationDestruction] 국가 멸망 완료', {
        sessionId,
        nationId,
        nationName: result.nationName,
        generalCount: result.generalCount,
        absorbedGold: result.absorbedGold,
        absorbedRice: result.absorbedRice
      });

    } catch (error: any) {
      result.error = error.message;
      logger.error('[NationDestruction] 국가 멸망 처리 실패', {
        sessionId,
        nationId,
        error: error.message,
        stack: error.stack
      });
    } finally {
      await mongoSession.endSession();
    }

    return result;
  }

  /**
   * 천하통일 조건 체크
   * 
   * 통일 조건:
   * 1. 하나의 국가만 도시를 보유
   * 2. 모든 도시가 한 국가 소유
   * 
   * @param sessionId 세션 ID
   * @returns 통일 여부 및 통일 국가 ID
   */
  static async checkUnification(
    sessionId: string
  ): Promise<{ isUnified: boolean; winnerNationId: number | null }> {
    try {
      // 세션 상태 확인 (이미 통일되었는지)
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { isUnified: false, winnerNationId: null };
      }

      const sessionData = session.data || {};
      if (sessionData.isunited === 2 || sessionData.isunited === 3) {
        // 이미 통일됨
        return { isUnified: true, winnerNationId: sessionData.unifiedNationId || null };
      }

      // 모든 도시 조회
      const allCities = await cityRepository.findByFilter({
        session_id: sessionId
      });

      if (allCities.length === 0) {
        return { isUnified: false, winnerNationId: null };
      }

      // 도시를 보유한 국가 집합
      const nationsWithCities = new Set<number>();
      for (const city of allCities) {
        const cityData = city.data || {};
        const nationId = cityData.nation || city.nation;
        if (nationId && nationId > 0) {
          nationsWithCities.add(nationId);
        }
      }

      // 공백지(nation=0) 제외하고 하나의 국가만 있으면 통일
      if (nationsWithCities.size === 1) {
        const winnerNationId = Array.from(nationsWithCities)[0];
        logger.info('[NationDestruction] 천하통일 조건 충족', {
          sessionId,
          winnerNationId,
          totalCities: allCities.length
        });
        return { isUnified: true, winnerNationId };
      }

      return { isUnified: false, winnerNationId: null };
    } catch (error: any) {
      logger.error('[NationDestruction] 통일 체크 실패', {
        sessionId,
        error: error.message
      });
      return { isUnified: false, winnerNationId: null };
    }
  }

  /**
   * 천하통일 처리
   * 
   * 처리 내용:
   * 1. 세션 상태 업데이트 (통일 표시)
   * 2. 통일 국가 및 군주 기록
   * 3. 명예의 전당 기록
   * 4. 역사 로그 기록
   * 5. 이벤트 트리거
   * 
   * @param sessionId 세션 ID
   * @param winnerNationId 통일 국가 ID
   * @returns 통일 처리 결과
   */
  static async handleUnification(
    sessionId: string,
    winnerNationId: number
  ): Promise<UnificationResult> {
    const result: UnificationResult = {
      success: false,
      nationId: winnerNationId,
      nationName: '',
      year: 0,
      month: 0
    };

    try {
      // 1. 세션 정보 조회
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        result.error = '세션을 찾을 수 없음';
        return result;
      }

      const sessionData = session.data || {};
      result.year = sessionData.year || 184;
      result.month = sessionData.month || 1;

      // 2. 국가 정보 조회
      const nation = await nationRepository.findByNationNum(sessionId, winnerNationId);
      if (!nation) {
        result.error = '국가를 찾을 수 없음';
        return result;
      }

      const nationData = nation.data || {};
      result.nationName = nationData.name || nation.name || '무명';

      logger.info('[NationDestruction] 천하통일 처리 시작', {
        sessionId,
        winnerNationId,
        nationName: result.nationName,
        year: result.year,
        month: result.month
      });

      // 3. 세션 상태 업데이트
      sessionData.isunited = 2; // 통일 완료
      sessionData.unifiedNationId = winnerNationId;
      sessionData.unifiedAt = new Date();
      sessionData.refreshLimit = (sessionData.refreshLimit || 1000) * 100;
      session.data = sessionData;
      session.markModified('data');
      await session.save();

      // 4. 역사 로그 기록
      const { ActionLogger } = await import('../logger/ActionLogger');
      const globalLogger = new ActionLogger(0, winnerNationId, result.year, result.month, sessionId, false);
      
      const josaYi = this.pickJosa(result.nationName, '이');
      globalLogger.pushGlobalHistoryLog(
        `<Y><b>【통일】</b></><D><b>${result.nationName}</b></>${josaYi} 천하를 통일하였습니다!`
      );
      await globalLogger.flush();

      // 5. 모든 장수에게 통일 로그
      const allGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        $or: [
          { 'data.nation': winnerNationId },
          { nation: winnerNationId }
        ]
      });

      for (const general of allGenerals) {
        const generalData = general.data || {};
        const generalNo = generalData.no || general.no;
        
        const genLogger = new ActionLogger(generalNo, winnerNationId, result.year, result.month, sessionId, false);
        genLogger.pushGeneralActionLog(
          `<D><b>${result.nationName}</b></>${josaYi} 천하를 통일하였습니다!`
        );
        await genLogger.flush();
      }

      // 6. 이벤트 트리거
      await ExecuteEngineService.runEventHandler(sessionId, 'UNITED', {
        year: result.year,
        month: result.month,
        session_id: sessionId,
        unifiedNationId: winnerNationId,
        unifiedNationName: result.nationName
      });

      // 7. 명예의 전당 기록
      await this.recordHallOfFame(sessionId, winnerNationId, result.year, result.month);

      // 7-1. 통일 스냅샷 저장 (히스토리 & HallOfFame 스냅샷)
      try {
        const { HistoryService } = await import('../HistoryService');
        await HistoryService.saveGameResult(sessionId, winnerNationId);
      } catch (historyError: any) {
        logger.error('[NationDestruction] HistoryService 저장 실패', {
          sessionId,
          winnerNationId,
          error: historyError?.message
        });
      }

      // 8. Socket 브로드캐스트
      GameEventEmitter.broadcastGameEvent(sessionId, 'game:unified', {
        nationId: winnerNationId,
        nationName: result.nationName,
        year: result.year,
        month: result.month,
        timestamp: new Date()
      });

      result.success = true;

      logger.info('[NationDestruction] 천하통일 처리 완료', {
        sessionId,
        winnerNationId,
        nationName: result.nationName
      });

    } catch (error: any) {
      result.error = error.message;
      logger.error('[NationDestruction] 천하통일 처리 실패', {
        sessionId,
        winnerNationId,
        error: error.message,
        stack: error.stack
      });
    }

    return result;
  }

  /**
   * 도시 점령 후 멸망/통일 체크 통합 함수
   * 
   * ProcessWar.ts에서 호출하기 편하도록 통합된 함수
   * 
   * @param sessionId 세션 ID
   * @param defenderNationId 수비측 국가 ID
   * @param attackerNationId 공격측 국가 ID
   * @param attackerGeneralId 공격 장수 ID
   */
  static async processPostConquest(
    sessionId: string,
    defenderNationId: number,
    attackerNationId: number,
    attackerGeneralId: number
  ): Promise<void> {
    // 1. 수비측 국가 멸망 체크
    if (defenderNationId && defenderNationId > 0) {
      const { shouldDestroy } = await this.checkNationDestruction(sessionId, defenderNationId);
      
      if (shouldDestroy) {
        await this.destroyNation(
          sessionId,
          defenderNationId,
          attackerNationId,
          attackerGeneralId
        );
      }
    }

    // 2. 통일 체크
    const { isUnified, winnerNationId } = await this.checkUnification(sessionId);
    
    if (isUnified && winnerNationId) {
      await this.handleUnification(sessionId, winnerNationId);
    }
  }

  /**
   * 명예의 전당 기록
   */
  private static async recordHallOfFame(
    sessionId: string,
    nationId: number,
    year: number,
    month: number
  ): Promise<void> {
    try {
      const { Hall } = await import('../../models/hall.model');
      const { CheckHallService } = await import('../admin/CheckHall.service');

      const session = await sessionRepository.findBySessionId(sessionId);
      const sessionData = session?.data || {};
      const season = sessionData.season || 1;
      const scenario = sessionData.scenario || 0;

      // 통일 국가 정보
      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      const nationName = nation?.data?.name || nation?.name || '무명';

      // 황제 (군주) 기록
      const emperor = await generalRepository.findByFilter({
        session_id: sessionId,
        $or: [
          { 'data.nation': nationId, 'data.officer_level': 12 },
          { nation: nationId, officer_level: 12 }
        ]
      });

      if (emperor.length > 0) {
        const emp = emperor[0];
        const empData = emp.data || {};
        const empNo = empData.no || emp.no;
        const empName = empData.name || emp.name || '무명';

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
            general_no: empNo,
            type: 'emperor',
            value: year * 100 + month,
            owner: emp.owner ? parseInt(String(emp.owner)) : null,
            aux: {
              name: empName,
              nationName,
              unifiedYear: year,
              unifiedMonth: month,
              picture: empData.picture || '',
              color: empData.color || '#000000'
            }
          },
          { upsert: true, new: true }
        );

        logger.info('[NationDestruction] 황제 기록 완료', {
          sessionId,
          empNo,
          empName
        });
      }

      // 플레이어 장수 기록
      const playerGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.npc': { $in: [0, false, null] }
      });

      for (const general of playerGenerals) {
        const generalData = general.data || {};
        const generalNo = generalData.no || general.no;
        if (generalNo && generalNo > 0) {
          await CheckHallService.execute(generalNo, sessionId);
        }
      }

      logger.info('[NationDestruction] 명예의 전당 기록 완료', {
        sessionId,
        playerCount: playerGenerals.length
      });

    } catch (error: any) {
      logger.error('[NationDestruction] 명예의 전당 기록 실패', {
        sessionId,
        nationId,
        error: error.message
      });
    }
  }

  /**
   * 조사 선택 헬퍼 (이/가)
   */
  private static pickJosa(word: string, josa: string): string {
    if (!word || word.length === 0) return josa;
    
    const lastChar = word.charCodeAt(word.length - 1);
    
    // 한글 범위 체크 (가 ~ 힣)
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
      return josa;
    }
    
    // 종성 유무 확인
    const hasJongseong = (lastChar - 0xAC00) % 28 !== 0;
    
    switch (josa) {
      case '이':
      case '가':
        return hasJongseong ? '이' : '가';
      case '을':
      case '를':
        return hasJongseong ? '을' : '를';
      case '은':
      case '는':
        return hasJongseong ? '은' : '는';
      case '과':
      case '와':
        return hasJongseong ? '과' : '와';
      case '으로':
      case '로':
        return hasJongseong ? '으로' : '로';
      default:
        return josa;
    }
  }
}

// 편의를 위한 함수 export
export const checkNationDestruction = NationDestructionService.checkNationDestruction.bind(NationDestructionService);
export const destroyNation = NationDestructionService.destroyNation.bind(NationDestructionService);
export const checkUnification = NationDestructionService.checkUnification.bind(NationDestructionService);
export const handleUnification = NationDestructionService.handleUnification.bind(NationDestructionService);
export const processPostConquest = NationDestructionService.processPostConquest.bind(NationDestructionService);

