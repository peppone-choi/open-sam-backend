/**
 * FortressSiegeService - 요새 공성전 관리 서비스
 * 
 * 5단계 공성전 (포위 → 포격 → 돌격 → 돌파 → 소탕) 처리를 담당합니다.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { IGroundUnit, GroundUnitType } from '../../models/gin7/GroundBattle';
import { Fortress, IFortress } from '../../models/gin7/Fortress';
import { logger } from '../../common/logger';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 공성전 단계
 */
export type SiegePhase =
  | 'ENCIRCLEMENT'    // 포위 - 요새 주변 장악, 보급선 차단
  | 'BOMBARDMENT'     // 포격 - 성벽/방어시설 파괴
  | 'ASSAULT'         // 돌격 - 성벽 돌파 시도
  | 'BREACH'          // 돌파 - 내부 진입, 시가전
  | 'CLEANUP';        // 소탕 - 잔적 소탕, 점령 완료

/**
 * 공성전 상태
 */
export type SiegeStatus =
  | 'PREPARING'       // 준비 중
  | 'IN_PROGRESS'     // 진행 중
  | 'PAUSED'          // 일시 정지
  | 'COMPLETED'       // 완료
  | 'FAILED'          // 실패
  | 'ABANDONED';      // 포기

/**
 * 공성전 결과
 */
export type SiegeResult =
  | 'ATTACKER_VICTORY'    // 공격측 승리
  | 'DEFENDER_VICTORY'    // 방어측 승리
  | 'DRAW'                // 무승부
  | 'ATTACKER_RETREAT'    // 공격측 철수
  | 'DEFENDER_SURRENDER'; // 방어측 항복

/**
 * 공성 무기 유형
 */
export type SiegeWeaponType =
  | 'SIEGE_CANNON'        // 공성포 - 성벽 파괴
  | 'PLASMA_MORTAR'       // 플라즈마 박격포 - 범위 공격
  | 'BREACHING_CHARGE'    // 돌파 폭약 - 벽 돌파
  | 'SHIELD_DISRUPTOR'    // 방어막 교란기 - 쉴드 무력화
  | 'TUNNELER'            // 터널러 - 지하 침투
  | 'SIEGE_TOWER';        // 공성탑 - 병력 수송

/**
 * 공성전 정보
 */
export interface FortressSiege {
  siegeId: string;
  sessionId: string;
  fortressId: string;
  planetId: string;
  systemId: string;
  
  // 참여 진영
  attackerFactionId: string;
  defenderFactionId: string;
  
  // 현재 상태
  status: SiegeStatus;
  phase: SiegePhase;
  phaseProgress: number;         // 0-100
  
  // 유닛
  attackerUnits: SiegeUnit[];
  defenderUnits: SiegeUnit[];
  
  // 공성 무기
  siegeWeapons: SiegeWeapon[];
  
  // 요새 상태
  fortressState: FortressState;
  
  // 포위 상태
  encirclementLevel: number;     // 0-100 (포위도)
  supplyBlockade: number;        // 0-100 (보급 차단율)
  
  // 통계
  statistics: SiegeStatistics;
  
  // 결과
  result?: SiegeResult;
  
  // 타이밍
  startedAt: Date;
  phaseStartedAt: Date;
  estimatedDuration: number;     // 예상 소요 시간 (틱)
  currentTick: number;
  endedAt?: Date;
  
  // 로그
  eventLog: SiegeEvent[];
}

/**
 * 공성전 유닛
 */
export interface SiegeUnit {
  unitId: string;
  type: GroundUnitType;
  count: number;
  hp: number;
  maxHp: number;
  morale: number;
  
  // 위치
  position: SiegePosition;
  
  // 상태
  isEngaged: boolean;
  isRouted: boolean;
  hasActed: boolean;
  
  // 할당
  assignedTask?: SiegeTask;
}

/**
 * 공성전 위치
 */
export type SiegePosition =
  | 'OUTER_PERIMETER'     // 외곽 경계
  | 'SIEGE_LINE'          // 포위선
  | 'WALL_BASE'           // 성벽 기저
  | 'WALL_TOP'            // 성벽 위
  | 'INNER_COURTYARD'     // 내부 마당
  | 'COMMAND_CENTER'      // 지휘소
  | 'RESERVE';            // 예비

/**
 * 공성 임무
 */
export type SiegeTask =
  | 'ENCIRCLE'            // 포위 유지
  | 'BOMBARD'             // 포격
  | 'ASSAULT'             // 돌격
  | 'DEFEND'              // 방어
  | 'BREACH'              // 돌파
  | 'CLEANUP'             // 소탕
  | 'RESERVE';            // 예비

/**
 * 공성 무기
 */
export interface SiegeWeapon {
  weaponId: string;
  type: SiegeWeaponType;
  name: string;
  
  // 상태
  isDeployed: boolean;
  isReady: boolean;
  currentCooldown: number;
  maxCooldown: number;
  
  // 성능
  damage: number;
  accuracy: number;
  range: number;
  ammoCount: number;
  maxAmmo: number;
  
  // 타겟
  targetType: 'WALL' | 'UNIT' | 'FACILITY' | 'SHIELD';
}

/**
 * 요새 상태
 */
export interface FortressState {
  wallIntegrity: number;         // 성벽 완전성 0-100
  shieldStrength: number;        // 방어막 강도 0-100
  garrisonMorale: number;        // 수비대 사기 0-100
  supplyLevel: number;           // 보급 수준 0-100
  
