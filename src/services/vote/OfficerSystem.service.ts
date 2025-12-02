/**
 * OfficerSystemService
 * 관직 임명/해임 시스템
 * 
 * Agent I: 정치/투표 시스템
 * PHP j_myBossInfo.php 대응
 */

import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { sessionRepository } from '../../repositories/session.repository';
import {
  OfficerLevel,
  OfficerAppointment,
  OfficerDismissal,
  OfficerInfo,
  getNationChiefLevel,
  doOfficerSet,
  isOfficerSet,
  clearOfficerSet,
  checkOfficerStatRequirement,
  getOfficerTitle,
  calcLeadershipBonus,
  CHIEF_STAT_MIN
} from '../../types/vote.types';
import { PenaltyKey } from '../../Enums/PenaltyKey';

export interface AppointOfficerResult {
  result: boolean;
  message?: string;
  previousHolder?: {
    generalId: number;
    name: string;
  };
}

export interface DismissOfficerResult {
  result: boolean;
  message?: string;
}

export interface GetOfficerListResult {
  result: boolean;
  officers?: OfficerInfo[];
  message?: string;
}

export class OfficerSystemService {
  /**
   * 수뇌 임명 (officer_level 5~11)
   * PHP do수뇌임명() 대응
   */
  static async appointOfficer(params: OfficerAppointment): Promise<AppointOfficerResult> {
    const {
      sessionId,
      nationId,
      targetGeneralId,
      targetOfficerLevel,
      appointerId
    } = params;

    try {
      // 장수 조회
      const general = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: targetGeneralId
      });

      if (!general) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const generalData = general.data || {};

      // 같은 국가 소속인지 확인
      if (generalData.nation !== nationId) {
        return { result: false, message: '같은 국가 소속이 아닙니다.' };
      }

      // 현재 관직이 군주인지 확인
      if (generalData.officer_level === OfficerLevel.RULER) {
        return { result: false, message: '군주를 대상으로 할 수 없습니다.' };
      }

      // 임명자 페널티 확인
      if (appointerId > 0) {
        const appointer = await generalRepository.findOneByFilter({
          session_id: sessionId,
          no: appointerId
        });
        
        if (appointer?.penalty?.[PenaltyKey.NoChiefChange]) {
          return { result: false, message: '수뇌를 임명할 수 없는 상태입니다.' };
        }
      }

      // 대상 장수 페널티 확인
      if (general.penalty?.[PenaltyKey.NoChief]) {
        return { result: false, message: '수뇌가 될 수 없는 상태입니다.' };
      }

