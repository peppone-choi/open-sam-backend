/**
 * SuccessionService
 * 유산 상속 및 Karma(업보) 시스템 서비스
 * 
 * 은퇴/사망 시 포인트 환산 및 유산 상속 처리
 * 차기 캐릭터에 일부 능력치 계승 (Karma)
 */

import { LoghCommander, ILoghCommander } from '../../models/logh/Commander.model';
import {
  LegacyInheritance,
  KarmaBonus,
  KarmaGrade,
  calculateKarmaGrade,
  calculateKarmaPoints,
  KARMA_GRADE_THRESHOLDS,
  CharacterNobility,
} from '../../types/gin7/nobility.types';

/** 유산 상속 비율 */
const INHERITANCE_RATES = {
  wealth: 0.3,      // 재산의 30% 상속
  fame: 0.1,        // 명성의 10% 상속
  merit: 0.05,      // 공적의 5%가 Karma로 전환
};

export interface SuccessionResult {
  success: boolean;
  message: string;
  karmaGrade?: KarmaGrade;
  karmaPoints?: number;
  inheritance?: LegacyInheritance;
  karmaBonus?: KarmaBonus;
}

export interface CharacterDeathInfo {
  commanderNo: number;
  deathType: 'natural' | 'combat' | 'executed' | 'assassination' | 'retirement';
  finalFame: number;
  finalMerit: number;
  finalWealth: number;
  nobility?: CharacterNobility | null;
}