  // 방어 시설
  turrets: {
    total: number;
    operational: number;
  };
  shieldGenerators: {
    total: number;
    operational: number;
  };
  
  // 돌파구
  breaches: Breach[];
  
  // 구역 장악률
  sectorControl: {
    outerWall: number;           // 0-100
    innerWall: number;           // 0-100
    courtyard: number;           // 0-100
    commandCenter: number;       // 0-100
  };
}

/**
 * 돌파구
 */
export interface Breach {
  breachId: string;
  location: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  isSecured: boolean;
  securingFactionId?: string;
}

/**
 * 공성전 통계
 */
export interface SiegeStatistics {
  totalDuration: number;         // 총 소요 시간 (틱)
  phaseDurations: Record<SiegePhase, number>;
  
  attackerCasualties: number;
  defenderCasualties: number;
  
  wallDamageDealt: number;
  shieldDamageDealt: number;
  
  assaultAttempts: number;
  successfulBreaches: number;
  
  siegeWeaponsUsed: number;
  ammunitionExpended: number;
}

/**
 * 공성전 이벤트
 */
export interface SiegeEvent {
  timestamp: Date;
  tick: number;
  phase: SiegePhase;
  eventType: string;
  description: string;
  data?: Record<string, unknown>;
}

/**
 * 포격 결과
 */
export interface BombardmentResult {
  success: boolean;
  wallDamage: number;
  shieldDamage: number;
  casualtiesCaused: number;
  turretsDestroyed: number;
  message: string;
}

/**
 * 돌격 결과
 */
export interface AssaultResult {
  success: boolean;
  breached: boolean;
  breach?: Breach;
  
  attackerCasualties: number;
  defenderCasualties: number;
  
  wallProgress: number;
  
  combatLog: string[];
}

/**
 * 공성 무기 사용 결과
 */
export interface SiegeWeaponResult {
  success: boolean;
  weaponId: string;
  weaponType: SiegeWeaponType;
  
  damage: number;
  targetHit: boolean;
  
  effect: string;
  cooldownApplied: number;
  ammoUsed: number;
}

// ============================================================
// Constants
// ============================================================

const SIEGE_CONSTANTS = {
  // 단계별 요구 조건
  PHASE_REQUIREMENTS: {
    ENCIRCLEMENT: { encirclementLevel: 60 },
    BOMBARDMENT: { wallIntegrity: 50, shieldStrength: 20 },
    ASSAULT: { wallIntegrity: 30 },
    BREACH: { hasBreaches: true },
    CLEANUP: { sectorControlThreshold: 70 },
  },
  
  // 기본 수치
  BASE_ENCIRCLEMENT_RATE: 5,       // 턴당 포위도 증가
  BASE_SUPPLY_DRAIN: 3,            // 턴당 보급 감소
  BASE_MORALE_DRAIN: 2,            // 턴당 사기 감소 (포위 시)
  
  // 포격 관련
  BOMBARDMENT_WALL_DAMAGE: 5,      // 기본 성벽 피해
  BOMBARDMENT_SHIELD_DAMAGE: 10,   // 기본 방어막 피해
  SHIELD_REGEN_RATE: 2,            // 턴당 방어막 회복
  
  // 돌격 관련
  ASSAULT_CASUALTY_RATE: 0.15,     // 돌격 손실률
  BREACH_THRESHOLD: 20,            // 돌파구 생성 성벽 임계값
  
  // 승리 조건
  CAPTURE_THRESHOLD: 80,           // 지휘소 장악률 80% 시 승리
  SURRENDER_THRESHOLD: 20,         // 사기 20% 이하 시 항복
  
  // 시간 제한
  MAX_SIEGE_DURATION: 100,         // 최대 공성 시간 (틱)
  
  // 공성 무기
  SIEGE_WEAPONS: {
    SIEGE_CANNON: {
      damage: 15,
      accuracy: 70,
      range: 3,
      cooldown: 3,
      maxAmmo: 20,
      targetType: 'WALL',
    },
    PLASMA_MORTAR: {
      damage: 8,
      accuracy: 60,
      range: 4,
      cooldown: 2,
      maxAmmo: 30,
      targetType: 'UNIT',
    },
    BREACHING_CHARGE: {
      damage: 25,
      accuracy: 90,
      range: 1,
      cooldown: 5,
      maxAmmo: 5,
      targetType: 'WALL',
    },
    SHIELD_DISRUPTOR: {
      damage: 30,
      accuracy: 80,
      range: 2,
      cooldown: 4,
      maxAmmo: 10,
      targetType: 'SHIELD',
    },
    TUNNELER: {
      damage: 10,
      accuracy: 95,
      range: 0,
      cooldown: 10,
      maxAmmo: 3,
      targetType: 'WALL',
    },
    SIEGE_TOWER: {
      damage: 0,
      accuracy: 100,
      range: 1,
      cooldown: 1,
      maxAmmo: 999,
      targetType: 'WALL',
    },
  } as Record<SiegeWeaponType, { damage: number; accuracy: number; range: number; cooldown: number; maxAmmo: number; targetType: string }>,
};

// ============================================================
// FortressSiegeService Class
// ============================================================

export class FortressSiegeService extends EventEmitter {
  private static instance: FortressSiegeService;
  private activeSieges: Map<string, FortressSiege> = new Map();
  
  private constructor() {
    super();
    logger.info('[FortressSiegeService] Initialized');
  }
  
  public static getInstance(): FortressSiegeService {
    if (!FortressSiegeService.instance) {
      FortressSiegeService.instance = new FortressSiegeService();
    }
    return FortressSiegeService.instance;
  }
  