      // 국가 정보 조회
      const nation = await nationRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });

      if (!nation) {
        return { result: false, message: '국가를 찾을 수 없습니다.' };
      }

      const nationData = nation.data || {};
      const chiefSet = nationData.chief_set || 0;
      const nationLevel = nationData.level || nation.level || 0;

      // 임명 가능 레벨 확인
      const minChiefLevel = getNationChiefLevel(nationLevel);
      if (targetOfficerLevel < minChiefLevel) {
        return { result: false, message: '임명불가능한 관직입니다.' };
      }

      // 관직 잠금 확인
      if (isOfficerSet(chiefSet, targetOfficerLevel)) {
        return { result: false, message: '지금은 임명할 수 없습니다.' };
      }

      // 능력치 요구 확인
      const strength = generalData.strength || 0;
      const intel = generalData.intel || 0;
      const chiefStatMin = await this.getChiefStatMin(sessionId);

      const statCheck = checkOfficerStatRequirement(
        targetOfficerLevel,
        strength,
        intel,
        chiefStatMin
      );

      if (!statCheck.valid) {
        return { result: false, message: statCheck.reason };
      }

      // 기존 해당 관직 보유자 해임
      const previousHolder = await generalRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': targetOfficerLevel
      });

      let previousHolderInfo: { generalId: number; name: string } | undefined;

      if (previousHolder && previousHolder.no !== targetGeneralId) {
        previousHolderInfo = {
          generalId: previousHolder.no,
          name: previousHolder.data?.name || previousHolder.name || '무명'
        };

        // 기존 보유자 일반 장수로 강등
        await generalRepository.updateBySessionAndNo(sessionId, previousHolder.no, {
          'data.officer_level': OfficerLevel.NORMAL,
          'data.officer_city': 0,
          officer_level: OfficerLevel.NORMAL
        });
      }

      // 새 장수 임명
      await generalRepository.updateBySessionAndNo(sessionId, targetGeneralId, {
        'data.officer_level': targetOfficerLevel,
        'data.officer_city': 0,
        officer_level: targetOfficerLevel
      });

      // 국가 chief_set 업데이트 (관직 잠금)
      const newChiefSet = doOfficerSet(chiefSet, targetOfficerLevel);
      await nationRepository.updateByNationNum(sessionId, nationId, {
        'data.chief_set': newChiefSet,
        chief_set: newChiefSet
      });

      return {
        result: true,
        previousHolder: previousHolderInfo
      };
    } catch (error: any) {
      console.error('[OfficerSystemService] appointOfficer error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 도시 관직 임명 (officer_level 2~4)
   * PHP do도시임명() 대응
   */
  static async appointCityOfficer(params: OfficerAppointment): Promise<AppointOfficerResult> {
    const {
      sessionId,
      nationId,
      targetGeneralId,
      targetOfficerLevel,
      appointerId,
      cityId
    } = params;

    try {
      if (!cityId) {
        return { result: false, message: '도시를 지정해주세요.' };
      }

      // 도시 관직 레벨 확인 (2, 3, 4만 가능)
      if (targetOfficerLevel < 2 || targetOfficerLevel > 4) {
        return { result: false, message: '도시 관직이 아닙니다.' };
      }

      // 장수 조회
      const general = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: targetGeneralId
      });

      if (!general) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const generalData = general.data || {};

      // 같은 국가 소속인지 확인
      if (generalData.nation !== nationId) {
        return { result: false, message: '같은 국가 소속이 아닙니다.' };
      }

      // 임명자 페널티 확인
      if (appointerId > 0) {
        const appointer = await generalRepository.findOneByFilter({
          session_id: sessionId,
          no: appointerId
        });

        // 기존 수뇌(>=4)를 변경하려는 경우
        if (generalData.officer_level >= 4) {
          if (appointer?.penalty?.[PenaltyKey.NoChiefChange]) {
            return { result: false, message: '수뇌인 장수를 변경할 수 없는 상태입니다.' };
          }
        }
      }

      // 도시 확인
      const city = await cityRepository.findOneByFilter({
        session_id: sessionId,
        'data.city': cityId,
        'data.nation': nationId
      });

      if (!city) {
        return { result: false, message: '아국 도시가 아닙니다.' };
      }

      const cityData = city.data || {};
      const officerSet = cityData.officer_set || 0;

      // 관직 중복 확인
      if (isOfficerSet(officerSet, targetOfficerLevel)) {
        return { result: false, message: '이미 다른 장수가 임명되어있습니다.' };
      }

      // 능력치 요구 확인
      const chiefStatMin = await this.getChiefStatMin(sessionId);

      if (targetOfficerLevel === 4) {
        // 태수: 무력 요구
        if ((generalData.strength || 0) < chiefStatMin) {
          return { result: false, message: '무력이 부족합니다.' };
        }
      }

      if (targetOfficerLevel === 3) {
        // 군사: 지력 요구
        if ((generalData.intel || 0) < chiefStatMin) {
          return { result: false, message: '지력이 부족합니다.' };
        }
      }

      // 기존 해당 관직 보유자 해임
      const previousHolder = await generalRepository.findOneByFilter({
        session_id: sessionId,
        'data.officer_level': targetOfficerLevel,
        'data.officer_city': cityId
      });

      let previousHolderInfo: { generalId: number; name: string } | undefined;

      if (previousHolder && previousHolder.no !== targetGeneralId) {
        previousHolderInfo = {
          generalId: previousHolder.no,
          name: previousHolder.data?.name || previousHolder.name || '무명'
        };

        // 기존 보유자 일반 장수로 강등
        await generalRepository.updateBySessionAndNo(sessionId, previousHolder.no, {
          'data.officer_level': OfficerLevel.NORMAL,
          'data.officer_city': 0,
          officer_level: OfficerLevel.NORMAL
        });
      }

      // 새 장수 임명
      await generalRepository.updateBySessionAndNo(sessionId, targetGeneralId, {
        'data.officer_level': targetOfficerLevel,
        'data.officer_city': cityId,
        officer_level: targetOfficerLevel
      });

      // 도시 officer_set 업데이트
      const newOfficerSet = doOfficerSet(officerSet, targetOfficerLevel);
      await cityRepository.updateByCityNum(sessionId, cityId, {
        'data.officer_set': newOfficerSet,
        officer_set: newOfficerSet
      });

      return {
        result: true,
        previousHolder: previousHolderInfo
      };
    } catch (error: any) {
      console.error('[OfficerSystemService] appointCityOfficer error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 관직 해임
   */
  static async dismissOfficer(params: OfficerDismissal): Promise<DismissOfficerResult> {
    const { sessionId, nationId, targetGeneralId, dismisserId, reason } = params;

    try {
      // 장수 조회
      const general = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: targetGeneralId
      });

      if (!general) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const generalData = general.data || {};

      // 같은 국가 소속인지 확인
      if (generalData.nation !== nationId) {
        return { result: false, message: '같은 국가 소속이 아닙니다.' };
      }

      // 군주는 해임 불가
      if (generalData.officer_level === OfficerLevel.RULER) {
        return { result: false, message: '군주는 해임할 수 없습니다.' };
      }

      // 이미 일반 장수인 경우
      if (generalData.officer_level <= OfficerLevel.NORMAL) {
        return { result: false, message: '이미 일반 장수입니다.' };
      }

      const currentOfficerLevel = generalData.officer_level;
      const officerCity = generalData.officer_city || 0;

      // 장수 관직 초기화
      await generalRepository.updateBySessionAndNo(sessionId, targetGeneralId, {
        'data.officer_level': OfficerLevel.NORMAL,
        'data.officer_city': 0,
        officer_level: OfficerLevel.NORMAL
      });

      // 도시 관직인 경우 도시 officer_set 업데이트
      if (currentOfficerLevel >= 2 && currentOfficerLevel <= 4 && officerCity) {
        const city = await cityRepository.findOneByFilter({
          session_id: sessionId,
          'data.city': officerCity
        });

        if (city) {
          const cityData = (city as any).data || city || {};
          const newOfficerSet = clearOfficerSet(cityData.officer_set || 0, currentOfficerLevel);
          await cityRepository.updateByCityNum(sessionId, officerCity, {
            'data.officer_set': newOfficerSet,
            officer_set: newOfficerSet
          });
        }
      }

      return { result: true };
    } catch (error: any) {
      console.error('[OfficerSystemService] dismissOfficer error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 추방 (관직 해임 + 국가 제명)
   * PHP do추방() 대응
   */
  static async expelGeneral(params: OfficerDismissal): Promise<DismissOfficerResult> {
    const { sessionId, nationId, targetGeneralId, dismisserId } = params;

    try {
      // 장수 조회
      const general = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: targetGeneralId
      });

      if (!general) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const generalData = general.data || {};

      // 같은 국가 소속인지 확인
      if (generalData.nation !== nationId) {
        return { result: false, message: '같은 국가 소속이 아닙니다.' };
      }

      // 군주는 추방 불가
      if (generalData.officer_level === OfficerLevel.RULER) {
        return { result: false, message: '군주는 추방할 수 없습니다.' };
      }

      // 자기 자신 추방 불가
      if (targetGeneralId === dismisserId) {
        return { result: false, message: '자기 자신을 추방할 수 없습니다.' };
      }

      const currentOfficerLevel = generalData.officer_level || 0;
      const officerCity = generalData.officer_city || 0;

      // 도시 관직인 경우 도시 officer_set 업데이트
      if (currentOfficerLevel >= 2 && currentOfficerLevel <= 4 && officerCity) {
        const city = await cityRepository.findOneByFilter({
          session_id: sessionId,
          'data.city': officerCity
        });

        if (city) {
          const cityData = (city as any).data || city || {};
          const newOfficerSet = clearOfficerSet(cityData.officer_set || 0, currentOfficerLevel);
          await cityRepository.updateByCityNum(sessionId, officerCity, {
            'data.officer_set': newOfficerSet,
            officer_set: newOfficerSet
          });
        }
      }

      // 장수 국가/관직 초기화 (재야로)
      await generalRepository.updateBySessionAndNo(sessionId, targetGeneralId, {
        'data.nation': 0,
        'data.officer_level': OfficerLevel.NONE,
        'data.officer_city': 0,
        'data.troop': 0,
        nation: 0,
        officer_level: OfficerLevel.NONE
      });

      return { result: true };
    } catch (error: any) {
      console.error('[OfficerSystemService] expelGeneral error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 선양 (군주 양위)
   */
  static async abdicateRuler(
    sessionId: string,
    nationId: number,
    currentRulerId: number,
    newRulerId: number
  ): Promise<AppointOfficerResult> {
    try {
      // 현재 군주 확인
      const currentRuler = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: currentRulerId
      });

      if (!currentRuler) {
        return { result: false, message: '현재 군주를 찾을 수 없습니다.' };
      }

      if ((currentRuler.data?.officer_level || 0) !== OfficerLevel.RULER) {
        return { result: false, message: '군주가 아닙니다.' };
      }

      if (currentRuler.data?.nation !== nationId) {
        return { result: false, message: '같은 국가 소속이 아닙니다.' };
      }

      // 새 군주 확인
      const newRuler = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: newRulerId
      });

      if (!newRuler) {
        return { result: false, message: '새 군주를 찾을 수 없습니다.' };
      }

      if (newRuler.data?.nation !== nationId) {
        return { result: false, message: '같은 국가 소속이 아닙니다.' };
      }

      // 현재 군주 승상으로 강등
      await generalRepository.updateBySessionAndNo(sessionId, currentRulerId, {
        'data.officer_level': OfficerLevel.PRIME_MINISTER,
        'data.officer_city': 0,
        officer_level: OfficerLevel.PRIME_MINISTER
      });

      // 새 군주 임명
      await generalRepository.updateBySessionAndNo(sessionId, newRulerId, {
        'data.officer_level': OfficerLevel.RULER,
        'data.officer_city': 0,
        officer_level: OfficerLevel.RULER
      });

      // 국가 leader 업데이트
      await nationRepository.updateByNationNum(sessionId, nationId, {
        'data.leader': newRulerId,
        leader: newRulerId
      });

      return { result: true };
    } catch (error: any) {
      console.error('[OfficerSystemService] abdicateRuler error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 다음 군주 선출 (현재 군주 사망/탈퇴 시)
   * PHP nextRuler() 대응
   */
  static async selectNextRuler(sessionId: string, nationId: number): Promise<{
    result: boolean;
    newRulerId?: number;
    message?: string;
  }> {
    try {
      // 수뇌부 우선순위로 다음 군주 선출
      // 승상(11) -> 제1장군(10) -> 제1모사(9) -> ... -> 일반(1)
      const candidates = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $lt: 12, $gte: 1 }
      });

      if (!candidates || candidates.length === 0) {
        // 국가 멸망 처리 필요
        return { result: false, message: '후계자가 없습니다.' };
      }

      // 관직 레벨 순으로 정렬, 동일 레벨은 NPC가 아닌 유저 우선
      candidates.sort((a, b) => {
        const levelDiff = (b.data?.officer_level || 0) - (a.data?.officer_level || 0);
        if (levelDiff !== 0) return levelDiff;
        
        // NPC 타입: 0=유저, 1=일반NPC, 2+=특수NPC
        const npcDiff = (a.data?.npc || 0) - (b.data?.npc || 0);
        return npcDiff;
      });

      const newRuler = candidates[0];
      const newRulerId = newRuler.no;

      // 새 군주 임명
      await generalRepository.updateBySessionAndNo(sessionId, newRulerId, {
        'data.officer_level': OfficerLevel.RULER,
        'data.officer_city': 0,
        officer_level: OfficerLevel.RULER
      });

      // 국가 leader 업데이트
      await nationRepository.updateByNationNum(sessionId, nationId, {
        'data.leader': newRulerId,
        leader: newRulerId
      });

      return {
        result: true,
        newRulerId
      };
    } catch (error: any) {
      console.error('[OfficerSystemService] selectNextRuler error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 국가의 관직자 목록 조회
   */
  static async getOfficerList(
    sessionId: string,
    nationId: number
  ): Promise<GetOfficerListResult> {
    try {
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $gte: 2 }
      });

      const officers: OfficerInfo[] = generals.map(g => ({
        generalId: g.no,
        name: g.data?.name || g.name || '무명',
        officerLevel: g.data?.officer_level || 1,
        officerCity: g.data?.officer_city || 0,
        strength: g.data?.strength || 0,
        intel: g.data?.intel || 0,
        leadership: g.data?.leadership || 0,
        npc: g.data?.npc || 0
      }));

      // 관직 레벨 순으로 정렬
      officers.sort((a, b) => b.officerLevel - a.officerLevel);

      return { result: true, officers };
    } catch (error: any) {
      console.error('[OfficerSystemService] getOfficerList error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 관직 정보 조회
   */
  static async getOfficerInfo(
    sessionId: string,
    generalId: number
  ): Promise<{
    result: boolean;
    officer?: OfficerInfo;
    title?: string;
    bonus?: number;
    message?: string;
  }> {
    try {
      const general = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: generalId
      });

      if (!general) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const generalData = general.data || {};
      const nationId = generalData.nation || 0;

      // 국가 레벨 조회
      let nationLevel = 0;
      if (nationId > 0) {
        const nation = await nationRepository.findOneByFilter({
          session_id: sessionId,
          'data.nation': nationId
        });
        nationLevel = nation?.data?.level || nation?.level || 0;
      }

      const officerLevel = generalData.officer_level || 0;
      const title = getOfficerTitle(officerLevel, nationLevel);
      const bonus = calcLeadershipBonus(officerLevel, nationLevel);

      const officer: OfficerInfo = {
        generalId: general.no,
        name: generalData.name || general.name || '무명',
        officerLevel,
        officerCity: generalData.officer_city || 0,
        strength: generalData.strength || 0,
        intel: generalData.intel || 0,
        leadership: generalData.leadership || 0,
        npc: generalData.npc || 0
      };

      return {
        result: true,
        officer,
        title,
        bonus
      };
    } catch (error: any) {
      console.error('[OfficerSystemService] getOfficerInfo error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 관직 잠금 해제 (턴 시작 시 리셋)
   */
  static async resetChiefSet(sessionId: string, nationId: number): Promise<{
    result: boolean;
    message?: string;
  }> {
    try {
      await nationRepository.updateByNationNum(sessionId, nationId, {
        'data.chief_set': 0,
        chief_set: 0
      });

      return { result: true };
    } catch (error: any) {
      console.error('[OfficerSystemService] resetChiefSet error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 도시 관직 잠금 해제
   */
  static async resetCityOfficerSet(sessionId: string, cityId: number): Promise<{
    result: boolean;
    message?: string;
  }> {
    try {
      await cityRepository.updateByCityNum(sessionId, cityId, {
        'data.officer_set': 0,
        officer_set: 0
      });

      return { result: true };
    } catch (error: any) {
      console.error('[OfficerSystemService] resetCityOfficerSet error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 게임 설정에서 수뇌 최소 능력치 조회
   */
  private static async getChiefStatMin(sessionId: string): Promise<number> {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      return session?.data?.chiefStatMin || CHIEF_STAT_MIN;
    } catch {
      return CHIEF_STAT_MIN;
    }
  }
}

