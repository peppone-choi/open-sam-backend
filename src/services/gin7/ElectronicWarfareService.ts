/**
 * ElectronicWarfareService
 * 
 * 전자전 (Electronic Warfare) 시스템
 * 미노프스키 입자 농도 및 재밍 상태를 관리합니다.
 * 
 * @module gin7-command-delay
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';
import {
  ElectronicWarfareState,
  JammingLevel,
  JAMMING_THRESHOLDS,
  TACTICAL_CONSTANTS,
} from '../../types/gin7/tactical.types';

/**
 * 전자전 공격 파라미터
 */
interface EWAttackParams {
  battleId: string;
  attackerFactionId: string;
  targetFactionId: string;
  intensity: number;       // 공격 강도 (0-100)
  duration: number;        // 지속 시간 (tick)
}

/**
 * 미노프스키 입자 산포 파라미터
 */
interface MinovskySpreadParams {
  battleId: string;
  factionId: string;
  intensity: number;       // 입자 농도 증가량 (0-100)
  duration: number;        // 지속 시간 (tick)
  area?: 'LOCAL' | 'GLOBAL'; // 적용 범위
}

/**
 * 전자전 이벤트
 */
interface EWEvent {
  type: 'JAMMING_STARTED' | 'JAMMING_ENDED' | 'BLACKOUT' | 'CLEARED' | 'MINOVSKY_SPREAD';
  battleId: string;
  factionId: string;
  jammingLevel: JammingLevel;
  timestamp: number;
}

/**
 * ElectronicWarfareService
 * 
 * 전자전 상태 관리 서비스
 */
export class ElectronicWarfareService extends EventEmitter {
  // 전투별/세력별 전자전 상태: `${battleId}:${factionId}` -> state
  private states: Map<string, ElectronicWarfareState> = new Map();
  
  // 글로벌 미노프스키 농도 (전투별): battleId -> density
  private globalMinovskyDensity: Map<string, number> = new Map();

  constructor() {
    super();
    logger.info('[ElectronicWarfareService] 초기화됨');
  }

  /**
   * 상태 키 생성
   */
  private getKey(battleId: string, factionId: string): string {
    return `${battleId}:${factionId}`;
  }

  /**
   * 전자전 상태 조회
   */
  getState(battleId: string, factionId: string): ElectronicWarfareState | undefined {
    return this.states.get(this.getKey(battleId, factionId));
  }

  /**
   * 전자전 상태 초기화 (전투 시작 시)
   */
  initializeState(battleId: string, factionId: string): ElectronicWarfareState {
    const key = this.getKey(battleId, factionId);
    
    const state: ElectronicWarfareState = {
      battleId,
      factionId,
      minovskyDensity: 0,
      jammingLevel: 'CLEAR',
      isUnderEWAttack: false,
      duration: 0,
      startTick: 0,
    };

    this.states.set(key, state);
    logger.debug('[ElectronicWarfareService] 상태 초기화', { battleId, factionId });

    return state;
  }

  /**
   * 재밍 레벨 계산
   */
  private calculateJammingLevel(density: number): JammingLevel {
    if (density >= JAMMING_THRESHOLDS.BLACKOUT) {
      return 'BLACKOUT';
    } else if (density >= JAMMING_THRESHOLDS.HEAVY) {
      return 'HEAVY';
    } else if (density >= JAMMING_THRESHOLDS.INTERFERENCE) {
      return 'INTERFERENCE';
    }
    return 'CLEAR';
  }

  /**
   * 전자전 공격 실행
   */
  executeEWAttack(params: EWAttackParams): { success: boolean; message: string } {
    const { battleId, attackerFactionId, targetFactionId, intensity, duration } = params;
    const key = this.getKey(battleId, targetFactionId);

    let state = this.states.get(key);
    if (!state) {
      state = this.initializeState(battleId, targetFactionId);
    }

    // 미노프스키 농도 증가
    const newDensity = Math.min(100, state.minovskyDensity + intensity);
    const previousLevel = state.jammingLevel;
    const newLevel = this.calculateJammingLevel(newDensity);

    // 상태 업데이트
    state.minovskyDensity = newDensity;
    state.jammingLevel = newLevel;
    state.isUnderEWAttack = true;
    state.attackSourceId = attackerFactionId;
    state.duration = duration;
    state.startTick = Date.now(); // 실제로는 currentTick 사용

    this.states.set(key, state);

    // 이벤트 발생
    if (previousLevel !== newLevel) {
      this.emitEvent({
        type: newLevel === 'BLACKOUT' ? 'BLACKOUT' : 'JAMMING_STARTED',
        battleId,
        factionId: targetFactionId,
        jammingLevel: newLevel,
        timestamp: Date.now(),
      });
    }

    logger.info('[ElectronicWarfareService] 전자전 공격 실행', {
      battleId,
      attacker: attackerFactionId,
      target: targetFactionId,
      intensity,
      newDensity,
      jammingLevel: newLevel,
    });

    return {
      success: true,
      message: `전자전 공격: ${targetFactionId} 세력에 ${intensity}% 재밍 적용 (현재 레벨: ${newLevel})`,
    };
  }