  // ============================================================
  // Siege Lifecycle
  // ============================================================
  
  /**
   * 공성전 시작
   */
  async startSiege(params: {
    sessionId: string;
    fortressId: string;
    attackerFactionId: string;
    attackerUnits: IGroundUnit[];
    siegeWeaponTypes?: SiegeWeaponType[];
  }): Promise<FortressSiege> {
    const { sessionId, fortressId, attackerFactionId, attackerUnits, siegeWeaponTypes } = params;
    
    // 요새 정보 조회
    const fortress = await Fortress.findOne({ sessionId, fortressId });
    if (!fortress) {
      throw new Error(`Fortress not found: ${fortressId}`);
    }
    
    // 이미 진행 중인 공성전 확인
    const existingSiege = Array.from(this.activeSieges.values()).find(
      s => s.fortressId === fortressId && s.status === 'IN_PROGRESS'
    );
    if (existingSiege) {
      throw new Error(`Siege already in progress for fortress: ${fortressId}`);
    }
    
    // 공성 유닛 변환
    const siegeUnits: SiegeUnit[] = attackerUnits.map(u => ({
      unitId: u.unitId,
      type: u.type,
      count: u.count,
      hp: u.stats.hp,
      maxHp: u.stats.maxHp,
      morale: u.stats.morale,
      position: 'OUTER_PERIMETER',
      isEngaged: false,
      isRouted: false,
      hasActed: false,
    }));
    
    // 공성 무기 생성
    const weapons: SiegeWeapon[] = (siegeWeaponTypes || ['SIEGE_CANNON', 'PLASMA_MORTAR']).map(type => {
      const spec = SIEGE_CONSTANTS.SIEGE_WEAPONS[type];
      return {
        weaponId: `SW-${uuidv4().slice(0, 6)}`,
        type,
        name: this.getWeaponName(type),
        isDeployed: false,
        isReady: true,
        currentCooldown: 0,
        maxCooldown: spec.cooldown,
        damage: spec.damage,
        accuracy: spec.accuracy,
        range: spec.range,
        ammoCount: spec.maxAmmo,
        maxAmmo: spec.maxAmmo,
        targetType: spec.targetType as 'WALL' | 'UNIT' | 'FACILITY' | 'SHIELD',
      };
    });
    
    // 방어군 상태 (요새 수비대)
    const defenderUnits: SiegeUnit[] = [];
    const garrisonStrength = (fortress as any).defenseRating || 50;
    const garrisonCount = Math.floor(garrisonStrength / 10);
    
    for (let i = 0; i < garrisonCount; i++) {
      defenderUnits.push({
        unitId: `DEF-${uuidv4().slice(0, 6)}`,
        type: i % 2 === 0 ? 'grenadier' : 'infantry',
        count: 100,
        hp: 100,
        maxHp: 100,
        morale: 80,
        position: i < garrisonCount / 2 ? 'WALL_TOP' : 'INNER_COURTYARD',
        isEngaged: false,
        isRouted: false,
        hasActed: false,
      });
    }
    
    const siegeId = `SIEGE-${uuidv4().slice(0, 8)}`;
    const siege: FortressSiege = {
      siegeId,
      sessionId,
      fortressId,
      planetId: (fortress as any).planetId || fortress.location?.systemId || '',
      systemId: (fortress as any).systemId || fortress.location?.systemId || '',
      
      attackerFactionId,
      defenderFactionId: fortress.ownerId || '',
      
      status: 'IN_PROGRESS',
      phase: 'ENCIRCLEMENT',
      phaseProgress: 0,
      
      attackerUnits: siegeUnits,
      defenderUnits,
      
      siegeWeapons: weapons,
      
      fortressState: {
        wallIntegrity: 100,
        shieldStrength: (fortress as any).shieldLevel || fortress.currentShield || 80,
        garrisonMorale: 80,
        supplyLevel: 100,
        turrets: {
          total: Math.floor(garrisonStrength / 5),
          operational: Math.floor(garrisonStrength / 5),
        },
        shieldGenerators: {
          total: 4,
          operational: 4,
        },
        breaches: [],
        sectorControl: {
          outerWall: 0,
          innerWall: 0,
          courtyard: 0,
          commandCenter: 0,
        },
      },
      
      encirclementLevel: 0,
      supplyBlockade: 0,
      
      statistics: {
        totalDuration: 0,
        phaseDurations: {
          ENCIRCLEMENT: 0,
          BOMBARDMENT: 0,
          ASSAULT: 0,
          BREACH: 0,
          CLEANUP: 0,
        },
        attackerCasualties: 0,
        defenderCasualties: 0,
        wallDamageDealt: 0,
        shieldDamageDealt: 0,
        assaultAttempts: 0,
        successfulBreaches: 0,
        siegeWeaponsUsed: 0,
        ammunitionExpended: 0,
      },
      
      startedAt: new Date(),
      phaseStartedAt: new Date(),
      estimatedDuration: SIEGE_CONSTANTS.MAX_SIEGE_DURATION,
      currentTick: 0,
      
      eventLog: [],
    };
    
    // 시작 이벤트 기록
    this.addEvent(siege, 'SIEGE_START', '공성전이 시작되었습니다');
    
    this.activeSieges.set(siegeId, siege);
    
    logger.info('[FortressSiegeService] Siege started', {
      siegeId,
      fortressId,
      attackerUnits: siegeUnits.length,
      defenderUnits: defenderUnits.length,
    });
    
    this.emit('siege:started', {
      siegeId,
      sessionId,
      fortressId,
      attackerFactionId,
    });
    
    return siege;
  }
  
