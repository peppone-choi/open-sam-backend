/**
 * ConflictService - 분쟁 관리 서비스
 * 
 * PHP conflict 시스템을 Node.js로 포팅 및 확장
 * 
 * 핵심 기능:
 * 1. 분쟁 기여도 관리 (addConflict)
 * 2. 분쟁 삭제 (deleteConflict) - 국가 멸망/방랑 시
 * 3. 점령 국가 결정 (getConquerNation) - 기여도 기반
 * 4. 분쟁 로그 (pushConflictLog)
 * 5. 분쟁 보상 (distributeRewards) - 기여도별 경험치/명성
 * 6. 전투 진행 상태 (getBattleProgress)
 */

import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { ActionLogger } from '../logger/ActionLogger';
import { JosaUtil } from '../../utils/JosaUtil';
import { logger } from '../../common/logger';

export interface ConflictData {
  [nationId: string]: number; // nationId -> 피해량(기여도)
}

export interface ConflictParticipant {
  nationId: number;
  nationName: string;
  damage: number;
  percentage: number;
  color?: string;
}

export interface BattleProgress {
  cityId: number;
  cityName: string;
  defenderNationId: number;
  defenderNationName: string;
  cityHp: number;
  cityMaxHp: number;
  cityHpPercent: number;
  wallHp: number;
  wallMaxHp: number;
  wallHpPercent: number;
  gateHp: number;
  gateMaxHp: number;
  gateHpPercent: number;
  participants: ConflictParticipant[];
  totalDamage: number;
  isUnderSiege: boolean;
  estimatedConqueror: ConflictParticipant | null;
}

export interface ConflictReward {
  generalId: number;
  nationId: number;
  contribution: number;
  expGain: number;
  fameGain: number;
  isConqueror: boolean;
}

class ConflictService {
  /**
   * 분쟁에 피해량 추가 (기여도 증가)
   * 
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @param nationId - 공격 국가 ID
   * @param damage - 피해량 (기여도)
   * @param options - 추가 옵션
   * @returns isNewConflict - 새로운 분쟁 참가자인지
   */
  async addConflict(
    sessionId: string,
    cityId: number,
    nationId: number,
    damage: number,
    options: {
      logger?: ActionLogger;
      isFirstStrike?: boolean;
      isLastStrike?: boolean;
    } = {}
  ): Promise<{ isNewConflict: boolean; conflict: ConflictData }> {
    const city = await cityRepository.findByCityNum(sessionId, cityId);
    if (!city) {
      throw new Error(`도시를 찾을 수 없습니다: ${cityId}`);
    }

    let conflict: ConflictData = this.parseConflict((city as any).conflict);
    let isNewConflict = false;
    let bonusDamage = damage;

    // 선타/막타 보너스 (5%)
    if (options.isFirstStrike || options.isLastStrike) {
      bonusDamage *= 1.05;
    }

    if (!conflict[nationId]) {
      // 새로운 분쟁 참가자
      conflict[nationId] = bonusDamage;
      isNewConflict = true;
    } else {
      // 기존 참가자 기여도 증가
      conflict[nationId] += bonusDamage;
    }

    // 기여도 순으로 정렬 (내림차순)
    conflict = this.sortConflict(conflict);

    // DB 업데이트
    await cityRepository.updateByCityNum(sessionId, cityId, {
      conflict: JSON.stringify(conflict)
    });

    // 새로운 분쟁 참가 로그
    if (isNewConflict && options.logger && Object.keys(conflict).length > 1) {
      await this.pushConflictLog(sessionId, cityId, nationId, options.logger);
    }

    return { isNewConflict, conflict };
  }

  /**
   * 국가의 분쟁 기록 삭제
   * 국가 멸망, 방랑 시 호출
   * 
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   */
  async deleteConflict(sessionId: string, nationId: number): Promise<void> {
    const cities = await cityRepository.findBySession(sessionId);
    
    for (const city of cities) {
      const cityAny = city as any;
      const conflict = this.parseConflict(cityAny.conflict);
      
      if (conflict[nationId]) {
        delete conflict[nationId];
        
        await cityRepository.updateByCityNum(sessionId, cityAny.city, {
          conflict: Object.keys(conflict).length > 0 ? JSON.stringify(conflict) : '{}'
        });
        
        logger.info('[ConflictService] 분쟁 기록 삭제', {
          sessionId,
          cityId: cityAny.city,
          cityName: cityAny.name,
          nationId
        });
      }
    }
  }

  /**
   * 도시의 분쟁 기록 초기화
   * 도시 점령 시 호출
   * 
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   */
  async clearConflict(sessionId: string, cityId: number): Promise<void> {
    await cityRepository.updateByCityNum(sessionId, cityId, {
      conflict: '{}'
    });
  }