  /**
   * 미노프스키 입자 산포
   */
  spreadMinovskyParticles(params: MinovskySpreadParams): { success: boolean; message: string } {
    const { battleId, factionId, intensity, duration, area = 'LOCAL' } = params;

    if (area === 'GLOBAL') {
      // 글로벌 미노프스키 농도 증가 (모든 세력에 영향)
      const current = this.globalMinovskyDensity.get(battleId) || 0;
      const newDensity = Math.min(100, current + intensity);
      this.globalMinovskyDensity.set(battleId, newDensity);

      // 모든 세력 상태 업데이트
      for (const [key, state] of this.states) {
        if (state.battleId === battleId) {
          const totalDensity = Math.min(100, state.minovskyDensity + newDensity);
          state.jammingLevel = this.calculateJammingLevel(totalDensity);
        }
      }

      this.emitEvent({
        type: 'MINOVSKY_SPREAD',
        battleId,
        factionId,
        jammingLevel: this.calculateJammingLevel(newDensity),
        timestamp: Date.now(),
      });

      logger.info('[ElectronicWarfareService] 글로벌 미노프스키 입자 산포', {
        battleId,
        factionId,
        intensity,
        newGlobalDensity: newDensity,
      });
    } else {
      // 로컬 산포 (특정 세력에만 영향 - 자신 제외)
      for (const [key, state] of this.states) {
        if (state.battleId === battleId && state.factionId !== factionId) {
          const newDensity = Math.min(100, state.minovskyDensity + intensity);
          state.minovskyDensity = newDensity;
          state.jammingLevel = this.calculateJammingLevel(newDensity);
          state.duration = duration;
        }
      }
    }

    return {
      success: true,
      message: `미노프스키 입자 산포 완료 (강도: ${intensity}%, 범위: ${area})`,
    };
  }

  /**
   * 매 틱마다 호출하여 상태 업데이트
   */
  processTick(battleId: string, currentTick: number): void {
    // 글로벌 미노프스키 입자 자연 감소
    const globalDensity = this.globalMinovskyDensity.get(battleId) || 0;
    if (globalDensity > 0) {
      const decayRate = 0.5; // 틱당 0.5% 감소
      this.globalMinovskyDensity.set(battleId, Math.max(0, globalDensity - decayRate));
    }

    // 각 세력별 상태 업데이트
    for (const [key, state] of this.states) {
      if (state.battleId !== battleId) continue;

      // 미노프스키 입자 자연 감소
      if (state.minovskyDensity > 0) {
        const decayRate = state.isUnderEWAttack ? 0.2 : 0.5; // 공격 중엔 느리게 감소
        state.minovskyDensity = Math.max(0, state.minovskyDensity - decayRate);
      }

      // 전자전 공격 지속 시간 확인
      if (state.isUnderEWAttack && state.duration > 0) {
        state.duration--;
        if (state.duration <= 0) {
          state.isUnderEWAttack = false;
          state.attackSourceId = undefined;
        }
      }

      // 재밍 레벨 재계산
      const globalEffect = this.globalMinovskyDensity.get(battleId) || 0;
      const totalDensity = Math.min(100, state.minovskyDensity + globalEffect);
      const previousLevel = state.jammingLevel;
      state.jammingLevel = this.calculateJammingLevel(totalDensity);

      // 상태 변경 이벤트
      if (previousLevel !== state.jammingLevel) {
        this.emitEvent({
          type: state.jammingLevel === 'CLEAR' ? 'CLEARED' : 
                state.jammingLevel === 'BLACKOUT' ? 'BLACKOUT' : 'JAMMING_STARTED',
          battleId,
          factionId: state.factionId,
          jammingLevel: state.jammingLevel,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * 재밍 상태 즉시 해제 (대응 조치)
   */
  clearJamming(battleId: string, factionId: string): { success: boolean; message: string } {
    const key = this.getKey(battleId, factionId);
    const state = this.states.get(key);

    if (!state) {
      return { success: false, message: '전자전 상태를 찾을 수 없습니다.' };
    }

    const previousLevel = state.jammingLevel;

    // 상태 초기화
    state.minovskyDensity = Math.max(0, state.minovskyDensity - 30); // 30% 감소
    state.isUnderEWAttack = false;
    state.attackSourceId = undefined;
    state.jammingLevel = this.calculateJammingLevel(state.minovskyDensity);

    if (previousLevel !== state.jammingLevel) {
      this.emitEvent({
        type: state.jammingLevel === 'CLEAR' ? 'CLEARED' : 'JAMMING_ENDED',
        battleId,
        factionId,
        jammingLevel: state.jammingLevel,
        timestamp: Date.now(),
      });
    }

    logger.info('[ElectronicWarfareService] 재밍 해제 시도', {
      battleId,
      factionId,
      previousLevel,
      currentLevel: state.jammingLevel,
    });

    return {
      success: true,
      message: `전자전 대응 조치 완료 (현재 레벨: ${state.jammingLevel})`,
    };
  }

  /**
   * 전투 종료 시 정리
   */
  clearBattle(battleId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, state] of this.states) {
      if (state.battleId === battleId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.states.delete(key);
    }

    this.globalMinovskyDensity.delete(battleId);

    logger.info('[ElectronicWarfareService] 전투 전자전 상태 정리됨', { battleId });
  }

  /**
   * 전투의 모든 세력 재밍 상태 조회
   */
  getBattleStates(battleId: string): ElectronicWarfareState[] {
    const result: ElectronicWarfareState[] = [];
    
    for (const state of this.states.values()) {
      if (state.battleId === battleId) {
        result.push({ ...state });
      }
    }

    return result;
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(event: EWEvent): void {
    this.emit('ewEvent', event);
    this.emit(event.type, event);
  }
}

// 싱글톤 인스턴스
export const electronicWarfareService = new ElectronicWarfareService();

export default ElectronicWarfareService;