  /**
   * 공성 무기 이름
   */
  private getWeaponName(type: SiegeWeaponType): string {
    const names: Record<SiegeWeaponType, string> = {
      SIEGE_CANNON: '공성포',
      PLASMA_MORTAR: '플라즈마 박격포',
      BREACHING_CHARGE: '돌파 폭약',
      SHIELD_DISRUPTOR: '방어막 교란기',
      TUNNELER: '터널러',
      SIEGE_TOWER: '공성탑',
    };
    return names[type];
  }
  
  // ============================================================
  // Phase Management
  // ============================================================
  
  /**
   * 단계 진행
   */
  advancePhase(siegeId: string): FortressSiege {
    const siege = this.activeSieges.get(siegeId);
    if (!siege) {
      throw new Error(`Siege not found: ${siegeId}`);
    }
    
    if (siege.status !== 'IN_PROGRESS') {
      throw new Error('Siege is not in progress');
    }
    
    const phaseOrder: SiegePhase[] = ['ENCIRCLEMENT', 'BOMBARDMENT', 'ASSAULT', 'BREACH', 'CLEANUP'];
    const currentIndex = phaseOrder.indexOf(siege.phase);
    
    // 현재 단계 요구 조건 확인
    if (!this.canAdvancePhase(siege)) {
      throw new Error(`Phase advancement requirements not met for ${siege.phase}`);
    }
    
    // 다음 단계로 진행
    if (currentIndex < phaseOrder.length - 1) {
      const nextPhase = phaseOrder[currentIndex + 1];
      siege.statistics.phaseDurations[siege.phase] += siege.currentTick;
      siege.phase = nextPhase;
      siege.phaseProgress = 0;
      siege.phaseStartedAt = new Date();
      
      this.addEvent(siege, 'PHASE_ADVANCE', `${this.getPhaseName(nextPhase)} 단계 진입`);
      
      logger.info('[FortressSiegeService] Phase advanced', {
        siegeId,
        newPhase: nextPhase,
      });
      
      this.emit('siege:phaseAdvanced', {
        siegeId,
        phase: nextPhase,
      });
    } else {
      // 마지막 단계 완료 - 공성전 종료
      this.completeSiege(siege, 'ATTACKER_VICTORY');
    }
    
    return siege;
  }
  
  /**
   * 단계 진행 가능 여부 확인
   */
  private canAdvancePhase(siege: FortressSiege): boolean {
    const requirements = SIEGE_CONSTANTS.PHASE_REQUIREMENTS;
    const state = siege.fortressState;
    
    switch (siege.phase) {
      case 'ENCIRCLEMENT':
        return siege.encirclementLevel >= requirements.ENCIRCLEMENT.encirclementLevel;
        
      case 'BOMBARDMENT':
        return state.wallIntegrity <= requirements.BOMBARDMENT.wallIntegrity &&
               state.shieldStrength <= requirements.BOMBARDMENT.shieldStrength;
        
      case 'ASSAULT':
        return state.wallIntegrity <= requirements.ASSAULT.wallIntegrity;
        
      case 'BREACH':
        return state.breaches.some(b => b.isSecured);
        
      case 'CLEANUP':
        return state.sectorControl.commandCenter >= requirements.CLEANUP.sectorControlThreshold;
    }
  }
  
  /**
   * 단계 이름
   */
  private getPhaseName(phase: SiegePhase): string {
    const names: Record<SiegePhase, string> = {
      ENCIRCLEMENT: '포위',
      BOMBARDMENT: '포격',
      ASSAULT: '돌격',
      BREACH: '돌파',
      CLEANUP: '소탕',
    };
    return names[phase];
  }
  
  // ============================================================
  // Siege Operations
  // ============================================================
  
