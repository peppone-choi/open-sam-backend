import { EventEmitter } from 'events';
import { SpaceGridService, GridCell, SPACE_GRID_CONSTANTS } from './SpaceGridService';
import { StarSystemGridService, SystemZoneType } from './StarSystemGridService';
import { GalaxyGrid, GridTerrain, GRID_CONSTANTS } from '../../models/gin7/GalaxyGrid';
import { logger } from '../../common/logger';
import { getSocketManager } from '../../socket/socketManager';

/**
 * 유닛 타입
 */
export type MovementUnitType = 
  | 'CAPITAL_SHIP'      // 대형 전함 (전함, 순양함)
  | 'CRUISER'           // 순양함
  | 'DESTROYER'         // 구축함
  | 'FRIGATE'           // 호위함
  | 'SCOUT'             // 정찰함
  | 'TRANSPORT'         // 수송선
  | 'CARRIER'           // 항공모함
  | 'SUPPLY_SHIP'       // 보급함
  | 'LONE_SHIP'         // 독행함 (단독 함선)
  | 'FLEET'             // 함대
  | 'TASK_FORCE';       // 기동함대

/**
 * 이동 제한 타입
 */
export type RestrictionType = 
  | 'UNIT_COUNT'        // 유닛 수 제한
  | 'FACTION_COUNT'     // 진영 수 제한
  | 'UNIT_TYPE'         // 유닛 타입 제한
  | 'TERRAIN'           // 지형 제한
  | 'ZONE'              // 영역 제한
  | 'DIPLOMATIC'        // 외교 상태 제한
  | 'PERMIT'            // 통행 허가 제한
  | 'BLOCKADE'          // 봉쇄 상태
  | 'SUPPLY_LINE';      // 보급선 제한

/**
 * 이동 검증 결과
 */