  /**
   * 점령 국가 결정 (기여도 1위)
   * 
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @returns nationId - 점령 국가 ID (없으면 null)
   */
  async getConquerNation(sessionId: string, cityId: number): Promise<number | null> {
    const city = await cityRepository.findByCityNum(sessionId, cityId);
    if (!city) return null;

    const conflict = this.parseConflict((city as any).conflict);
    const nationIds = Object.keys(conflict);
    
    if (nationIds.length === 0) return null;

    // 기여도 1위 반환 (이미 정렬됨)
    return parseInt(nationIds[0]);
  }

  /**
   * 분쟁 참가자 목록 조회
   * 
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @returns 참가자 목록 (기여도 순)
   */
  async getConflictParticipants(
    sessionId: string,
    cityId: number
  ): Promise<ConflictParticipant[]> {
    const city = await cityRepository.findByCityNum(sessionId, cityId);
    if (!city) return [];

    const conflict = this.parseConflict((city as any).conflict);
    const totalDamage = Object.values(conflict).reduce((sum, d) => sum + d, 0);
    
    if (totalDamage === 0) return [];

    const participants: ConflictParticipant[] = [];
    
    for (const [nationIdStr, damage] of Object.entries(conflict)) {
      const nationId = parseInt(nationIdStr);
      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      
      participants.push({
        nationId,
        nationName: (nation as any)?.name || `국가${nationId}`,
        damage,
        percentage: Math.round((damage / totalDamage) * 1000) / 10,
        color: (nation as any)?.color || this.getNationColor(nationId)
      });
    }

    return participants;
  }

  /**
   * 분쟁 로그 기록 (【분쟁】)
   */
  async pushConflictLog(
    sessionId: string,
    cityId: number,
    newNationId: number,
    actionLogger: ActionLogger
  ): Promise<void> {
    const city = await cityRepository.findByCityNum(sessionId, cityId);
    const nation = await nationRepository.findByNationNum(sessionId, newNationId);
    
    if (!city || !nation) return;

    const cityName = (city as any).name || `도시${cityId}`;
    const nationName = (nation as any).name || `국가${newNationId}`;
    const josaYi = JosaUtil.pick(nationName, '이');

    actionLogger.pushGlobalHistoryLog(
      `<Y><b>【분쟁】</b></><G><b>${cityName}</b></>에 <D><b>${nationName}</b></>${josaYi} 분쟁에 참여합니다.`
    );
  }

  /**
   * 분쟁 협상 로그 기록 (【분쟁협상】)
   * 2위 이하 국가가 양보할 때
   */
  async pushNegotiationLog(
    sessionId: string,
    cityId: number,
    winnerNationId: number,
    loserNationId: number,
    actionLogger: ActionLogger
  ): Promise<void> {
    const city = await cityRepository.findByCityNum(sessionId, cityId);
    const winner = await nationRepository.findByNationNum(sessionId, winnerNationId);
    const loser = await nationRepository.findByNationNum(sessionId, loserNationId);
    
    if (!city || !winner || !loser) return;

    const cityName = (city as any).name || `도시${cityId}`;
    const winnerName = (winner as any).name || `국가${winnerNationId}`;
    const loserName = (loser as any).name || `국가${loserNationId}`;

    actionLogger.pushGlobalHistoryLog(
      `<C><b>【분쟁협상】</b></><G><b>${cityName}</b></>의 분쟁에서 <D><b>${loserName}</b></>이(가) <D><b>${winnerName}</b></>에게 양보했습니다.`
    );
  }

  /**
   * 분쟁 보상 분배
   * 기여도에 따라 경험치/명성 분배
   * 
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   * @param baseExp - 기본 경험치
   * @param baseFame - 기본 명성
   * @param conquerorNationId - 점령 국가 ID
   */
  async distributeRewards(
    sessionId: string,
    cityId: number,
    baseExp: number,
    baseFame: number,
    conquerorNationId: number
  ): Promise<ConflictReward[]> {
    const participants = await this.getConflictParticipants(sessionId, cityId);
    const rewards: ConflictReward[] = [];
    
    if (participants.length === 0) return rewards;

    for (const participant of participants) {
      const isConqueror = participant.nationId === conquerorNationId;
      const contributionRatio = participant.percentage / 100;
      
      // 점령자는 50% 추가 보너스
      const expMultiplier = isConqueror ? 1.5 : 1.0;
      const fameMultiplier = isConqueror ? 1.5 : 1.0;
      
      const expGain = Math.floor(baseExp * contributionRatio * expMultiplier);
      const fameGain = Math.floor(baseFame * contributionRatio * fameMultiplier);
      
      // 해당 국가의 참전 장수들에게 보상 분배
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        nation: participant.nationId,
        city: cityId
      });