  /**
   * 성벽 포격
   */
  bombardWall(siegeId: string, intensity: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'MEDIUM'): BombardmentResult {
    const siege = this.activeSieges.get(siegeId);
    if (!siege) {
      throw new Error(`Siege not found: ${siegeId}`);
    }
    
    if (siege.phase !== 'BOMBARDMENT' && siege.phase !== 'ENCIRCLEMENT') {
      return {
        success: false,
        wallDamage: 0,
        shieldDamage: 0,
        casualtiesCaused: 0,
        turretsDestroyed: 0,
        message: '포격은 포위 또는 포격 단계에서만 가능합니다',
      };
    }
    
    // 강도별 배수
    const intensityMultiplier = {
      LIGHT: 0.5,
      MEDIUM: 1.0,
      HEAVY: 1.5,
    };
    const multiplier = intensityMultiplier[intensity];
    
    // 포격 계산
    let wallDamage = 0;
    let shieldDamage = 0;
    let casualtiesCaused = 0;
    let turretsDestroyed = 0;
    
    // 공성 무기 사용
    for (const weapon of siege.siegeWeapons) {
      if (!weapon.isReady || weapon.ammoCount <= 0) continue;
      if (weapon.targetType !== 'WALL' && weapon.targetType !== 'SHIELD') continue;
      
      const hitRoll = Math.random() * 100;
      if (hitRoll <= weapon.accuracy) {
        if (siege.fortressState.shieldStrength > 0) {
          // 방어막이 있으면 방어막 우선 피해
          shieldDamage += Math.floor(weapon.damage * multiplier);
        } else {
          // 방어막 없으면 성벽 피해
          wallDamage += Math.floor(weapon.damage * multiplier);
        }
      }
      
      weapon.ammoCount--;
      siege.statistics.ammunitionExpended++;
    }
    
    // 기본 포격 (포병 유닛)
    const artilleryUnits = siege.attackerUnits.filter(
      u => u.type === 'armored' && u.position === 'SIEGE_LINE'
    );
    for (const unit of artilleryUnits) {
      const unitDamage = Math.floor(SIEGE_CONSTANTS.BOMBARDMENT_WALL_DAMAGE * multiplier * (unit.count / 100));
      
      if (siege.fortressState.shieldStrength > 0) {
        shieldDamage += unitDamage;
      } else {
        wallDamage += unitDamage;
      }
    }
    
    // 피해 적용
    siege.fortressState.shieldStrength = Math.max(0, siege.fortressState.shieldStrength - shieldDamage);
    siege.fortressState.wallIntegrity = Math.max(0, siege.fortressState.wallIntegrity - wallDamage);
    
    // 포탑 파괴 (성벽 피해 시)
    if (wallDamage > 0 && Math.random() < 0.2) {
      turretsDestroyed = Math.min(1, siege.fortressState.turrets.operational);
      siege.fortressState.turrets.operational -= turretsDestroyed;
    }
    
    // 수비대 사상자 (범위 피해)
    for (const unit of siege.defenderUnits.filter(u => u.position === 'WALL_TOP')) {
      const casualties = Math.floor(unit.count * 0.03 * multiplier);
      unit.count -= casualties;
      casualtiesCaused += casualties;
    }
    
    // 통계 업데이트
    siege.statistics.wallDamageDealt += wallDamage;
    siege.statistics.shieldDamageDealt += shieldDamage;
    siege.statistics.defenderCasualties += casualtiesCaused;
    siege.statistics.siegeWeaponsUsed++;
    
    // 이벤트 기록
    this.addEvent(siege, 'BOMBARDMENT', 
      `${intensity} 포격: 성벽 -${wallDamage}%, 방어막 -${shieldDamage}%`);
    
    logger.info('[FortressSiegeService] Wall bombarded', {
      siegeId,
      wallDamage,
      shieldDamage,
      intensity,
    });
    
    return {
      success: true,
      wallDamage,
      shieldDamage,
      casualtiesCaused,
      turretsDestroyed,
      message: `포격 완료: 성벽 피해 ${wallDamage}%, 방어막 피해 ${shieldDamage}%`,
    };
  }
  
  /**
   * 돌격 시도
   */
  attemptAssault(siegeId: string, assaultUnits: string[]): AssaultResult {
    const siege = this.activeSieges.get(siegeId);
    if (!siege) {
      throw new Error(`Siege not found: ${siegeId}`);
    }
    
    if (siege.phase !== 'ASSAULT' && siege.phase !== 'BOMBARDMENT') {
      return {
        success: false,
        breached: false,
        attackerCasualties: 0,
        defenderCasualties: 0,
        wallProgress: 0,
        combatLog: ['돌격은 포격 또는 돌격 단계에서만 가능합니다'],
      };
    }
    
    const combatLog: string[] = [];
    let attackerCasualties = 0;
    let defenderCasualties = 0;
    
    // 돌격 유닛 수집
    const assaultingUnits = siege.attackerUnits.filter(u => assaultUnits.includes(u.unitId));
    if (assaultingUnits.length === 0) {
      return {
        success: false,
        breached: false,
        attackerCasualties: 0,
        defenderCasualties: 0,
        wallProgress: 0,
        combatLog: ['돌격 유닛을 지정해주세요'],
      };
    }
    
    combatLog.push(`[돌격 개시] ${assaultingUnits.length}개 부대 돌격 시작`);
    
    // 돌격 계산
    let totalAttackPower = 0;
    for (const unit of assaultingUnits) {
      totalAttackPower += unit.count * (unit.morale / 100);
      unit.position = 'WALL_BASE';
      unit.isEngaged = true;
    }
    
    // 방어 계산
    let totalDefensePower = 0;
    const defendingUnits = siege.defenderUnits.filter(
      u => u.position === 'WALL_TOP' || u.position === 'INNER_COURTYARD'
    );
    for (const unit of defendingUnits) {
      totalDefensePower += unit.count * (unit.morale / 100) * 1.5; // 방어 보너스
      unit.isEngaged = true;
    }
    
    // 포탑 보너스
    totalDefensePower += siege.fortressState.turrets.operational * 50;
    
    // 성벽 보너스
    totalDefensePower *= (siege.fortressState.wallIntegrity / 100);
    
    combatLog.push(`[전투력] 공격: ${Math.floor(totalAttackPower)}, 방어: ${Math.floor(totalDefensePower)}`);
    
    // 전투 해결
    const attackRatio = totalAttackPower / (totalDefensePower || 1);
    const success = attackRatio > 1.2;
    
    // 손실 계산
    for (const unit of assaultingUnits) {
      const casualtyRate = SIEGE_CONSTANTS.ASSAULT_CASUALTY_RATE * (1 / Math.max(0.5, attackRatio));
      const casualties = Math.floor(unit.count * casualtyRate);
      unit.count -= casualties;
      attackerCasualties += casualties;
      
      if (unit.count <= 0) {
        unit.count = 0;
      }
    }
    
    for (const unit of defendingUnits) {
      const casualtyRate = SIEGE_CONSTANTS.ASSAULT_CASUALTY_RATE * Math.min(2, attackRatio);
      const casualties = Math.floor(unit.count * casualtyRate * 0.5);
      unit.count -= casualties;
      defenderCasualties += casualties;
      
      if (unit.count <= 0) {
        unit.count = 0;
      }
    }
    
    combatLog.push(`[손실] 공격측: ${attackerCasualties}명, 방어측: ${defenderCasualties}명`);
    
    // 돌파구 생성 확인
    let breached = false;
    let breach: Breach | undefined;
    
    if (success && siege.fortressState.wallIntegrity <= SIEGE_CONSTANTS.BREACH_THRESHOLD) {
      breached = true;
      breach = {
        breachId: `BREACH-${uuidv4().slice(0, 6)}`,
        location: '주 성벽',
        size: attackRatio > 2 ? 'LARGE' : attackRatio > 1.5 ? 'MEDIUM' : 'SMALL',
        isSecured: false,
      };
      siege.fortressState.breaches.push(breach);
      siege.statistics.successfulBreaches++;
      
      combatLog.push(`[돌파!] ${breach.size} 크기의 돌파구 생성`);
    }
    
    // 성벽 피해 (돌격 시)
    const wallProgress = Math.floor(totalAttackPower / 50);
    siege.fortressState.wallIntegrity = Math.max(0, siege.fortressState.wallIntegrity - wallProgress);
    
    // 통계 업데이트
    siege.statistics.attackerCasualties += attackerCasualties;
    siege.statistics.defenderCasualties += defenderCasualties;
    siege.statistics.assaultAttempts++;
    siege.statistics.wallDamageDealt += wallProgress;
    
    // 이벤트 기록
    this.addEvent(siege, 'ASSAULT', 
      success ? '돌격 성공' : '돌격 실패');
    
    logger.info('[FortressSiegeService] Assault attempted', {
      siegeId,
      success,
      breached,
      attackerCasualties,
      defenderCasualties,
    });
    
    this.emit('siege:assault', {
      siegeId,
      success,
      breached,
    });
    
    return {
      success,
      breached,
      breach,
      attackerCasualties,
      defenderCasualties,
      wallProgress,
      combatLog,
    };
  }
  
