/**
 * CommandRangeService - 지휘 반경 시스템
 * 
 * 전술 전투에서 지휘관(사령관)과 유닛 간의 거리에 따른
 * 통신 지연, 명령 전달, 통제력 패널티를 관리합니다.
 * 
 * @see gin7manual Chapter4 §지휘반경
 * 
 * 핵심 메커니즘:
 * - 지휘 반경 내: 정상 명령 수행
 * - 지휘 반경 외: 명령 지연 증가, 통제력 감소
 * - 통신 두절: 자율 행동 (AI 대체)
 */

import { EventEmitter } from 'events';
import { Vector3, UnitState, CommanderBonus } from '../../types/gin7/tactical.types';
import { logger } from '../../common/logger';

// ============================================================================
// Constants
// ============================================================================

/**
 * 지휘 반경 상수 (매뉴얼 기반)
 */
export const COMMAND_RANGE_CONSTANTS = {
  // 기본 지휘 반경 (유닛 간 거리, 게임 유닛)
  BASE_COMMAND_RADIUS: 5000,
  
  // 기함(Flagship) 보너스 (+50%)
  FLAGSHIP_RADIUS_BONUS: 1.5,
  
  // 지휘 스탯 보너스 (command 스탯 10당 +200 반경)
  COMMAND_STAT_BONUS_PER_10: 200,
  
  // 기함 통신 장비 레벨별 보너스
  COMM_EQUIPMENT_BONUS: {
    BASIC: 1.0,
    STANDARD: 1.2,
    ADVANCED: 1.5,
    ELITE: 2.0,
  },
  
  // 반경 외 패널티
  OUT_OF_RANGE_DELAY_MULTIPLIER: 2.0,      // 명령 지연 2배
  OUT_OF_RANGE_ACCURACY_PENALTY: 0.1,      // 명중률 -10%
  OUT_OF_RANGE_EVASION_PENALTY: 0.1,       // 회피율 -10%
  OUT_OF_RANGE_MORALE_DECAY: 1,            // 틱당 사기 감소
  
  // 통신 두절 임계 (반경의 2배 이상)
  BLACKOUT_THRESHOLD_MULTIPLIER: 2.0,
  
  // 자율 행동 모드
  AUTONOMOUS_BEHAVIOR: {
    RETREAT: 0.3,      // 30% HP 이하 시 후퇴
    DEFENSIVE: 0.5,    // 50% HP 이하 시 방어적
    AGGRESSIVE: 0.7,   // 70% 이상 시 공격적
  },
};

// ============================================================================
// Types
// ============================================================================

export type CommunicationEquipment = 'BASIC' | 'STANDARD' | 'ADVANCED' | 'ELITE';

export type CommandRangeStatus = 
  | 'IN_RANGE'        // 정상 통제
  | 'OUT_OF_RANGE'    // 반경 외 (지연/패널티)
  | 'BLACKOUT';       // 통신 두절 (자율 행동)

export interface CommandRangeInfo {
  status: CommandRangeStatus;
  distance: number;
  effectiveRadius: number;
  delayMultiplier: number;
  penalties: {
    accuracy: number;
    evasion: number;
    morale: number;
  };
  isAutonomous: boolean;
}

export interface FlagshipInfo {
  unitId: string;
  position: Vector3;
  commandStat: number;
  equipment: CommunicationEquipment;
  effectiveRadius: number;
}

export interface CommandRangeState {
  battleId: string;
  factionId: string;
  flagship: FlagshipInfo;
  unitStatuses: Map<string, CommandRangeInfo>;
}

// ============================================================================
// Service
// ============================================================================

export class CommandRangeService extends EventEmitter {
  private states: Map<string, CommandRangeState> = new Map(); // battleId:factionId -> state

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * 세력의 지휘 반경 상태 초기화
   */
  initializeFaction(
    battleId: string,
    factionId: string,
    flagshipUnitId: string,
    flagshipPosition: Vector3,
    commandStat: number = 50,
    equipment: CommunicationEquipment = 'STANDARD'
  ): void {
    const key = `${battleId}:${factionId}`;
    const effectiveRadius = this.calculateEffectiveRadius(commandStat, equipment, true);

    this.states.set(key, {
      battleId,
      factionId,
      flagship: {
        unitId: flagshipUnitId,
        position: flagshipPosition,
        commandStat,
        equipment,
        effectiveRadius,
      },
      unitStatuses: new Map(),
    });

    logger.info('[CommandRangeService] Faction initialized', {
      battleId,
      factionId,
      effectiveRadius,
    });
  }