export interface MovementValidationResult {
  allowed: boolean;
  restrictions: RestrictionViolation[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 제한 위반 상세
 */
export interface RestrictionViolation {
  type: RestrictionType;
  code: string;
  message: string;
  details: Record<string, any>;
}

/**
 * 통행 허가
 */
export interface PassPermit {
  permitId: string;
  sessionId: string;
  issuedTo: string;         // 유닛 ID 또는 진영 ID
  issuedBy: string;         // 발급 진영
  permitType: 'UNIT' | 'FACTION' | 'FLEET';
  validFrom: Date;
  validUntil: Date;
  allowedZones: string[];   // 허용 영역 (그리드 키 또는 성계 ID)
  restrictions: {
    maxUnits?: number;
    allowedMovementUnitTypes?: MovementUnitType[];
    excludedMovementUnitTypes?: MovementUnitType[];
  };
}

/**
 * 봉쇄 정보
 */
export interface Blockade {
  blockadeId: string;
  sessionId: string;
  enforcerId: string;       // 봉쇄 실행 진영
  targetGrids: Array<{ x: number; y: number; z: number }>;
  targetSystemId?: string;
  startedAt: Date;
  strength: number;         // 0-1 (봉쇄 강도)
  enforcingUnits: string[]; // 봉쇄 유지 유닛들
}

/**
 * 이동 제한 이벤트
 */
export const RESTRICTION_EVENTS = {
  MOVEMENT_BLOCKED: 'GIN7:MOVEMENT_BLOCKED',
  PERMIT_REQUIRED: 'GIN7:PERMIT_REQUIRED',
  PERMIT_GRANTED: 'GIN7:PERMIT_GRANTED',
  PERMIT_DENIED: 'GIN7:PERMIT_DENIED',
  PERMIT_EXPIRED: 'GIN7:PERMIT_EXPIRED',
  BLOCKADE_STARTED: 'GIN7:BLOCKADE_STARTED',
  BLOCKADE_BROKEN: 'GIN7:BLOCKADE_BROKEN',
  BLOCKADE_ENDED: 'GIN7:BLOCKADE_ENDED',
  GRID_FULL: 'GIN7:GRID_FULL',
  FACTION_LIMIT: 'GIN7:FACTION_LIMIT',
} as const;

/**
 * 이동 제한 상수
 */
export const RESTRICTION_CONSTANTS = {
  // 그리드 제한
  MAX_UNITS_PER_GRID: 300,
  MAX_FACTIONS_PER_GRID: 2,
  
  // 독행함 제한 (gin7manual 참조)
  LONE_SHIP: {
    ALLOWED_TERRAINS: ['normal', 'corridor'] as GridTerrain[],
    RESTRICTED_ZONES: ['INNER_ORBIT', 'ASTEROID_BELT'] as SystemZoneType[],
    MAX_IN_SYSTEM: 5,        // 성계당 최대 독행함 수
    DETECTION_CHANCE: 0.7,   // 탐지 확률
  } as const,
  
  // 함대 제한
  FLEET: {
    MIN_SIZE: 3,             // 최소 함선 수
    MAX_SIZE: 100,           // 최대 함선 수 (대함대)
    SUPPLY_REQUIREMENT: 10,  // 함선당 보급 필요량
  } as const,
  
  // 지형별 진입 제한
  TERRAIN_RESTRICTIONS: {
    normal: { allowAll: true },
    nebula: { 
      speedPenalty: 0.5,
      detectionPenalty: 0.5,
      restrictedTypes: [] as MovementUnitType[],
    },
    asteroid_field: {
      speedPenalty: 0.3,
      damageChance: 0.1,
      restrictedTypes: ['CAPITAL_SHIP', 'CARRIER'] as MovementUnitType[],
    },
    corridor: {
      speedBonus: 0.2,
      restrictedTypes: [] as MovementUnitType[],
    },
    black_hole: {
      forbidden: true,
      restrictedTypes: ['ALL'] as any[],
    },
  } as const,
  
  // 봉쇄 설정
  BLOCKADE: {
    MIN_UNITS: 5,            // 봉쇄 최소 유닛 수
    STRENGTH_PER_UNIT: 0.1,  // 유닛당 봉쇄 강도
    BREAK_THRESHOLD: 0.3,    // 돌파 가능 임계값
    MAINTENANCE_SUPPLY: 5,   // 유닛당 유지 보급
  } as const,
  
  // 보급선 제한
  SUPPLY_LINE: {
    MAX_DISTANCE: 10,        // 최대 보급 거리 (그리드)
    SUPPLY_DROP_RATE: 0.1,   // 거리당 보급 손실
  } as const,
} as const;

/**
 * MovementRestrictionService
 * 
 * 이동 제한 관리:
 * - 그리드 용량 제한 (유닛/진영 수)
 * - 유닛 타입별 진입 제한
 * - 지형별 제한
 * - 통행 허가 시스템
 * - 봉쇄 시스템
 */
export class MovementRestrictionService extends EventEmitter {
  private static instance: MovementRestrictionService;
  
  // 통행 허가 캐시: sessionId -> permitId -> permit
  private permits: Map<string, Map<string, PassPermit>> = new Map();
  
  // 봉쇄 캐시: sessionId -> blockadeId -> blockade
  private blockades: Map<string, Map<string, Blockade>> = new Map();
  
  // 유닛 타입 캐시: sessionId -> unitId -> MovementUnitType
  private unitTypes: Map<string, Map<string, MovementUnitType>> = new Map();

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): MovementRestrictionService {
    if (!MovementRestrictionService.instance) {
      MovementRestrictionService.instance = new MovementRestrictionService();
    }
    return MovementRestrictionService.instance;
  }

  /**
   * 서비스 초기화
   */
  public async initialize(): Promise<void> {
    logger.info('[MovementRestrictionService] Initialized');
  }

  /**
   * 서비스 종료
   */
  public async shutdown(): Promise<void> {
    this.permits.clear();
    this.blockades.clear();
    this.unitTypes.clear();
    logger.info('[MovementRestrictionService] Shutdown');
  }

  // ============================================================
  // 이동 검증
  // ============================================================

  /**
   * 이동 가능 여부 종합 검증
   */
  public async validateMovement(
    sessionId: string,
    unitId: string,
    factionId: string,
    from: { gridX: number; gridY: number; gridZ?: number },
    to: { gridX: number; gridY: number; gridZ?: number },
    unitType?: MovementUnitType
  ): Promise<MovementValidationResult> {
    const violations: RestrictionViolation[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const toZ = to.gridZ ?? 0;
    const resolvedMovementUnitType = unitType ?? this.getMovementUnitType(sessionId, unitId) ?? 'CRUISER';

    // 1. 그리드 용량 검증
    const capacityResult = await this.validateGridCapacity(sessionId, to.gridX, to.gridY, toZ, factionId);
    if (!capacityResult.allowed) {
      violations.push(...capacityResult.violations);
    }
    warnings.push(...capacityResult.warnings);

    // 2. 지형 제한 검증
    const terrainResult = await this.validateTerrainRestriction(sessionId, to.gridX, to.gridY, resolvedMovementUnitType);
    if (!terrainResult.allowed) {
      violations.push(...terrainResult.violations);
    }
    warnings.push(...terrainResult.warnings);

    // 3. 독행함 제한 검증
    if (resolvedMovementUnitType === 'LONE_SHIP') {
      const loneShipResult = await this.validateLoneShipRestriction(sessionId, to.gridX, to.gridY, toZ);
      if (!loneShipResult.allowed) {
        violations.push(...loneShipResult.violations);
      }
      warnings.push(...loneShipResult.warnings);
    }

    // 4. 봉쇄 검증
    const blockadeResult = await this.validateBlockade(sessionId, to.gridX, to.gridY, toZ, factionId);
    if (!blockadeResult.allowed) {
      violations.push(...blockadeResult.violations);
      suggestions.push('봉쇄를 돌파하거나 우회 경로를 찾으세요.');
    }

    // 5. 통행 허가 검증 (필요한 경우)
    const permitResult = await this.validatePermit(sessionId, unitId, factionId, to.gridX, to.gridY, toZ);
    if (!permitResult.allowed) {
      violations.push(...permitResult.violations);
      suggestions.push('해당 영역 진입을 위해 통행 허가를 요청하세요.');
    }

    return {
      allowed: violations.length === 0,
      restrictions: violations,
      warnings,
      suggestions,
    };
  }

  /**
   * 그리드 용량 검증
   */
  private async validateGridCapacity(
    sessionId: string,
    gridX: number,
    gridY: number,
    gridZ: number,
    factionId: string
  ): Promise<{ allowed: boolean; violations: RestrictionViolation[]; warnings: string[] }> {
    const violations: RestrictionViolation[] = [];
    const warnings: string[] = [];

    const grid = await GalaxyGrid.findOne({ sessionId, x: gridX, y: gridY });
    
    if (grid) {
      // 유닛 수 체크
      if (grid.occupants.length >= RESTRICTION_CONSTANTS.MAX_UNITS_PER_GRID) {
        violations.push({
          type: 'UNIT_COUNT',
          code: 'GIN7_E004',
          message: `그리드 (${gridX},${gridY})가 가득 찼습니다 (최대 ${RESTRICTION_CONSTANTS.MAX_UNITS_PER_GRID}유닛)`,
          details: {
            currentUnits: grid.occupants.length,
            maxUnits: RESTRICTION_CONSTANTS.MAX_UNITS_PER_GRID,
          },
        });
        
        this.emitRestrictionEvent(RESTRICTION_EVENTS.GRID_FULL, {
          sessionId,
          gridX,
          gridY,
          gridZ,
          currentUnits: grid.occupants.length,
        });
      } else if (grid.occupants.length >= RESTRICTION_CONSTANTS.MAX_UNITS_PER_GRID * 0.8) {
        warnings.push(`그리드 (${gridX},${gridY}) 용량이 80% 이상입니다`);
      }

      // 진영 수 체크
      const factionsInGrid = new Set(grid.ownerFactions);
      if (!factionsInGrid.has(factionId) && factionsInGrid.size >= RESTRICTION_CONSTANTS.MAX_FACTIONS_PER_GRID) {
        violations.push({
          type: 'FACTION_COUNT',
          code: 'GIN7_E004',
          message: `그리드 (${gridX},${gridY})에 이미 ${RESTRICTION_CONSTANTS.MAX_FACTIONS_PER_GRID}개 진영이 교전 중입니다`,
          details: {
            currentFactions: Array.from(factionsInGrid),
            maxFactions: RESTRICTION_CONSTANTS.MAX_FACTIONS_PER_GRID,
          },
        });
        
        this.emitRestrictionEvent(RESTRICTION_EVENTS.FACTION_LIMIT, {
          sessionId,
          gridX,
          gridY,
          gridZ,
          factions: Array.from(factionsInGrid),
        });
      }
    }

    return { allowed: violations.length === 0, violations, warnings };
  }

  /**
   * 지형 제한 검증
   */
  private async validateTerrainRestriction(
    sessionId: string,
    gridX: number,
    gridY: number,
    unitType: MovementUnitType
  ): Promise<{ allowed: boolean; violations: RestrictionViolation[]; warnings: string[] }> {
    const violations: RestrictionViolation[] = [];
    const warnings: string[] = [];

    const grid = await GalaxyGrid.findOne({ sessionId, x: gridX, y: gridY });
    const terrain = grid?.terrain || 'normal';
    
    const terrainRestriction = RESTRICTION_CONSTANTS.TERRAIN_RESTRICTIONS[terrain];

    // 진입 금지 지형
    if (terrainRestriction && 'forbidden' in terrainRestriction && terrainRestriction.forbidden) {
      violations.push({
        type: 'TERRAIN',
        code: 'TERRAIN_FORBIDDEN',
        message: `${terrain} 지형은 진입이 불가능합니다`,
        details: { terrain, gridX, gridY },
      });
      return { allowed: false, violations, warnings };
    }

    // 유닛 타입 제한
    if (terrainRestriction && 'restrictedTypes' in terrainRestriction) {
      const restricted = terrainRestriction.restrictedTypes;
      if (restricted.includes('ALL' as any) || restricted.includes(unitType)) {
        violations.push({
          type: 'UNIT_TYPE',
          code: 'UNIT_TYPE_RESTRICTED',
          message: `${unitType} 유닛은 ${terrain} 지형에 진입할 수 없습니다`,
          details: { terrain, unitType, gridX, gridY },
        });
      }
    }

    // 경고 (페널티가 있는 경우)
    if (terrainRestriction && 'speedPenalty' in terrainRestriction) {
      warnings.push(`${terrain} 지형에서 속도가 ${terrainRestriction.speedPenalty * 100}% 감소합니다`);
    }
    if (terrainRestriction && 'damageChance' in terrainRestriction) {
      warnings.push(`${terrain} 지형에서 ${terrainRestriction.damageChance * 100}% 확률로 피해를 입을 수 있습니다`);
    }

    return { allowed: violations.length === 0, violations, warnings };
  }

  /**
   * 독행함 제한 검증
   */
  private async validateLoneShipRestriction(
    sessionId: string,
    gridX: number,
    gridY: number,
    gridZ: number
  ): Promise<{ allowed: boolean; violations: RestrictionViolation[]; warnings: string[] }> {
    const violations: RestrictionViolation[] = [];
    const warnings: string[] = [];

    const grid = await GalaxyGrid.findOne({ sessionId, x: gridX, y: gridY });
    const terrain = grid?.terrain || 'normal';

    // 허용 지형 체크
    if (!RESTRICTION_CONSTANTS.LONE_SHIP.ALLOWED_TERRAINS.includes(terrain)) {
      violations.push({
        type: 'UNIT_TYPE',
        code: 'LONE_SHIP_TERRAIN',
        message: `독행함은 ${terrain} 지형에 진입할 수 없습니다`,
        details: { terrain, allowedTerrains: RESTRICTION_CONSTANTS.LONE_SHIP.ALLOWED_TERRAINS },
      });
    }

    // 성계 내 독행함 수 제한 (성계가 있는 그리드의 경우)
    if (grid?.starSystemIds && grid.starSystemIds.length > 0) {
      // 해당 성계의 독행함 수 카운트 (실제로는 유닛 정보 조회 필요)
      warnings.push(`성계 내 독행함은 최대 ${RESTRICTION_CONSTANTS.LONE_SHIP.MAX_IN_SYSTEM}척까지만 활동 가능합니다`);
    }

    // 탐지 경고
    warnings.push(`독행함 탐지 확률: ${RESTRICTION_CONSTANTS.LONE_SHIP.DETECTION_CHANCE * 100}%`);

    return { allowed: violations.length === 0, violations, warnings };
  }

  /**
   * 봉쇄 검증
   */
  private async validateBlockade(
    sessionId: string,
    gridX: number,
    gridY: number,
    gridZ: number,
    factionId: string
  ): Promise<{ allowed: boolean; violations: RestrictionViolation[]; warnings: string[] }> {
    const violations: RestrictionViolation[] = [];
    const warnings: string[] = [];

    const sessionBlockades = this.blockades.get(sessionId);
    if (!sessionBlockades) {
      return { allowed: true, violations, warnings };
    }

    for (const [, blockade] of sessionBlockades) {
      // 봉쇄 진영은 통과 가능
      if (blockade.enforcerId === factionId) continue;

      // 해당 그리드가 봉쇄 대상인지 확인
      const isTargeted = blockade.targetGrids.some(
        g => g.x === gridX && g.y === gridY && g.z === gridZ
      );

      if (isTargeted) {
        // 봉쇄 강도에 따른 통과 가능성
        if (blockade.strength >= RESTRICTION_CONSTANTS.BLOCKADE.BREAK_THRESHOLD) {
          violations.push({
            type: 'BLOCKADE',
            code: 'BLOCKADE_ACTIVE',
            message: `그리드 (${gridX},${gridY})가 ${blockade.enforcerId} 진영에 의해 봉쇄되었습니다`,
            details: {
              blockadeId: blockade.blockadeId,
              enforcer: blockade.enforcerId,
              strength: blockade.strength,
            },
          });
          
          this.emitRestrictionEvent(RESTRICTION_EVENTS.MOVEMENT_BLOCKED, {
            sessionId,
            gridX,
            gridY,
            gridZ,
            factionId,
            blockedBy: blockade.enforcerId,
            blockadeStrength: blockade.strength,
          });
        } else {
          warnings.push(`약한 봉쇄 중 (강도: ${blockade.strength * 100}%) - 돌파 가능`);
        }
      }
    }

    return { allowed: violations.length === 0, violations, warnings };
  }

  /**
   * 통행 허가 검증
   */
  private async validatePermit(
    sessionId: string,
    unitId: string,
    factionId: string,
    gridX: number,
    gridY: number,
    gridZ: number
  ): Promise<{ allowed: boolean; violations: RestrictionViolation[]; warnings: string[] }> {
    // 기본적으로 허가 필요 없음 (특별 구역 제외)
    // 실제 구현에서는 특별 보호 구역 등을 체크
    return { allowed: true, violations: [], warnings: [] };
  }

  // ============================================================
  // 통행 허가 관리
  // ============================================================

  /**
   * 통행 허가 발급
   */
  public issuePermit(
    sessionId: string,
    issuedTo: string,
    issuedBy: string,
    permitType: 'UNIT' | 'FACTION' | 'FLEET',
    durationHours: number,
    allowedZones: string[],
    restrictions?: {
      maxUnits?: number;
      allowedMovementUnitTypes?: MovementUnitType[];
      excludedMovementUnitTypes?: MovementUnitType[];
    }
  ): PassPermit {
    const permit: PassPermit = {
      permitId: `permit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      issuedTo,
      issuedBy,
      permitType,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + durationHours * 60 * 60 * 1000),
      allowedZones,
      restrictions: restrictions || {},
    };

    let sessionPermits = this.permits.get(sessionId);
    if (!sessionPermits) {
      sessionPermits = new Map();
      this.permits.set(sessionId, sessionPermits);
    }
    sessionPermits.set(permit.permitId, permit);

    this.emitRestrictionEvent(RESTRICTION_EVENTS.PERMIT_GRANTED, {
      sessionId,
      permitId: permit.permitId,
      issuedTo,
      issuedBy,
      validUntil: permit.validUntil,
    });

    logger.info(`[MovementRestrictionService] Permit ${permit.permitId} issued to ${issuedTo} by ${issuedBy}`);
    return permit;
  }

  /**
   * 통행 허가 취소
   */
  public revokePermit(sessionId: string, permitId: string): boolean {
    const sessionPermits = this.permits.get(sessionId);
    if (!sessionPermits) return false;
    
    const permit = sessionPermits.get(permitId);
    if (!permit) return false;

    sessionPermits.delete(permitId);

    this.emitRestrictionEvent(RESTRICTION_EVENTS.PERMIT_EXPIRED, {
      sessionId,
      permitId,
      issuedTo: permit.issuedTo,
    });

    return true;
  }

  /**
   * 유효한 통행 허가 조회
   */
  public getValidPermits(sessionId: string, entityId: string): PassPermit[] {
    const sessionPermits = this.permits.get(sessionId);
    if (!sessionPermits) return [];

    const now = new Date();
    return Array.from(sessionPermits.values()).filter(
      p => p.issuedTo === entityId && p.validUntil > now
    );
  }

  // ============================================================
  // 봉쇄 관리
  // ============================================================

  /**
   * 봉쇄 시작
   */
  public startBlockade(
    sessionId: string,
    enforcerId: string,
    targetGrids: Array<{ x: number; y: number; z: number }>,
    enforcingUnits: string[],
    targetSystemId?: string
  ): Blockade | null {
    // 최소 유닛 수 체크
    if (enforcingUnits.length < RESTRICTION_CONSTANTS.BLOCKADE.MIN_UNITS) {
      logger.warn(`[MovementRestrictionService] Blockade failed: need at least ${RESTRICTION_CONSTANTS.BLOCKADE.MIN_UNITS} units`);
      return null;
    }

    // 봉쇄 강도 계산
    const strength = Math.min(1, enforcingUnits.length * RESTRICTION_CONSTANTS.BLOCKADE.STRENGTH_PER_UNIT);

    const blockade: Blockade = {
      blockadeId: `blockade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      enforcerId,
      targetGrids,
      targetSystemId,
      startedAt: new Date(),
      strength,
      enforcingUnits,
    };

    let sessionBlockades = this.blockades.get(sessionId);
    if (!sessionBlockades) {
      sessionBlockades = new Map();
      this.blockades.set(sessionId, sessionBlockades);
    }
    sessionBlockades.set(blockade.blockadeId, blockade);

    this.emitRestrictionEvent(RESTRICTION_EVENTS.BLOCKADE_STARTED, {
      sessionId,
      blockadeId: blockade.blockadeId,
      enforcer: enforcerId,
      targetGrids,
      strength,
    });

    logger.info(`[MovementRestrictionService] Blockade ${blockade.blockadeId} started by ${enforcerId}`);
    return blockade;
  }

  /**
   * 봉쇄 종료
   */
  public endBlockade(sessionId: string, blockadeId: string): boolean {
    const sessionBlockades = this.blockades.get(sessionId);
    if (!sessionBlockades) return false;

    const blockade = sessionBlockades.get(blockadeId);
    if (!blockade) return false;

    sessionBlockades.delete(blockadeId);

    this.emitRestrictionEvent(RESTRICTION_EVENTS.BLOCKADE_ENDED, {
      sessionId,
      blockadeId,
      enforcer: blockade.enforcerId,
    });

    return true;
  }

  /**
   * 봉쇄 유닛 추가/제거
   */
  public updateBlockadeUnits(sessionId: string, blockadeId: string, units: string[]): boolean {
    const sessionBlockades = this.blockades.get(sessionId);
    if (!sessionBlockades) return false;

    const blockade = sessionBlockades.get(blockadeId);
    if (!blockade) return false;

    blockade.enforcingUnits = units;
    blockade.strength = Math.min(1, units.length * RESTRICTION_CONSTANTS.BLOCKADE.STRENGTH_PER_UNIT);

    // 유닛이 너무 적으면 봉쇄 해제
    if (units.length < RESTRICTION_CONSTANTS.BLOCKADE.MIN_UNITS) {
      this.emitRestrictionEvent(RESTRICTION_EVENTS.BLOCKADE_BROKEN, {
        sessionId,
        blockadeId,
        enforcer: blockade.enforcerId,
        reason: 'insufficient_units',
      });
      
      sessionBlockades.delete(blockadeId);
      return false;
    }

    return true;
  }

  /**
   * 그리드의 봉쇄 정보 조회
   */
  public getBlockadeAtGrid(sessionId: string, gridX: number, gridY: number, gridZ: number = 0): Blockade | null {
    const sessionBlockades = this.blockades.get(sessionId);
    if (!sessionBlockades) return null;

    for (const [, blockade] of sessionBlockades) {
      if (blockade.targetGrids.some(g => g.x === gridX && g.y === gridY && g.z === gridZ)) {
        return blockade;
      }
    }

    return null;
  }

  // ============================================================
  // 유닛 타입 관리
  // ============================================================

  /**
   * 유닛 타입 등록
   */
  public registerMovementUnitType(sessionId: string, unitId: string, unitType: MovementUnitType): void {
    let sessionMovementUnitTypes = this.unitTypes.get(sessionId);
    if (!sessionMovementUnitTypes) {
      sessionMovementUnitTypes = new Map();
      this.unitTypes.set(sessionId, sessionMovementUnitTypes);
    }
    sessionMovementUnitTypes.set(unitId, unitType);
  }

  /**
   * 유닛 타입 조회
   */
  public getMovementUnitType(sessionId: string, unitId: string): MovementUnitType | null {
    const sessionMovementUnitTypes = this.unitTypes.get(sessionId);
    if (!sessionMovementUnitTypes) return null;
    return sessionMovementUnitTypes.get(unitId) || null;
  }

  // ============================================================
  // 캐시 관리
  // ============================================================

  /**
   * 세션 캐시 클리어
   */
  public clearSessionCache(sessionId: string): void {
    this.permits.delete(sessionId);
    this.blockades.delete(sessionId);
    this.unitTypes.delete(sessionId);
    logger.info(`[MovementRestrictionService] Cleared cache for session ${sessionId}`);
  }

  /**
   * 만료된 허가 정리
   */
  public cleanupExpiredPermits(sessionId: string): number {
    const sessionPermits = this.permits.get(sessionId);
    if (!sessionPermits) return 0;

    const now = new Date();
    let removed = 0;

    for (const [permitId, permit] of sessionPermits) {
      if (permit.validUntil < now) {
        sessionPermits.delete(permitId);
        removed++;
        
        this.emitRestrictionEvent(RESTRICTION_EVENTS.PERMIT_EXPIRED, {
          sessionId,
          permitId,
          issuedTo: permit.issuedTo,
        });
      }
    }

    return removed;
  }

  // ============================================================
  // 이벤트 발송
  // ============================================================

  private emitRestrictionEvent(eventName: string, payload: any): void {
    this.emit(eventName, payload);
    
    const socketManager = getSocketManager();
    if (socketManager && payload.sessionId) {
      socketManager.getIO().to(`session:${payload.sessionId}`).emit(eventName, payload);
    }
  }
}

// 싱글톤 getter
export function getMovementRestrictionService(): MovementRestrictionService {
  return MovementRestrictionService.getInstance();
}