  /**
   * 공성 무기 사용
   */
  useSiegeWeapon(
    siegeId: string,
    weaponId: string,
    target: 'WALL' | 'SHIELD' | 'TURRET' | 'UNIT'
  ): SiegeWeaponResult {
    const siege = this.activeSieges.get(siegeId);
    if (!siege) {
      throw new Error(`Siege not found: ${siegeId}`);
    }
    
    const weapon = siege.siegeWeapons.find(w => w.weaponId === weaponId);
    if (!weapon) {
      throw new Error(`Weapon not found: ${weaponId}`);
    }
    
    if (!weapon.isReady) {
      return {
        success: false,
        weaponId,
        weaponType: weapon.type,
        damage: 0,
        targetHit: false,
        effect: `쿨다운 중: ${weapon.currentCooldown} 틱 남음`,
        cooldownApplied: 0,
        ammoUsed: 0,
      };
    }
    
    if (weapon.ammoCount <= 0) {
      return {
        success: false,
        weaponId,
        weaponType: weapon.type,
        damage: 0,
        targetHit: false,
        effect: '탄약 부족',
        cooldownApplied: 0,
        ammoUsed: 0,
      };
    }
    
    // 명중 판정
    const hitRoll = Math.random() * 100;
    const targetHit = hitRoll <= weapon.accuracy;
    
    let damage = 0;
    let effect = '';
    
    if (targetHit) {
      damage = weapon.damage;
      
      switch (target) {
        case 'WALL':
          siege.fortressState.wallIntegrity = Math.max(0, 
            siege.fortressState.wallIntegrity - damage);
          effect = `성벽 피해: ${damage}%`;
          siege.statistics.wallDamageDealt += damage;
          break;
          
        case 'SHIELD':
          siege.fortressState.shieldStrength = Math.max(0,
            siege.fortressState.shieldStrength - damage);
          effect = `방어막 피해: ${damage}%`;
          siege.statistics.shieldDamageDealt += damage;
          break;
          
        case 'TURRET':
          if (siege.fortressState.turrets.operational > 0) {
            siege.fortressState.turrets.operational--;
            effect = '포탑 1기 파괴';
          } else {
            effect = '파괴할 포탑 없음';
          }
          break;
          
        case 'UNIT':
          const targetUnit = siege.defenderUnits.find(u => !u.isRouted && u.count > 0);
          if (targetUnit) {
            const casualties = Math.floor(targetUnit.count * damage / 100);
            targetUnit.count -= casualties;
            siege.statistics.defenderCasualties += casualties;
            effect = `적 부대 피해: ${casualties}명`;
          }
          break;
      }
    } else {
      effect = '빗나감';
    }
    
    // 쿨다운 및 탄약
    weapon.isReady = false;
    weapon.currentCooldown = weapon.maxCooldown;
    weapon.ammoCount--;
    
    siege.statistics.siegeWeaponsUsed++;
    siege.statistics.ammunitionExpended++;
    
    // 이벤트 기록
    this.addEvent(siege, 'WEAPON_USE', `${weapon.name} 사용: ${effect}`);
    
    logger.info('[FortressSiegeService] Siege weapon used', {
      siegeId,
      weaponType: weapon.type,
      target,
      targetHit,
      damage,
    });
    
    return {
      success: true,
      weaponId,
      weaponType: weapon.type,
      damage,
      targetHit,
      effect,
      cooldownApplied: weapon.maxCooldown,
      ammoUsed: 1,
    };
  }
  
  // ============================================================
  // Tick Processing
  // ============================================================
  