  /**
   * 유닛의 지휘 반경 상태 업데이트
   */
  updateUnitStatus(
    battleId: string,
    factionId: string,
    unitId: string,
    unitPosition: Vector3
  ): CommandRangeInfo {
    const key = `${battleId}:${factionId}`;
    const state = this.states.get(key);

    if (!state) {
      return {
        status: 'IN_RANGE',
        distance: 0,
        effectiveRadius: COMMAND_RANGE_CONSTANTS.BASE_COMMAND_RADIUS,
        delayMultiplier: 1.0,
        penalties: { accuracy: 0, evasion: 0, morale: 0 },
        isAutonomous: false,
      };
    }

    // 기함까지의 거리 계산
    const distance = this.calculateDistance(unitPosition, state.flagship.position);
    const radius = state.flagship.effectiveRadius;

    // 상태 판정
    let status: CommandRangeStatus;
    let delayMultiplier = 1.0;
    const penalties = { accuracy: 0, evasion: 0, morale: 0 };
    let isAutonomous = false;

    if (distance <= radius) {
      status = 'IN_RANGE';
    } else if (distance <= radius * COMMAND_RANGE_CONSTANTS.BLACKOUT_THRESHOLD_MULTIPLIER) {
      status = 'OUT_OF_RANGE';
      delayMultiplier = COMMAND_RANGE_CONSTANTS.OUT_OF_RANGE_DELAY_MULTIPLIER;
      penalties.accuracy = COMMAND_RANGE_CONSTANTS.OUT_OF_RANGE_ACCURACY_PENALTY;
      penalties.evasion = COMMAND_RANGE_CONSTANTS.OUT_OF_RANGE_EVASION_PENALTY;
      penalties.morale = COMMAND_RANGE_CONSTANTS.OUT_OF_RANGE_MORALE_DECAY;
    } else {
      status = 'BLACKOUT';
      delayMultiplier = Infinity; // 명령 불가
      penalties.accuracy = COMMAND_RANGE_CONSTANTS.OUT_OF_RANGE_ACCURACY_PENALTY * 2;
      penalties.evasion = COMMAND_RANGE_CONSTANTS.OUT_OF_RANGE_EVASION_PENALTY * 2;
      penalties.morale = COMMAND_RANGE_CONSTANTS.OUT_OF_RANGE_MORALE_DECAY * 2;
      isAutonomous = true;
    }

    const info: CommandRangeInfo = {
      status,
      distance,
      effectiveRadius: radius,
      delayMultiplier,
      penalties,
      isAutonomous,
    };

    state.unitStatuses.set(unitId, info);

    // 상태 변경 시 이벤트 발생
    const prevInfo = state.unitStatuses.get(unitId);
    if (prevInfo?.status !== status) {
      this.emit('status:changed', {
        battleId,
        factionId,
        unitId,
        prevStatus: prevInfo?.status || 'IN_RANGE',
        newStatus: status,
        distance,
      });
    }

    return info;
  }

  /**
   * 기함 위치 업데이트
   */
  updateFlagshipPosition(
    battleId: string,
    factionId: string,
    newPosition: Vector3
  ): void {
    const key = `${battleId}:${factionId}`;
    const state = this.states.get(key);

    if (state) {
      state.flagship.position = newPosition;
    }
  }

  /**
   * 기함 변경 (기함 파괴 시)
   */
  changeFlagship(
    battleId: string,
    factionId: string,
    newFlagshipUnitId: string,
    newPosition: Vector3,
    commandStat: number,
    equipment: CommunicationEquipment = 'BASIC' // 신규 기함은 기본 장비
  ): void {
    const key = `${battleId}:${factionId}`;
    const state = this.states.get(key);

    if (state) {
      const effectiveRadius = this.calculateEffectiveRadius(commandStat, equipment, true);
      state.flagship = {
        unitId: newFlagshipUnitId,
        position: newPosition,
        commandStat,
        equipment,
        effectiveRadius,
      };

      this.emit('flagship:changed', {
        battleId,
        factionId,
        newFlagshipUnitId,
        effectiveRadius,
      });

      logger.info('[CommandRangeService] Flagship changed', {
        battleId,
        factionId,
        newFlagshipUnitId,
        effectiveRadius,
      });
    }
  }

  /**
   * 유닛의 현재 지휘 반경 상태 조회
   */
  getUnitStatus(
    battleId: string,
    factionId: string,
    unitId: string
  ): CommandRangeInfo | undefined {
    const key = `${battleId}:${factionId}`;
    return this.states.get(key)?.unitStatuses.get(unitId);
  }

  /**
   * 세력의 전체 지휘 반경 상태 조회
   */
  getFactionStatus(battleId: string, factionId: string): CommandRangeState | undefined {
    const key = `${battleId}:${factionId}`;
    return this.states.get(key);
  }

