/**
 * NobilityService
 * 작위 및 봉토 시스템 서비스
 * 은하제국 전용 귀족 시스템 관리
 */

import { LoghCommander, ILoghCommander } from '../../models/logh/Commander.model';
import { Planet } from '../../models/logh/Planet.model';
import {
  NobilityRank,
  CharacterNobility,
  Fief,
  NOBILITY_RANKS,
  NOBILITY_RANK_ORDER,
  canPromoteNobility,
  canGrantFief,
  EnnobleResult,
  GrantFiefResult,
} from '../../types/gin7/nobility.types';

export class NobilityService {
  /**
   * 서작 (작위 수여)
   * 황제 전용 커맨드
   */
  async ennoble(
    sessionId: string,
    granterNo: number,
    targetNo: number,
    newRank: NobilityRank
  ): Promise<EnnobleResult> {
    // 수여자 확인 (황제 권한 체크)
    const granter = await LoghCommander.findOne({
      session_id: sessionId,
      no: granterNo,
    });

    if (!granter) {
      return { success: false, message: '수여자를 찾을 수 없습니다.' };
    }

    // 제국 소속 체크
    if (granter.faction !== 'empire') {
      return { success: false, message: '작위는 제국에서만 수여할 수 있습니다.' };
    }

    // 황제 권한 체크 (jobPosition 또는 authorityCards 확인)
    const hasEmperorAuthority = 
      granter.jobPosition === '황제' ||
      granter.authorityCards.includes('EMPEROR') ||
      granter.authorityCards.includes('PEERAGE_GRANT');

    if (!hasEmperorAuthority) {
      return { success: false, message: '작위를 수여할 권한이 없습니다. (황제 전용)' };
    }

    // 대상자 확인
    const target = await LoghCommander.findOne({
      session_id: sessionId,
      no: targetNo,
    });

    if (!target) {
      return { success: false, message: '대상자를 찾을 수 없습니다.' };
    }

    // 제국 소속 체크
    if (target.faction !== 'empire') {
      return { success: false, message: '작위는 제국 소속 인물에게만 수여할 수 있습니다.' };
    }

    // 현재 작위 확인
    const currentRank = target.nobility?.rank || null;

    // 승작 가능 여부 체크
    const { canPromote, reason } = canPromoteNobility(currentRank, newRank, target.merit);

    if (!canPromote) {
      return { success: false, message: reason || '승작할 수 없습니다.' };
    }

    // 작위 수여
    const now = new Date();
    const previousRank = currentRank;

    if (!target.nobility) {
      target.nobility = {
        rank: newRank,
        fiefs: [],
        ennobbledAt: now,
        lastPromotedAt: now,
        totalTaxIncome: 0,
      };
    } else {
      target.nobility.rank = newRank;
      target.nobility.lastPromotedAt = now;
      if (!target.nobility.ennobbledAt) {
        target.nobility.ennobbledAt = now;
      }
    }

    target.markModified('nobility');
    await target.save();

    const rankInfo = NOBILITY_RANKS[newRank];

    return {
      success: true,
      message: `${target.name}에게 ${rankInfo.name} 작위를 수여했습니다.`,
      previousRank,
      newRank,
    };
  }

  /**
   * 봉토 수여
   * 남작 이상 작위 보유자에게 봉토 수여
   */
  async grantFief(
    sessionId: string,
    granterNo: number,
    targetNo: number,
    planetId: string
  ): Promise<GrantFiefResult> {
    // 수여자 확인
    const granter = await LoghCommander.findOne({
      session_id: sessionId,
      no: granterNo,
    });

    if (!granter) {
      return { success: false, message: '수여자를 찾을 수 없습니다.' };
    }

    // 제국 소속 체크
    if (granter.faction !== 'empire') {
      return { success: false, message: '봉토는 제국에서만 수여할 수 있습니다.' };
    }

    // 황제 권한 체크
    const hasEmperorAuthority = 
      granter.jobPosition === '황제' ||
      granter.authorityCards.includes('EMPEROR') ||
      granter.authorityCards.includes('FIEF_GRANT');

    if (!hasEmperorAuthority) {
      return { success: false, message: '봉토를 수여할 권한이 없습니다. (황제 전용)' };
    }

    // 대상자 확인
    const target = await LoghCommander.findOne({
      session_id: sessionId,
      no: targetNo,
    });

    if (!target) {
      return { success: false, message: '대상자를 찾을 수 없습니다.' };
    }

    // 봉토 수여 가능 여부 체크
    const { canGrant, reason } = canGrantFief(target.nobility);

    if (!canGrant) {
      return { success: false, message: reason || '봉토를 수여할 수 없습니다.' };
    }

    // 행성 확인
    const planet = await Planet.findOne({
      session_id: sessionId,
      planetId: planetId,
    });

    if (!planet) {
      return { success: false, message: '해당 행성을 찾을 수 없습니다.' };
    }

    // 이미 봉토로 지정된 행성인지 확인
    const existingFiefHolder = await LoghCommander.findOne({
      session_id: sessionId,
      'nobility.fiefs.planetId': planetId,
    });

    if (existingFiefHolder) {
      return {
        success: false,
        message: `해당 행성은 이미 ${existingFiefHolder.name}의 봉토입니다.`,
      };
    }

    // 봉토 수여
    const rankInfo = NOBILITY_RANKS[target.nobility!.rank!];
    const annualIncome = Math.floor((planet.economy?.gdp || 10000) * rankInfo.taxRate);

    const newFief: Fief = {
      planetId: planetId,
      planetName: planet.name,
      grantedAt: new Date(),
      annualIncome,
    };

    target.nobility!.fiefs.push(newFief);
    target.markModified('nobility');
    await target.save();

    return {
      success: true,
      message: `${target.name}에게 ${planet.name}을(를) 봉토로 수여했습니다. (연간 수입: ${annualIncome})`,
      fief: newFief,
    };
  }