  /**
   * 틱 처리
   */
  processTick(siegeId: string): FortressSiege {
    const siege = this.activeSieges.get(siegeId);
    if (!siege || siege.status !== 'IN_PROGRESS') {
      throw new Error(`Active siege not found: ${siegeId}`);
    }
    
    siege.currentTick++;
    siege.statistics.totalDuration++;
    
    // 단계별 처리
    switch (siege.phase) {
      case 'ENCIRCLEMENT':
        this.processEncirclement(siege);
        break;
      case 'BOMBARDMENT':
        this.processBombardment(siege);
        break;
      case 'ASSAULT':
        // 수동 돌격 단계
        break;
      case 'BREACH':
        this.processBreach(siege);
        break;
      case 'CLEANUP':
        this.processCleanup(siege);
        break;
    }
    
    // 공통 처리
    this.processSupply(siege);
    this.processMorale(siege);
    this.processWeaponCooldowns(siege);
    
    // 승리/패배 조건 확인
    this.checkVictoryConditions(siege);
    
    // 시간 제한 확인
    if (siege.currentTick >= SIEGE_CONSTANTS.MAX_SIEGE_DURATION) {
      this.completeSiege(siege, 'DRAW');
    }
    
    return siege;
  }
  
  /**
   * 포위 단계 처리
   */
  private processEncirclement(siege: FortressSiege): void {
    // 포위도 증가
    const encirclingUnits = siege.attackerUnits.filter(
      u => u.position === 'OUTER_PERIMETER' || u.position === 'SIEGE_LINE'
    );
    const encirclementRate = SIEGE_CONSTANTS.BASE_ENCIRCLEMENT_RATE * 
      (encirclingUnits.length / Math.max(1, siege.defenderUnits.length));
    
    siege.encirclementLevel = Math.min(100, siege.encirclementLevel + encirclementRate);
    siege.phaseProgress = siege.encirclementLevel;
    
    // 보급 차단
    siege.supplyBlockade = siege.encirclementLevel * 0.8;
    
    // 자동 단계 진행 확인
    if (this.canAdvancePhase(siege)) {
      siege.phase = 'BOMBARDMENT';
      siege.phaseStartedAt = new Date();
      siege.phaseProgress = 0;
      this.addEvent(siege, 'PHASE_ADVANCE', '포격 단계 자동 진입');
    }
  }
  
  /**
   * 포격 단계 처리
   */
  private processBombardment(siege: FortressSiege): void {
    // 방어막 재생
    if (siege.fortressState.shieldGenerators.operational > 0) {
      const regenRate = SIEGE_CONSTANTS.SHIELD_REGEN_RATE * 
        siege.fortressState.shieldGenerators.operational;
      siege.fortressState.shieldStrength = Math.min(100, 
        siege.fortressState.shieldStrength + regenRate);
    }
    
    // 단계 진행도 업데이트
    siege.phaseProgress = 100 - siege.fortressState.wallIntegrity;
  }
  
  /**
   * 돌파 단계 처리
   */
  private processBreach(siege: FortressSiege): void {
    // 돌파구 확보 진행
    for (const breach of siege.fortressState.breaches) {
      if (!breach.isSecured) {
        const attackersAtBreach = siege.attackerUnits.filter(
          u => u.position === 'WALL_BASE'
        ).length;
        
        if (attackersAtBreach >= 2) {
          breach.isSecured = true;
          breach.securingFactionId = siege.attackerFactionId;
          
          // 내부 진입
          const enteringUnits = siege.attackerUnits
            .filter(u => u.position === 'WALL_BASE')
            .slice(0, 2);
          for (const unit of enteringUnits) {
            unit.position = 'INNER_COURTYARD';
          }
          
          this.addEvent(siege, 'BREACH_SECURED', `돌파구 확보: ${breach.location}`);
        }
      }
    }
    
    // 구역 장악 업데이트
    const attackersInCourtyard = siege.attackerUnits.filter(
      u => u.position === 'INNER_COURTYARD'
    );
    siege.fortressState.sectorControl.courtyard = Math.min(100,
      attackersInCourtyard.length * 20);
    
    siege.phaseProgress = siege.fortressState.sectorControl.courtyard;
  }
  
  /**
   * 소탕 단계 처리
   */
  private processCleanup(siege: FortressSiege): void {
    // 지휘소 장악 진행
    const attackersInCourtyard = siege.attackerUnits.filter(
      u => u.position === 'INNER_COURTYARD'
    );
    const defendersRemaining = siege.defenderUnits.filter(
      u => u.count > 0 && !u.isRouted
    );
    
    if (attackersInCourtyard.length > 0 && defendersRemaining.length === 0) {
      siege.fortressState.sectorControl.commandCenter += 10;
    } else if (attackersInCourtyard.length > defendersRemaining.length) {
      siege.fortressState.sectorControl.commandCenter += 5;
    }
    
    siege.fortressState.sectorControl.commandCenter = Math.min(100,
      siege.fortressState.sectorControl.commandCenter);
    
    siege.phaseProgress = siege.fortressState.sectorControl.commandCenter;
    
    // 승리 확인
    if (siege.fortressState.sectorControl.commandCenter >= SIEGE_CONSTANTS.CAPTURE_THRESHOLD) {
      this.completeSiege(siege, 'ATTACKER_VICTORY');
    }
  }
  