  /**
   * 통신 두절 상태의 유닛 목록
   */
  getBlackoutUnits(battleId: string, factionId: string): string[] {
    const key = `${battleId}:${factionId}`;
    const state = this.states.get(key);

    if (!state) return [];

    const blackoutUnits: string[] = [];
    for (const [unitId, info] of state.unitStatuses) {
      if (info.status === 'BLACKOUT') {
        blackoutUnits.push(unitId);
      }
    }

    return blackoutUnits;
  }

  /**
   * 명령 지연 시간 계산 (지휘 반경 반영)
   */
  calculateCommandDelay(
    battleId: string,
    factionId: string,
    unitId: string,
    baseDelay: number
  ): number {
    const info = this.getUnitStatus(battleId, factionId, unitId);
    
    if (!info) return baseDelay;
    if (info.delayMultiplier === Infinity) return Infinity;
    
    return Math.ceil(baseDelay * info.delayMultiplier);
  }

  /**
   * 명령 실행 가능 여부 (통신 두절 확인)
   */
  canExecuteCommand(
    battleId: string,
    factionId: string,
    unitId: string
  ): { canExecute: boolean; reason?: string } {
    const info = this.getUnitStatus(battleId, factionId, unitId);

    if (!info) {
      return { canExecute: true };
    }

    if (info.status === 'BLACKOUT') {
      return {
        canExecute: false,
        reason: 'Communication blackout - unit is in autonomous mode',
      };
    }

    return { canExecute: true };
  }

  /**
   * 자율 행동 결정 (통신 두절 유닛용)
   */
  determineAutonomousBehavior(
    unit: UnitState
  ): 'RETREAT' | 'DEFENSIVE' | 'AGGRESSIVE' | 'HOLD' {
    const hpRatio = unit.hp / unit.maxHp;
    const thresholds = COMMAND_RANGE_CONSTANTS.AUTONOMOUS_BEHAVIOR;

    if (hpRatio <= thresholds.RETREAT) {
      return 'RETREAT';
    } else if (hpRatio <= thresholds.DEFENSIVE) {
      return 'DEFENSIVE';
    } else if (hpRatio >= thresholds.AGGRESSIVE) {
      return 'AGGRESSIVE';
    }

    return 'HOLD';
  }

  /**
   * 전투 상태 적용 (명중률/회피율 패널티)
   */
  applyRangePenalties(
    battleId: string,
    factionId: string,
    unitId: string,
    baseStats: { accuracy: number; evasion: number; morale: number }
  ): { accuracy: number; evasion: number; morale: number } {
    const info = this.getUnitStatus(battleId, factionId, unitId);

    if (!info) return baseStats;

    return {
      accuracy: Math.max(0, baseStats.accuracy - info.penalties.accuracy),
      evasion: Math.max(0, baseStats.evasion - info.penalties.evasion),
      morale: Math.max(0, baseStats.morale - info.penalties.morale),
    };
  }

  /**
   * 전투 종료 시 정리
   */
  cleanupBattle(battleId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.states.keys()) {
      if (key.startsWith(`${battleId}:`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.states.delete(key);
    }

    logger.info('[CommandRangeService] Battle cleaned up', { battleId });
  }

  /**
   * 틱 처리 (모든 유닛 상태 업데이트)
   */
  processTick(
    battleId: string,
    factionId: string,
    units: Array<{ unitId: string; position: Vector3 }>
  ): void {
    for (const unit of units) {
      this.updateUnitStatus(battleId, factionId, unit.unitId, unit.position);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * 유효 지휘 반경 계산
   */
  private calculateEffectiveRadius(
    commandStat: number,
    equipment: CommunicationEquipment,
    isFlagship: boolean
  ): number {
    let radius = COMMAND_RANGE_CONSTANTS.BASE_COMMAND_RADIUS;

    // 기함 보너스
    if (isFlagship) {
      radius *= COMMAND_RANGE_CONSTANTS.FLAGSHIP_RADIUS_BONUS;
    }

    // 지휘 스탯 보너스
    const statBonus = Math.floor((commandStat - 50) / 10) * 
      COMMAND_RANGE_CONSTANTS.COMMAND_STAT_BONUS_PER_10;
    radius += statBonus;

    // 통신 장비 보너스
    radius *= COMMAND_RANGE_CONSTANTS.COMM_EQUIPMENT_BONUS[equipment];

    return Math.round(radius);
  }

  /**
   * 두 점 사이의 거리 계산
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

// 싱글톤 인스턴스
export const commandRangeService = new CommandRangeService();

export default CommandRangeService;