      for (const general of generals) {
        const generalReward: ConflictReward = {
          generalId: general.no,
          nationId: participant.nationId,
          contribution: participant.percentage,
          expGain: Math.floor(expGain / Math.max(1, generals.length)),
          fameGain: Math.floor(fameGain / Math.max(1, generals.length)),
          isConqueror
        };

        rewards.push(generalReward);

        // 장수 경험치/명성 증가
        await generalRepository.updateById((general as any)._id.toString(), {
          experience: ((general as any).experience || 0) + generalReward.expGain,
          fame: ((general as any).fame || 0) + generalReward.fameGain
        });
      }
    }

    logger.info('[ConflictService] 분쟁 보상 분배', {
      sessionId,
      cityId,
      participantCount: participants.length,
      totalRewards: rewards.length
    });

    return rewards;
  }

  /**
   * 전투 진행 상태 조회 (전투 Bar용)
   * 
   * @param sessionId - 세션 ID
   * @param cityId - 도시 ID
   */
  async getBattleProgress(sessionId: string, cityId: number): Promise<BattleProgress | null> {
    const city = await cityRepository.findByCityNum(sessionId, cityId) as any;
    if (!city) return null;

    const conflict = this.parseConflict(city.conflict);
    const participants = await this.getConflictParticipants(sessionId, cityId);
    const totalDamage = Object.values(conflict).reduce((sum, d) => sum + d, 0);
    
    const defenderNation = city.nation 
      ? await nationRepository.findByNationNum(sessionId, city.nation) as any
      : null;

    // 도시 HP 계산 (PHP: def * 10)
    const cityMaxHp = (city.def_max || city.def || 1000) * 10;
    const cityHp = Math.max(0, (city.def || 0) * 10);
    
    const wallMaxHp = city.wall_max || city.wall || 1000;
    const wallHp = Math.max(0, city.wall || 0);
    
    const gateMaxHp = city.gate_max || 100;
    const gateHp = Math.max(0, city.gate || gateMaxHp);

    const estimatedConqueror = participants.length > 0 ? participants[0] : null;

    return {
      cityId: city.city,
      cityName: city.name || `도시${city.city}`,
      defenderNationId: city.nation || 0,
      defenderNationName: defenderNation?.name || '무소속',
      cityHp,
      cityMaxHp,
      cityHpPercent: Math.round((cityHp / cityMaxHp) * 100),
      wallHp,
      wallMaxHp,
      wallHpPercent: Math.round((wallHp / wallMaxHp) * 100),
      gateHp,
      gateMaxHp,
      gateHpPercent: Math.round((gateHp / gateMaxHp) * 100),
      participants,
      totalDamage,
      isUnderSiege: participants.length > 0 || totalDamage > 0,
      estimatedConqueror
    };
  }

  /**
   * 모든 분쟁 중인 도시 조회
   */
  async getAllConflictCities(sessionId: string): Promise<BattleProgress[]> {
    const cities = await cityRepository.findBySession(sessionId);
    const results: BattleProgress[] = [];

    for (const city of cities) {
      const cityAny = city as any;
      const conflict = this.parseConflict(cityAny.conflict);
      
      if (Object.keys(conflict).length > 0) {
        const progress = await this.getBattleProgress(sessionId, cityAny.city);
        if (progress) {
          results.push(progress);
        }
      }
    }

    return results;
  }

  /**
   * 월 갱신 시 분쟁 자동 해제
   * term=0이면 conflict 초기화
   */
  async processMonthlyConflictDecay(sessionId: string): Promise<void> {
    const cities = await cityRepository.findBySession(sessionId);
    
    for (const city of cities) {
      const cityAny = city as any;
      if (cityAny.term === 0 && cityAny.conflict && cityAny.conflict !== '{}') {
        await this.clearConflict(sessionId, cityAny.city);
        
        logger.info('[ConflictService] 분쟁 자동 해제', {
          sessionId,
          cityId: cityAny.city,
          cityName: cityAny.name
        });
      }
    }
  }

  // ===== Private Helpers =====

  private parseConflict(conflict: any): ConflictData {
    if (!conflict) return {};
    if (typeof conflict === 'object' && !Array.isArray(conflict)) {
      return conflict as ConflictData;
    }
    if (typeof conflict === 'string') {
      try {
        const parsed = JSON.parse(conflict);
        return typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  private sortConflict(conflict: ConflictData): ConflictData {
    return Object.fromEntries(
      Object.entries(conflict).sort(([, a], [, b]) => b - a)
    );
  }

  private getNationColor(nationId: number): string {
    // 기본 색상 팔레트
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#e67e22', '#34495e', '#c0392b', '#16a085'
    ];
    return colors[nationId % colors.length];
  }
}

export const conflictService = new ConflictService();