  /**
   * 보급 처리
   */
  private processSupply(siege: FortressSiege): void {
    // 방어측 보급 감소
    const supplyDrain = SIEGE_CONSTANTS.BASE_SUPPLY_DRAIN * (siege.supplyBlockade / 100);
    siege.fortressState.supplyLevel = Math.max(0, 
      siege.fortressState.supplyLevel - supplyDrain);
    
    // 보급 부족 시 사기 감소
    if (siege.fortressState.supplyLevel < 30) {
      siege.fortressState.garrisonMorale -= 2;
    }
  }
  
  /**
   * 사기 처리
   */
  private processMorale(siege: FortressSiege): void {
    // 포위 중 방어측 사기 감소
    if (siege.encirclementLevel >= 60) {
      siege.fortressState.garrisonMorale -= SIEGE_CONSTANTS.BASE_MORALE_DRAIN;
    }
    
    // 유닛별 사기 업데이트
    for (const unit of siege.defenderUnits) {
      unit.morale = Math.max(0, siege.fortressState.garrisonMorale);
      
      if (unit.morale <= 20) {
        unit.isRouted = true;
      }
    }
    
    // 항복 확인
    if (siege.fortressState.garrisonMorale <= SIEGE_CONSTANTS.SURRENDER_THRESHOLD) {
      this.completeSiege(siege, 'DEFENDER_SURRENDER');
    }
  }
  
  /**
   * 무기 쿨다운 처리
   */
  private processWeaponCooldowns(siege: FortressSiege): void {
    for (const weapon of siege.siegeWeapons) {
      if (weapon.currentCooldown > 0) {
        weapon.currentCooldown--;
        if (weapon.currentCooldown === 0) {
          weapon.isReady = true;
        }
      }
    }
  }
  
  /**
   * 승리 조건 확인
   */
  private checkVictoryConditions(siege: FortressSiege): void {
    // 공격측 전멸
    const aliveAttackers = siege.attackerUnits.filter(u => u.count > 0 && !u.isRouted);
    if (aliveAttackers.length === 0) {
      this.completeSiege(siege, 'DEFENDER_VICTORY');
      return;
    }
    
    // 방어측 전멸
    const aliveDefenders = siege.defenderUnits.filter(u => u.count > 0 && !u.isRouted);
    if (aliveDefenders.length === 0 && siege.fortressState.sectorControl.commandCenter < 50) {
      siege.fortressState.sectorControl.commandCenter = 50; // 방어군 전멸 시 자동 진행
    }
  }
  
  /**
   * 공성전 완료
   */
  private completeSiege(siege: FortressSiege, result: SiegeResult): void {
    siege.status = 'COMPLETED';
    siege.result = result;
    siege.endedAt = new Date();
    siege.statistics.phaseDurations[siege.phase] += siege.currentTick;
    
    this.addEvent(siege, 'SIEGE_END', `공성전 종료: ${this.getResultName(result)}`);
    
    logger.info('[FortressSiegeService] Siege completed', {
      siegeId: siege.siegeId,
      result,
      duration: siege.statistics.totalDuration,
    });
    
    this.emit('siege:completed', {
      siegeId: siege.siegeId,
      sessionId: siege.sessionId,
      fortressId: siege.fortressId,
      result,
      statistics: siege.statistics,
    });
  }
  
  /**
   * 결과 이름
   */
  private getResultName(result: SiegeResult): string {
    const names: Record<SiegeResult, string> = {
      ATTACKER_VICTORY: '공격측 승리',
      DEFENDER_VICTORY: '방어측 승리',
      DRAW: '무승부',
      ATTACKER_RETREAT: '공격측 철수',
      DEFENDER_SURRENDER: '방어측 항복',
    };
    return names[result];
  }
  
  // ============================================================
  // Event Logging
  // ============================================================
  
  /**
   * 이벤트 추가
   */
  private addEvent(siege: FortressSiege, eventType: string, description: string, data?: Record<string, unknown>): void {
    siege.eventLog.push({
      timestamp: new Date(),
      tick: siege.currentTick,
      phase: siege.phase,
      eventType,
      description,
      data,
    });
  }
  
  // ============================================================
  // Query Methods
  // ============================================================
  
  /**
   * 공성전 조회
   */
  getSiege(siegeId: string): FortressSiege | undefined {
    return this.activeSieges.get(siegeId);
  }
  
  /**
   * 세션의 공성전 목록 조회
   */
  getSessionSieges(sessionId: string): FortressSiege[] {
    return Array.from(this.activeSieges.values())
      .filter(s => s.sessionId === sessionId);
  }
  
  /**
   * 요새의 활성 공성전 조회
   */
  getActiveSiegeForFortress(fortressId: string): FortressSiege | undefined {
    return Array.from(this.activeSieges.values()).find(
      s => s.fortressId === fortressId && s.status === 'IN_PROGRESS'
    );
  }
  
  /**
   * 공성전 포기
   */
  abandonSiege(siegeId: string): FortressSiege {
    const siege = this.activeSieges.get(siegeId);
    if (!siege) {
      throw new Error(`Siege not found: ${siegeId}`);
    }
    
    siege.status = 'ABANDONED';
    siege.result = 'ATTACKER_RETREAT';
    siege.endedAt = new Date();
    
    this.addEvent(siege, 'SIEGE_ABANDONED', '공성전 포기');
    
    logger.info('[FortressSiegeService] Siege abandoned', { siegeId });
    
    this.emit('siege:abandoned', {
      siegeId,
      sessionId: siege.sessionId,
    });
    
    return siege;
  }
  
  /**
   * 공성전 삭제
   */
  removeSiege(siegeId: string): boolean {
    return this.activeSieges.delete(siegeId);
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const fortressSiegeService = FortressSiegeService.getInstance();





