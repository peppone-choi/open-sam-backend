/**
 * PersonalCommandService - 개인 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 개인 커맨드:
 * - RETIRE (퇴역): 군인 → 정치가
 * - ENLIST (지원): 정치가 → 군인
 * - DEFECT (망명): 타 세력 망명
 * - MEET (회견): 같은 스팟 인물과 회견
 * - STUDY (수강): 사관학교에서 능력치 상승
 * - WAR_GAME (병기연습): 시뮬레이터 훈련
 * - REBEL_INTENT (반의): 쿠데타 수괴 등록
 * - CONSPIRACY (모의): 쿠데타 참가 교섭
 * - PERSUADE (설득): 부대 반란 충성도 상승
 * - UPRISING (반란): 쿠데타 실행
 * - JOIN_COUP (참가): 쿠데타 참가
 * - INVEST_FUNDS (자금투입): 개인 자금 투입
 * - BUY_FLAGSHIP (기함구입): 기함 구매
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { ClassConversionService, classConversionService, CharacterClass } from './ClassConversionService';
import { CoupService, coupService } from './CoupService';
import { StatsGrowthService } from './StatsGrowthService';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface PersonalRequest {
  sessionId: string;
  characterId: string;     // 실행자 (본인)
  targetId?: string;       // 대상 캐릭터
  commandId: string;
  params?: Record<string, any>;
}

export interface PersonalResult {
  success: boolean;
  commandId: string;
  outcome?: string;
  cpCost: number;
  error?: string;
}

// ============================================================
// PersonalCommandService Class
// ============================================================

export class PersonalCommandService extends EventEmitter {
  private static instance: PersonalCommandService;

  private constructor() {
    super();
    logger.info('[PersonalCommandService] Initialized');
  }

  public static getInstance(): PersonalCommandService {
    if (!PersonalCommandService.instance) {
      PersonalCommandService.instance = new PersonalCommandService();
    }
    return PersonalCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 개인 커맨드 라우터
   */
  public async executePersonalCommand(request: PersonalRequest): Promise<PersonalResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'RETIRE':
        return this.executeRetire(request);
      case 'ENLIST':
        return this.executeEnlist(request);
      case 'DEFECT':
        return this.executeDefect(request);
      case 'MEET':
        return this.executeMeet(request);
      case 'STUDY':
        return this.executeStudy(request);
      case 'WAR_GAME':
        return this.executeWarGame(request);
      case 'REBEL_INTENT':
        return this.executeRebelIntent(request);
      case 'CONSPIRACY':
        return this.executeConspiracy(request);
      case 'PERSUADE':
        return this.executePersuade(request);
      case 'UPRISING':
        return this.executeUprising(request);
      case 'JOIN_COUP':
        return this.executeJoinCoup(request);
      case 'INVEST_FUNDS':
        return this.executeInvestFunds(request);
      case 'BUY_FLAGSHIP':
        return this.executeBuyFlagship(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 개인 커맨드입니다.');
    }
  }

  // ============================================================
  // 신분 변경
  // ============================================================

  /**
   * 퇴역 - 군인 → 정치가
   */
  private async executeRetire(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId } = request;
    const cpCost = this.getCommandCost('RETIRE');

    try {
      const result = await classConversionService.convertClass({
        sessionId,
        characterId,
        targetClass: CharacterClass.POLITICIAN,
        requestedBy: characterId,
      });

      if (!result.success) {
        return this.errorResult('RETIRE', cpCost, result.error || '퇴역 실패');
      }

      this.emit('personal:retired', {
        sessionId,
        characterId,
        previousRank: result.previousRank,
        newRank: result.newRank,
      });

      return {
        success: true,
        commandId: 'RETIRE',
        outcome: `퇴역 완료: ${result.previousRank} → ${result.newRank}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Retire error:', error);
      return this.errorResult('RETIRE', cpCost, '퇴역 처리 중 오류 발생');
    }
  }

  /**
   * 지원 - 정치가 → 군인
   */
  private async executeEnlist(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId } = request;
    const cpCost = this.getCommandCost('ENLIST');

    try {
      const result = await classConversionService.convertClass({
        sessionId,
        characterId,
        targetClass: CharacterClass.MILITARY,
        requestedBy: characterId,
      });

      if (!result.success) {
        return this.errorResult('ENLIST', cpCost, result.error || '지원 실패');
      }

      this.emit('personal:enlisted', {
        sessionId,
        characterId,
        previousRank: result.previousRank,
        newRank: result.newRank,
      });

      return {
        success: true,
        commandId: 'ENLIST',
        outcome: `입대 완료: ${result.previousRank} → ${result.newRank}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Enlist error:', error);
      return this.errorResult('ENLIST', cpCost, '지원 처리 중 오류 발생');
    }
  }

  /**
   * 망명 - 타 세력으로 망명
   */
  private async executeDefect(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('DEFECT');

    const targetFactionId = params?.targetFactionId;
    if (!targetFactionId) {
      return this.errorResult('DEFECT', cpCost, '망명할 세력이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('DEFECT', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      const previousFaction = character.factionId;

      // 세력 변경 및 구금 상태
      character.factionId = targetFactionId;
      character.status = 'DETAINED';
      character.data = character.data || {};
      character.data.defectedFrom = previousFaction;
      character.data.defectedAt = new Date();
      
      // 직위/직책 제거
      character.commandCards = [];
      
      await character.save();

      this.emit('personal:defected', {
        sessionId,
        characterId,
        characterName: character.name,
        previousFaction,
        newFaction: targetFactionId,
      });

      return {
        success: true,
        commandId: 'DEFECT',
        outcome: `${character.name}이(가) ${targetFactionId}로 망명했습니다. (구금 상태)`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Defect error:', error);
      return this.errorResult('DEFECT', cpCost, '망명 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 사교/훈련
  // ============================================================

  /**
   * 회견 - 같은 스팟 인물과 만남
   */
  private async executeMeet(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, targetId } = request;
    const cpCost = this.getCommandCost('MEET');

    if (!targetId) {
      return this.errorResult('MEET', cpCost, '회견 대상이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!character || !target) {
        return this.errorResult('MEET', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 우호도 상승
      const charmBonus = (character.stats?.charm || 50) / 100;
      const friendshipGain = Math.floor(5 * (1 + charmBonus));

      // TODO: 우호도 시스템 구현 시 반영

      this.emit('personal:met', {
        sessionId,
        characterId,
        characterName: character.name,
        targetId,
        targetName: target.name,
        friendshipGain,
      });

      return {
        success: true,
        commandId: 'MEET',
        outcome: `${target.name}과(와) 회견했습니다. 우호도 +${friendshipGain}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Meet error:', error);
      return this.errorResult('MEET', cpCost, '회견 처리 중 오류 발생');
    }
  }

  /**
   * 수강 - 사관학교에서 능력치 상승
   */
  private async executeStudy(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('STUDY');

    const statToImprove = params?.stat || 'command';

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('STUDY', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 스탯 상승 (1-3 랜덤)
      const gain = Math.floor(Math.random() * 3) + 1;
      
      if (!character.stats) {
        character.stats = { command: 50, might: 50, intellect: 50, politics: 50, charm: 50 };
      }
      
      const oldValue = (character.stats as any)[statToImprove] || 50;
      const newValue = Math.min(100, oldValue + gain);
      (character.stats as any)[statToImprove] = newValue;
      await character.save();

      this.emit('personal:studied', {
        sessionId,
        characterId,
        characterName: character.name,
        stat: statToImprove,
        gain,
        newValue,
      });

      return {
        success: true,
        commandId: 'STUDY',
        outcome: `${statToImprove} 능력치가 ${gain} 상승했습니다. (${oldValue} → ${newValue})`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Study error:', error);
      return this.errorResult('STUDY', cpCost, '수강 처리 중 오류 발생');
    }
  }

  /**
   * 병기연습 - 시뮬레이터 훈련
   */
  private async executeWarGame(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId } = request;
    const cpCost = this.getCommandCost('WAR_GAME');

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('WAR_GAME', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 경험치 획득 (StatsGrowthService 연동)
      // 지휘/공격/방어 경험치 상승
      const expGain = 10;

      this.emit('personal:warGame', {
        sessionId,
        characterId,
        characterName: character.name,
        expGain,
      });

      return {
        success: true,
        commandId: 'WAR_GAME',
        outcome: `병기연습을 완료했습니다. 전투 경험치 +${expGain}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] War game error:', error);
      return this.errorResult('WAR_GAME', cpCost, '병기연습 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 쿠데타 관련
  // ============================================================

  /**
   * 반의 - 쿠데타 수괴 등록
   */
  private async executeRebelIntent(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId } = request;
    const cpCost = this.getCommandCost('REBEL_INTENT');

    try {
      const result = await coupService.initiateCoup(sessionId, characterId, 'MILITARY');

      if (!result.success) {
        return this.errorResult('REBEL_INTENT', cpCost, result.error || '반의 실패');
      }

      this.emit('personal:rebelIntent', {
        sessionId,
        characterId,
        coupId: result.coupId,
      });

      return {
        success: true,
        commandId: 'REBEL_INTENT',
        outcome: '쿠데타 계획을 시작했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Rebel intent error:', error);
      return this.errorResult('REBEL_INTENT', cpCost, '반의 처리 중 오류 발생');
    }
  }

  /**
   * 모의 - 쿠데타 참가 교섭
   */
  private async executeConspiracy(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, targetId, params } = request;
    const cpCost = this.getCommandCost('CONSPIRACY');

    if (!targetId) {
      return this.errorResult('CONSPIRACY', cpCost, '교섭 대상이 필요합니다.');
    }

    const coupId = params?.coupId;
    if (!coupId) {
      return this.errorResult('CONSPIRACY', cpCost, '쿠데타 ID가 필요합니다.');
    }

    try {
      const result = await coupService.attemptPersuasion(coupId, characterId, targetId);

      this.emit('personal:conspiracy', {
        sessionId,
        characterId,
        targetId,
        coupId,
        success: result.success,
      });

      return {
        success: result.success,
        commandId: 'CONSPIRACY',
        outcome: result.success ? '교섭에 성공했습니다.' : '교섭에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Conspiracy error:', error);
      return this.errorResult('CONSPIRACY', cpCost, '모의 처리 중 오류 발생');
    }
  }

  /**
   * 설득 - 부대 반란 충성도 상승
   */
  private async executePersuade(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('PERSUADE');

    const fleetId = params?.fleetId;
    const coupId = params?.coupId;

    if (!fleetId || !coupId) {
      return this.errorResult('PERSUADE', cpCost, '부대 ID와 쿠데타 ID가 필요합니다.');
    }

    try {
      const result = await coupService.persuadeUnits(sessionId, characterId);

      this.emit('personal:persuade', {
        sessionId,
        characterId,
        fleetId,
        coupId,
        success: result.success,
      });

      return {
        success: result.success,
        commandId: 'PERSUADE',
        outcome: result.success ? '설득에 성공했습니다.' : '설득에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Persuade error:', error);
      return this.errorResult('PERSUADE', cpCost, '설득 처리 중 오류 발생');
    }
  }

  /**
   * 반란 - 쿠데타 실행
   */
  private async executeUprising(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('UPRISING');

    const coupId = params?.coupId;
    if (!coupId) {
      return this.errorResult('UPRISING', cpCost, '쿠데타 ID가 필요합니다.');
    }

    try {
      const result = await coupService.executeCoup(coupId, characterId);

      this.emit('personal:uprising', {
        sessionId,
        characterId,
        coupId,
        success: result.success,
      });

      return {
        success: result.success,
        commandId: 'UPRISING',
        outcome: result.success ? '반란을 일으켰습니다!' : '반란 실행에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Uprising error:', error);
      return this.errorResult('UPRISING', cpCost, '반란 처리 중 오류 발생');
    }
  }

  /**
   * 참가 - 쿠데타 참가
   */
  private async executeJoinCoup(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('JOIN_COUP');

    const coupId = params?.coupId;
    if (!coupId) {
      return this.errorResult('JOIN_COUP', cpCost, '쿠데타 ID가 필요합니다.');
    }

    try {
      const result = await coupService.joinCoup(sessionId, characterId, { coupId });

      this.emit('personal:joinCoup', {
        sessionId,
        characterId,
        coupId,
        success: result.success,
      });

      return {
        success: result.success,
        commandId: 'JOIN_COUP',
        outcome: result.success ? '쿠데타에 참가했습니다.' : '참가에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Join coup error:', error);
      return this.errorResult('JOIN_COUP', cpCost, '참가 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 재정
  // ============================================================

  /**
   * 자금투입 - 개인 자금 투입
   */
  private async executeInvestFunds(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('INVEST_FUNDS');

    const amount = params?.amount || 1000;
    const target = params?.target || 'local'; // local, trust, support

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('INVEST_FUNDS', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 자금 확인 (개인 자금 시스템 필요)
      const personalFunds = character.data?.personalFunds || 0;
      if (personalFunds < amount) {
        return this.errorResult('INVEST_FUNDS', cpCost, '자금이 부족합니다.');
      }

      // 자금 차감 및 효과 적용
      character.data = character.data || {};
      character.data.personalFunds = personalFunds - amount;
      
      // 투자 대상에 따른 효과
      let outcome = '';
      switch (target) {
        case 'local':
          // 지방 지지도 상승
          outcome = '지방 지지율이 상승했습니다.';
          break;
        case 'trust':
          // 신임도 상승
          outcome = '신임도가 상승했습니다.';
          break;
        case 'support':
          // 지지율 상승
          outcome = '지지율이 상승했습니다.';
          break;
      }
      
      await character.save();

      this.emit('personal:investedFunds', {
        sessionId,
        characterId,
        amount,
        target,
      });

      return {
        success: true,
        commandId: 'INVEST_FUNDS',
        outcome: `${amount} 크레딧을 투입했습니다. ${outcome}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Invest funds error:', error);
      return this.errorResult('INVEST_FUNDS', cpCost, '자금투입 처리 중 오류 발생');
    }
  }

  /**
   * 기함구입 - 평가 포인트로 기함 구매
   */
  private async executeBuyFlagship(request: PersonalRequest): Promise<PersonalResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('BUY_FLAGSHIP');

    const shipType = params?.shipType || 'standard';

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('BUY_FLAGSHIP', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 평가 포인트 확인
      const evaluationPoints = character.data?.evaluationPoints || 0;
      const cost = this.getFlagshipCost(shipType);

      if (evaluationPoints < cost) {
        return this.errorResult('BUY_FLAGSHIP', cpCost, '평가 포인트가 부족합니다.');
      }

      // 기함 생성 및 포인트 차감
      character.data = character.data || {};
      character.data.evaluationPoints = evaluationPoints - cost;
      character.data.flagshipId = `FLAGSHIP-${characterId}-${Date.now()}`;
      character.data.flagshipType = shipType;
      await character.save();

      this.emit('personal:boughtFlagship', {
        sessionId,
        characterId,
        shipType,
        flagshipId: character.data.flagshipId,
      });

      return {
        success: true,
        commandId: 'BUY_FLAGSHIP',
        outcome: `${shipType} 기함을 구입했습니다.`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonalCommandService] Buy flagship error:', error);
      return this.errorResult('BUY_FLAGSHIP', cpCost, '기함구입 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 80;
  }

  private getFlagshipCost(shipType: string): number {
    const costs: Record<string, number> = {
      standard: 500,
      battleship: 1000,
      carrier: 1500,
      command: 2000,
    };
    return costs[shipType] || 500;
  }

  private errorResult(commandId: string, cpCost: number, error: string): PersonalResult {
    return {
      success: false,
      commandId,
      cpCost,
      error,
    };
  }
}

export const personalCommandService = PersonalCommandService.getInstance();
export default PersonalCommandService;