export class SuccessionService {
  /**
   * 캐릭터 사망/은퇴 처리 및 유산 계산
   */
  async processCharacterDeath(
    sessionId: string,
    deathInfo: CharacterDeathInfo
  ): Promise<SuccessionResult> {
    const { commanderNo, deathType, finalFame, finalMerit, finalWealth, nobility } = deathInfo;

    // 기존 캐릭터 조회
    const deadCommander = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo,
    });

    if (!deadCommander) {
      return { success: false, message: '캐릭터를 찾을 수 없습니다.' };
    }

    // Karma 포인트 계산
    const karmaPoints = calculateKarmaPoints(
      finalFame || deadCommander.fame,
      finalMerit || deadCommander.merit,
      nobility || deadCommander.nobility
    );

    // Karma 등급 결정
    const karmaGrade = calculateKarmaGrade(karmaPoints);
    const karmaBonus = KARMA_GRADE_THRESHOLDS[karmaGrade].bonus;

    // 유산 상속 정보 생성
    const totalWealth = finalWealth || (deadCommander.customData?.personalFunds || 0);
    const inheritance: LegacyInheritance = {
      previousCharacterId: deadCommander._id?.toString() || `${sessionId}-${commanderNo}`,
      previousCharacterName: deadCommander.name,
      inheritedWealth: Math.floor(totalWealth * INHERITANCE_RATES.wealth),
      inheritedFame: Math.floor((finalFame || deadCommander.fame) * INHERITANCE_RATES.fame),
      karma: karmaPoints,
      inheritedAt: new Date(),
    };

    // 캐릭터 상태 업데이트 (사망 처리)
    deadCommander.isActive = false;
    deadCommander.status = deathType === 'executed' ? 'executed' : 'active';
    
    if (!deadCommander.customData) deadCommander.customData = {};
    deadCommander.customData.deathInfo = {
      deathType,
      deathDate: new Date(),
      finalStats: {
        fame: deadCommander.fame,
        merit: deadCommander.merit,
        wealth: totalWealth,
      },
      karmaPoints,
      karmaGrade,
      inheritanceCalculated: inheritance,
    };

    deadCommander.markModified('customData');
    await deadCommander.save();

    return {
      success: true,
      message: `${deadCommander.name}의 유산이 계산되었습니다. Karma 등급: ${karmaGrade} (${karmaPoints} 포인트)`,
      karmaGrade,
      karmaPoints,
      inheritance,
      karmaBonus,
    };
  }

  /**
   * 후계 캐릭터에게 유산 적용
   */
  async applyInheritance(
    sessionId: string,
    newCommanderNo: number,
    inheritance: LegacyInheritance
  ): Promise<{ success: boolean; message: string; appliedBonuses?: any }> {
    const newCommander = await LoghCommander.findOne({
      session_id: sessionId,
      no: newCommanderNo,
    });

    if (!newCommander) {
      return { success: false, message: '후계 캐릭터를 찾을 수 없습니다.' };
    }

    // Karma 등급 및 보너스 계산
    const karmaGrade = calculateKarmaGrade(inheritance.karma);
    const karmaBonus = KARMA_GRADE_THRESHOLDS[karmaGrade].bonus;

    // 재산 상속
    if (!newCommander.customData) newCommander.customData = {};
    const currentFunds = newCommander.customData.personalFunds || 0;
    newCommander.customData.personalFunds = currentFunds + inheritance.inheritedWealth + karmaBonus.startingWealth;

    // 명성 상속
    newCommander.fame += inheritance.inheritedFame + karmaBonus.reputationBonus;

    // 스탯 보너스 적용
    for (const [stat, bonus] of Object.entries(karmaBonus.statBonuses)) {
      if (stat in newCommander.stats) {
        (newCommander.stats as any)[stat] += bonus;
      }
    }

    // 유산 정보 저장
    newCommander.legacy = inheritance;

    // 적용된 보너스 기록
    if (!newCommander.customData.appliedKarmaBonus) {
      newCommander.customData.appliedKarmaBonus = karmaBonus;
      newCommander.customData.appliedKarmaGrade = karmaGrade;
    }

    newCommander.markModified('stats');
    newCommander.markModified('customData');
    newCommander.markModified('legacy');
    await newCommander.save();

    return {
      success: true,
      message: `${newCommander.name}에게 유산이 적용되었습니다. (Karma 등급: ${karmaGrade})`,
      appliedBonuses: {
        wealth: inheritance.inheritedWealth + karmaBonus.startingWealth,
        fame: inheritance.inheritedFame + karmaBonus.reputationBonus,
        statBonuses: karmaBonus.statBonuses,
        traitUnlocks: karmaBonus.traitUnlocks,
      },
    };
  }

  /**
   * 캐릭터 은퇴 처리 (완전 은퇴, 다음 캐릭터로 전환)
   * Retirement 커맨드와 다름 - 이것은 완전히 게임에서 물러남
   */
  async processFullRetirement(
    sessionId: string,
    commanderNo: number,
    successorNo?: number
  ): Promise<SuccessionResult> {
    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo,
    });

    if (!commander) {
      return { success: false, message: '캐릭터를 찾을 수 없습니다.' };
    }

    // 사망/은퇴 처리
    const deathInfo: CharacterDeathInfo = {
      commanderNo,
      deathType: 'retirement',
      finalFame: commander.fame,
      finalMerit: commander.merit,
      finalWealth: commander.customData?.personalFunds || 0,
      nobility: commander.nobility,
    };

    const result = await this.processCharacterDeath(sessionId, deathInfo);

    if (!result.success) {
      return result;
    }

    // 후계자가 지정된 경우 유산 적용
    if (successorNo && result.inheritance) {
      const inheritanceResult = await this.applyInheritance(
        sessionId,
        successorNo,
        result.inheritance
      );

      if (!inheritanceResult.success) {
        return {
          ...result,
          message: `${result.message}\n유산 적용 실패: ${inheritanceResult.message}`,
        };
      }

      return {
        ...result,
        message: `${result.message}\n후계자에게 유산이 적용되었습니다.`,
      };
    }

    return result;
  }

  /**
   * 사용자의 대기 중인 유산 조회
   */
  async getPendingInheritance(
    sessionId: string,
    ownerUserId: string
  ): Promise<{
    hasPendingInheritance: boolean;
    inheritances: Array<{
      previousCharacterName: string;
      karmaGrade: KarmaGrade;
      karmaPoints: number;
      inheritance: LegacyInheritance;
      karmaBonus: KarmaBonus;
    }>;
  }> {
    // 해당 사용자의 사망/은퇴한 캐릭터 조회
    const deadCommanders = await LoghCommander.find({
      session_id: sessionId,
      ownerUserId,
      isActive: false,
      'customData.deathInfo': { $exists: true },
      'customData.deathInfo.inheritanceClaimed': { $ne: true },
    });

    const inheritances = deadCommanders.map(commander => {
      const deathInfo = commander.customData?.deathInfo;
      return {
        previousCharacterName: commander.name,
        karmaGrade: deathInfo?.karmaGrade as KarmaGrade,
        karmaPoints: deathInfo?.karmaPoints || 0,
        inheritance: deathInfo?.inheritanceCalculated as LegacyInheritance,
        karmaBonus: KARMA_GRADE_THRESHOLDS[deathInfo?.karmaGrade as KarmaGrade || 'F'].bonus,
      };
    });

    return {
      hasPendingInheritance: inheritances.length > 0,
      inheritances,
    };
  }

  /**
   * 유산 수령 완료 표시
   */
  async markInheritanceClaimed(
    sessionId: string,
    previousCommanderNo: number
  ): Promise<{ success: boolean; message: string }> {
    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      no: previousCommanderNo,
    });

    if (!commander) {
      return { success: false, message: '캐릭터를 찾을 수 없습니다.' };
    }

    if (!commander.customData?.deathInfo) {
      return { success: false, message: '유산 정보가 없습니다.' };
    }

    commander.customData.deathInfo.inheritanceClaimed = true;
    commander.customData.deathInfo.inheritanceClaimedAt = new Date();
    commander.markModified('customData');
    await commander.save();

    return { success: true, message: '유산 수령이 완료되었습니다.' };
  }

  /**
   * Karma 등급별 보너스 정보 조회
   */
  static getKarmaGradeInfo(grade: KarmaGrade): {
    grade: KarmaGrade;
    minPoints: number;
    bonus: KarmaBonus;
  } {
    return {
      grade,
      ...KARMA_GRADE_THRESHOLDS[grade],
    };
  }

  /**
   * 모든 Karma 등급 정보 조회
   */
  static getAllKarmaGrades(): Array<{
    grade: KarmaGrade;
    minPoints: number;
    bonus: KarmaBonus;
  }> {
    const grades: KarmaGrade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];
    return grades.map(grade => ({
      grade,
      ...KARMA_GRADE_THRESHOLDS[grade],
    }));
  }
}

// 싱글톤 인스턴스
export const successionService = new SuccessionService();












