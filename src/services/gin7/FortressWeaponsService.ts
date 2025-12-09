/**
 * FortressWeaponsService - 요새포 시스템 (토르의 망치 등)
 * 매뉴얼 2289~2337행 기반 구현
 *
 * 요새 무기:
 * - THOR_HAMMER (토르의 망치): 충전식 주포
 * - HYDRA_ARRAY (히드라 어레이): 다연장 레이저
 * - AEGIS_SHIELD (이지스 방어막): 방어 시스템
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum FortressWeaponType {
  THOR_HAMMER = 'THOR_HAMMER',       // 토르의 망치
  HYDRA_ARRAY = 'HYDRA_ARRAY',       // 다연장 레이저
  AEGIS_SHIELD = 'AEGIS_SHIELD',     // 방어 시스템
  GUNGNIR_LANCE = 'GUNGNIR_LANCE',   // 관통 레이저
}

export interface FortressWeaponState {
  weaponType: FortressWeaponType;
  isCharging: boolean;
  chargeLevel: number;          // 0-100
  chargeRate: number;           // 틱당 충전량
  cooldownTicks: number;        // 남은 쿨다운 틱
  lastFiredAt?: Date;
  isOnline: boolean;
}

export interface FortressWeaponSpec {
  type: FortressWeaponType;
  name: string;
  damage: number;               // 기본 데미지
  chargeTime: number;           // 충전 시간 (틱)
  cooldown: number;             // 쿨다운 (틱)
  range: number;                // 사거리
  aoeRadius: number;            // 범위 공격 반경
  friendlyFire: boolean;        // 아군 피해 여부
  energyCost: number;           // 에너지 소모
}

export interface FireRequest {
  sessionId: string;
  fortressId: string;           // 요새 함대 ID
  weaponType: FortressWeaponType;
  targetPosition: { x: number; y: number; z: number };
  targetId?: string;            // 특정 대상 지정 시
}

export interface FireResult {
  success: boolean;
  weaponType: FortressWeaponType;
  damage: number;
  hitUnits: Array<{
    unitId: string;
    unitName: string;
    damage: number;
    destroyed: boolean;
  }>;
  error?: string;
}

// ============================================================
// Constants
// ============================================================

export const FORTRESS_WEAPON_SPECS: Record<FortressWeaponType, FortressWeaponSpec> = {
  [FortressWeaponType.THOR_HAMMER]: {
    type: FortressWeaponType.THOR_HAMMER,
    name: '토르의 망치',
    damage: 50000,
    chargeTime: 30,          // 30틱 충전
    cooldown: 60,            // 60틱 쿨다운
    range: 10000,
    aoeRadius: 500,
    friendlyFire: true,      // 피아 구분 없음
    energyCost: 5000,
  },
  [FortressWeaponType.HYDRA_ARRAY]: {
    type: FortressWeaponType.HYDRA_ARRAY,
    name: '히드라 어레이',
    damage: 3000,
    chargeTime: 5,
    cooldown: 15,
    range: 5000,
    aoeRadius: 200,
    friendlyFire: false,
    energyCost: 1000,
  },
  [FortressWeaponType.AEGIS_SHIELD]: {
    type: FortressWeaponType.AEGIS_SHIELD,
    name: '이지스 방어막',
    damage: 0,               // 방어 전용
    chargeTime: 10,
    cooldown: 30,
    range: 3000,
    aoeRadius: 1000,
    friendlyFire: false,
    energyCost: 2000,
  },
  [FortressWeaponType.GUNGNIR_LANCE]: {
    type: FortressWeaponType.GUNGNIR_LANCE,
    name: '궁니르 창',
    damage: 20000,
    chargeTime: 15,
    cooldown: 30,
    range: 15000,
    aoeRadius: 50,           // 직선형
    friendlyFire: true,
    energyCost: 3000,
  },
};

// ============================================================
// FortressWeaponsService Class
// ============================================================

export class FortressWeaponsService extends EventEmitter {
  private static instance: FortressWeaponsService;
  
  // 요새별 무기 상태 캐시
  private weaponStates: Map<string, Map<FortressWeaponType, FortressWeaponState>> = new Map();
  
  // 충전 타이머
  private chargeTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    super();
    logger.info('[FortressWeaponsService] Initialized');
  }

  public static getInstance(): FortressWeaponsService {
    if (!FortressWeaponsService.instance) {
      FortressWeaponsService.instance = new FortressWeaponsService();
    }
    return FortressWeaponsService.instance;
  }

  // ============================================================
  // 초기화
  // ============================================================

  /**
   * 요새 무기 시스템 초기화
   */
  public initializeFortress(fortressId: string, weapons: FortressWeaponType[]): void {
    const states = new Map<FortressWeaponType, FortressWeaponState>();
    
    for (const weaponType of weapons) {
      const spec = FORTRESS_WEAPON_SPECS[weaponType];
      states.set(weaponType, {
        weaponType,
        isCharging: false,
        chargeLevel: 0,
        chargeRate: 100 / spec.chargeTime,
        cooldownTicks: 0,
        isOnline: true,
      });
    }
    
    this.weaponStates.set(fortressId, states);
    logger.info(`[FortressWeaponsService] Initialized fortress ${fortressId} with ${weapons.length} weapons`);
  }

  // ============================================================
  // 충전 시작/중지
  // ============================================================

  /**
   * 충전 시작
   */
  public startCharging(
    fortressId: string,
    weaponType: FortressWeaponType,
  ): { success: boolean; error?: string } {
    const states = this.weaponStates.get(fortressId);
    if (!states) {
      return { success: false, error: '요새를 찾을 수 없습니다.' };
    }

    const state = states.get(weaponType);
    if (!state) {
      return { success: false, error: '해당 무기가 없습니다.' };
    }

    if (!state.isOnline) {
      return { success: false, error: '무기가 오프라인 상태입니다.' };
    }

    if (state.cooldownTicks > 0) {
      return { success: false, error: `쿨다운 중입니다. (${state.cooldownTicks}틱 남음)` };
    }

    if (state.isCharging) {
      return { success: false, error: '이미 충전 중입니다.' };
    }

    state.isCharging = true;
    state.chargeLevel = 0;

    // 충전 타이머 시작
    const timerKey = `${fortressId}-${weaponType}`;
    const timer = setInterval(() => {
      this.processCharging(fortressId, weaponType);
    }, 1000); // 1초마다 체크 (틱 = 1초 가정)
    
    this.chargeTimers.set(timerKey, timer);

    this.emit('weapon:chargingStarted', {
      fortressId,
      weaponType,
    });

    logger.info(`[FortressWeaponsService] ${weaponType} charging started for fortress ${fortressId}`);

    return { success: true };
  }

  /**
   * 충전 중지
   */
  public stopCharging(
    fortressId: string,
    weaponType: FortressWeaponType,
  ): { success: boolean } {
    const timerKey = `${fortressId}-${weaponType}`;
    const timer = this.chargeTimers.get(timerKey);
    
    if (timer) {
      clearInterval(timer);
      this.chargeTimers.delete(timerKey);
    }

    const states = this.weaponStates.get(fortressId);
    if (states) {
      const state = states.get(weaponType);
      if (state) {
        state.isCharging = false;
        state.chargeLevel = 0;
      }
    }

    this.emit('weapon:chargingStopped', {
      fortressId,
      weaponType,
    });

    return { success: true };
  }

  /**
   * 충전 처리
   */
  private processCharging(fortressId: string, weaponType: FortressWeaponType): void {
    const states = this.weaponStates.get(fortressId);
    if (!states) return;

    const state = states.get(weaponType);
    if (!state || !state.isCharging) return;

    state.chargeLevel = Math.min(100, state.chargeLevel + state.chargeRate);

    this.emit('weapon:chargeProgress', {
      fortressId,
      weaponType,
      chargeLevel: state.chargeLevel,
    });

    // 충전 완료
    if (state.chargeLevel >= 100) {
      const timerKey = `${fortressId}-${weaponType}`;
      const timer = this.chargeTimers.get(timerKey);
      if (timer) {
        clearInterval(timer);
        this.chargeTimers.delete(timerKey);
      }

      this.emit('weapon:chargeComplete', {
        fortressId,
        weaponType,
      });

      logger.info(`[FortressWeaponsService] ${weaponType} charge complete for fortress ${fortressId}`);
    }
  }

  // ============================================================
  // 발사
  // ============================================================

  /**
   * 무기 발사
   */
  public async fire(request: FireRequest): Promise<FireResult> {
    const { sessionId, fortressId, weaponType, targetPosition, targetId } = request;

    // 1. 상태 확인
    const states = this.weaponStates.get(fortressId);
    if (!states) {
      return { success: false, weaponType, damage: 0, hitUnits: [], error: '요새를 찾을 수 없습니다.' };
    }

    const state = states.get(weaponType);
    if (!state) {
      return { success: false, weaponType, damage: 0, hitUnits: [], error: '해당 무기가 없습니다.' };
    }

    if (!state.isOnline) {
      return { success: false, weaponType, damage: 0, hitUnits: [], error: '무기가 오프라인 상태입니다.' };
    }

    if (state.chargeLevel < 100) {
      return { success: false, weaponType, damage: 0, hitUnits: [], error: `충전이 완료되지 않았습니다. (${state.chargeLevel}%)` };
    }

    // 2. 무기 스펙 가져오기
    const spec = FORTRESS_WEAPON_SPECS[weaponType];

    // 3. 발사 처리
    state.isCharging = false;
    state.chargeLevel = 0;
    state.cooldownTicks = spec.cooldown;
    state.lastFiredAt = new Date();

    // 쿨다운 타이머 시작
    this.startCooldown(fortressId, weaponType);

    // 4. 데미지 계산 (TacticalSession과 연동 필요)
    // 여기서는 데미지 이벤트를 발생시키고, TacticalSession이 실제 적용을 처리
    const hitUnits: FireResult['hitUnits'] = [];
    
    // 범위 내 모든 유닛에게 데미지 (피아 구분 여부에 따라)
    // 실제 구현에서는 TacticalSession에서 유닛 위치를 기반으로 계산
    
    this.emit('weapon:fired', {
      sessionId,
      fortressId,
      weaponType,
      targetPosition,
      targetId,
      damage: spec.damage,
      aoeRadius: spec.aoeRadius,
      friendlyFire: spec.friendlyFire,
    });

    logger.info(`[FortressWeaponsService] ${weaponType} fired from fortress ${fortressId}`);

    return {
      success: true,
      weaponType,
      damage: spec.damage,
      hitUnits,
    };
  }

  /**
   * 쿨다운 처리
   */
  private startCooldown(fortressId: string, weaponType: FortressWeaponType): void {
    const timerKey = `${fortressId}-${weaponType}-cooldown`;
    
    const timer = setInterval(() => {
      const states = this.weaponStates.get(fortressId);
      if (!states) {
        clearInterval(timer);
        this.chargeTimers.delete(timerKey);
        return;
      }

      const state = states.get(weaponType);
      if (!state) {
        clearInterval(timer);
        this.chargeTimers.delete(timerKey);
        return;
      }

      state.cooldownTicks = Math.max(0, state.cooldownTicks - 1);

      if (state.cooldownTicks <= 0) {
        clearInterval(timer);
        this.chargeTimers.delete(timerKey);
        
        this.emit('weapon:ready', {
          fortressId,
          weaponType,
        });
      }
    }, 1000);

    this.chargeTimers.set(timerKey, timer);
  }

  // ============================================================
  // 방어 시스템 (이지스)
  // ============================================================

  /**
   * 방어막 활성화
   */
  public activateShield(
    fortressId: string,
  ): { success: boolean; error?: string } {
    return this.startCharging(fortressId, FortressWeaponType.AEGIS_SHIELD);
  }

  /**
   * 방어막 배치 (충전 완료 후)
   */
  public deployShield(
    fortressId: string,
    position: { x: number; y: number; z: number },
  ): { success: boolean; duration: number; error?: string } {
    const states = this.weaponStates.get(fortressId);
    if (!states) {
      return { success: false, duration: 0, error: '요새를 찾을 수 없습니다.' };
    }

    const state = states.get(FortressWeaponType.AEGIS_SHIELD);
    if (!state || state.chargeLevel < 100) {
      return { success: false, duration: 0, error: '방어막이 준비되지 않았습니다.' };
    }

    state.chargeLevel = 0;
    state.cooldownTicks = FORTRESS_WEAPON_SPECS[FortressWeaponType.AEGIS_SHIELD].cooldown;

    this.startCooldown(fortressId, FortressWeaponType.AEGIS_SHIELD);

    this.emit('shield:deployed', {
      fortressId,
      position,
      radius: FORTRESS_WEAPON_SPECS[FortressWeaponType.AEGIS_SHIELD].aoeRadius,
    });

    return { success: true, duration: 30 }; // 30틱 지속
  }

  // ============================================================
  // 상태 조회
  // ============================================================

  /**
   * 무기 상태 조회
   */
  public getWeaponStatus(
    fortressId: string,
    weaponType?: FortressWeaponType,
  ): FortressWeaponState[] {
    const states = this.weaponStates.get(fortressId);
    if (!states) return [];

    if (weaponType) {
      const state = states.get(weaponType);
      return state ? [state] : [];
    }

    return Array.from(states.values());
  }

  /**
   * 무기 온라인/오프라인 전환
   */
  public setWeaponOnline(
    fortressId: string,
    weaponType: FortressWeaponType,
    online: boolean,
  ): { success: boolean } {
    const states = this.weaponStates.get(fortressId);
    if (!states) return { success: false };

    const state = states.get(weaponType);
    if (!state) return { success: false };

    state.isOnline = online;

    if (!online) {
      // 오프라인 시 충전 중지
      this.stopCharging(fortressId, weaponType);
    }

    this.emit('weapon:statusChanged', {
      fortressId,
      weaponType,
      isOnline: online,
    });

    return { success: true };
  }

  // ============================================================
  // 정리
  // ============================================================

  /**
   * 요새 정리
   */
  public cleanupFortress(fortressId: string): void {
    // 모든 타이머 정리
    for (const [key, timer] of this.chargeTimers) {
      if (key.startsWith(fortressId)) {
        clearInterval(timer);
        this.chargeTimers.delete(key);
      }
    }

    this.weaponStates.delete(fortressId);
    logger.info(`[FortressWeaponsService] Cleaned up fortress ${fortressId}`);
  }
}

export const fortressWeaponsService = FortressWeaponsService.getInstance();
export default FortressWeaponsService;