  /**
   * 봉토 회수
   */
  async revokeFief(
    sessionId: string,
    granterNo: number,
    targetNo: number,
    planetId: string
  ): Promise<{ success: boolean; message: string }> {
    // 수여자 확인
    const granter = await LoghCommander.findOne({
      session_id: sessionId,
      no: granterNo,
    });

    if (!granter) {
      return { success: false, message: '회수자를 찾을 수 없습니다.' };
    }

    // 황제 권한 체크
    const hasEmperorAuthority = 
      granter.jobPosition === '황제' ||
      granter.authorityCards.includes('EMPEROR') ||
      granter.authorityCards.includes('FIEF_REVOKE');

    if (!hasEmperorAuthority) {
      return { success: false, message: '봉토를 회수할 권한이 없습니다. (황제 전용)' };
    }

    // 대상자 확인
    const target = await LoghCommander.findOne({
      session_id: sessionId,
      no: targetNo,
    });

    if (!target || !target.nobility) {
      return { success: false, message: '대상자를 찾을 수 없습니다.' };
    }

    // 봉토 확인
    const fiefIndex = target.nobility.fiefs.findIndex(f => f.planetId === planetId);

    if (fiefIndex === -1) {
      return { success: false, message: '해당 봉토를 보유하고 있지 않습니다.' };
    }

    const revokedFief = target.nobility.fiefs[fiefIndex];
    target.nobility.fiefs.splice(fiefIndex, 1);
    target.markModified('nobility');
    await target.save();

    return {
      success: true,
      message: `${target.name}의 봉토 ${revokedFief.planetName}을(를) 회수했습니다.`,
    };
  }

  /**
   * 작위 박탈
   */
  async stripNobility(
    sessionId: string,
    granterNo: number,
    targetNo: number
  ): Promise<{ success: boolean; message: string }> {
    // 수여자 확인
    const granter = await LoghCommander.findOne({
      session_id: sessionId,
      no: granterNo,
    });

    if (!granter) {
      return { success: false, message: '박탈자를 찾을 수 없습니다.' };
    }

    // 황제 권한 체크
    const hasEmperorAuthority = 
      granter.jobPosition === '황제' ||
      granter.authorityCards.includes('EMPEROR');

    if (!hasEmperorAuthority) {
      return { success: false, message: '작위를 박탈할 권한이 없습니다. (황제 전용)' };
    }

    // 대상자 확인
    const target = await LoghCommander.findOne({
      session_id: sessionId,
      no: targetNo,
    });

    if (!target || !target.nobility || !target.nobility.rank) {
      return { success: false, message: '대상자가 작위를 보유하고 있지 않습니다.' };
    }

    const oldRank = NOBILITY_RANKS[target.nobility.rank].name;
    
    // 작위 박탈 (봉토도 함께 회수)
    target.nobility = {
      rank: null,
      fiefs: [],
      totalTaxIncome: target.nobility.totalTaxIncome, // 누적 수입은 유지
    };

    target.markModified('nobility');
    await target.save();

    return {
      success: true,
      message: `${target.name}의 ${oldRank} 작위를 박탈했습니다. (봉토 전부 회수)`,
    };
  }

  /**
   * 봉토 세금 수입 계산 및 지급 (턴 처리용)
   */
  async processFiefIncome(sessionId: string): Promise<{ processed: number; totalIncome: number }> {
    const commanders = await LoghCommander.find({
      session_id: sessionId,
      'nobility.fiefs': { $exists: true, $not: { $size: 0 } },
    });

    let processed = 0;
    let totalIncome = 0;

    for (const commander of commanders) {
      if (!commander.nobility?.fiefs.length) continue;

      let commanderIncome = 0;
      for (const fief of commander.nobility.fiefs) {
        commanderIncome += fief.annualIncome;
      }

      // 개인 자금에 추가
      const currentFunds = commander.customData?.personalFunds || 0;
      if (!commander.customData) commander.customData = {};
      commander.customData.personalFunds = currentFunds + commanderIncome;
      
      // 누적 세금 수입 업데이트
      commander.nobility.totalTaxIncome += commanderIncome;

      commander.markModified('customData');
      commander.markModified('nobility');
      await commander.save();

      processed++;
      totalIncome += commanderIncome;
    }

    return { processed, totalIncome };
  }

  /**
   * 작위 정보 조회
   */
  async getNobilityInfo(sessionId: string, commanderNo: number): Promise<{
    success: boolean;
    nobility?: CharacterNobility | null;
    rankInfo?: typeof NOBILITY_RANKS[NobilityRank];
  }> {
    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo,
    });

    if (!commander) {
      return { success: false };
    }

    return {
      success: true,
      nobility: commander.nobility,
      rankInfo: commander.nobility?.rank ? NOBILITY_RANKS[commander.nobility.rank] : undefined,
    };
  }
}

// 싱글톤 인스턴스
export const nobilityService = new NobilityService();







