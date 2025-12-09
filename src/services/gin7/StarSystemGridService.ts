import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { StarSystem, IStarSystem } from '../../models/gin7/StarSystem';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';
import { getSocketManager } from '../../socket/socketManager';

/**
 * 성계 내부 영역 타입
 */
export type SystemZoneType = 
  | 'INNER_ORBIT'       // 내궤도 (수성~금성 위치)
  | 'HABITABLE_ZONE'    // 생명체 거주 가능 영역
  | 'OUTER_ORBIT'       // 외궤도 (목성 이후)
  | 'ASTEROID_BELT'     // 소행성대
  | 'KUIPER_BELT'       // 카이퍼 벨트 (외곽)
  | 'JUMP_POINT'        // 점프 포인트 (워프 진입/이탈)
  | 'DEEP_SPACE'        // 성계 외곽 빈 공간
  | 'STATION_ZONE';     // 우주정거장 영역

/**
 * 점프 포인트 인터페이스
 */
export interface JumpPoint {
  pointId: string;
  systemId: string;
  name: string;
  position: {
    localX: number;     // 성계 내 x좌표 (0-1000)
    localY: number;     // 성계 내 y좌표 (0-1000)
  };
  linkedSystemId?: string;  // 연결된 성계 (고정 경로)
  linkedPointId?: string;   // 연결된 점프 포인트
  isActive: boolean;
  capacity: number;         // 동시 사용 가능 유닛 수
  cooldownTicks: number;    // 사용 후 쿨다운
  currentUsers: string[];   // 현재 사용 중인 유닛 IDs
  lastUsedAt?: Date;
}

/**
 * 성계 내 위치 인터페이스
 */
export interface SystemLocation {
  systemId: string;
  zone: SystemZoneType;
  localX: number;
  localY: number;
  planetId?: string;      // 행성 근처인 경우
  orbitLevel?: number;    // 궤도 레벨 (1=저궤도, 2=중궤도, 3=고궤도)
  jumpPointId?: string;   // 점프 포인트 근처인 경우
}

/**
 * 성계 내부 영역
 */
export interface SystemZone {
  zoneId: string;
  systemId: string;
  type: SystemZoneType;
  bounds: {
    innerRadius: number;  // 내부 반경 (중심에서)
    outerRadius: number;  // 외부 반경
    startAngle?: number;  // 특정 구역의 경우 시작 각도 (도)
    endAngle?: number;    // 종료 각도
  };
  modifiers: {
    movementSpeed: number;      // 1.0 = 기본
    sensorRange: number;        // 1.0 = 기본
    weaponAccuracy: number;     // 1.0 = 기본
    shieldEfficiency: number;   // 1.0 = 기본
  };
  hazards: {
    radiation: number;          // 0-1 (방사선)
    debris: number;             // 0-1 (파편 충돌 위험)
    gravityWell: number;        // 0-1 (중력 영향)
  };
  occupants: string[];          // 유닛 IDs
}

/**
 * 이동 시간 계산 결과
 */
export interface TravelTimeResult {
  baseTicks: number;
  modifiedTicks: number;
  speedModifier: number;
  hazardDelay: number;
  totalTicks: number;
}

/**
 * 성계 그리드 이벤트
 */
export const SYSTEM_GRID_EVENTS = {
  ZONE_ENTERED: 'GIN7:ZONE_ENTERED',
  ZONE_LEFT: 'GIN7:ZONE_LEFT',
  JUMP_POINT_ACTIVATED: 'GIN7:JUMP_POINT_ACTIVATED',
  JUMP_POINT_USED: 'GIN7:JUMP_POINT_USED',
  JUMP_POINT_COOLDOWN: 'GIN7:JUMP_POINT_COOLDOWN',
  HAZARD_DAMAGE: 'GIN7:HAZARD_DAMAGE',
  ORBIT_ENTERED: 'GIN7:ORBIT_ENTERED',
  ORBIT_LEFT: 'GIN7:ORBIT_LEFT',
} as const;

/**
 * 성계 그리드 상수
 */
export const SYSTEM_GRID_CONSTANTS = {
  // 성계 내부 좌표 범위
  SYSTEM_SIZE: 1000,
  
  // 영역 반경 (중심 0에서)
  ZONE_RADII: {
    INNER_ORBIT: { inner: 0, outer: 100 },
    HABITABLE_ZONE: { inner: 100, outer: 300 },
    ASTEROID_BELT: { inner: 300, outer: 400 },
    OUTER_ORBIT: { inner: 400, outer: 600 },
    KUIPER_BELT: { inner: 600, outer: 800 },
    DEEP_SPACE: { inner: 800, outer: 1000 },
  } as const,
  
  // 기본 이동 시간 (틱)
  BASE_TRANSIT_TIME: {
    SAME_ZONE: 1,
    ADJACENT_ZONE: 3,
    CROSS_SYSTEM: 5,
    TO_JUMP_POINT: 2,
  } as const,
  
  // 점프 포인트 설정
  JUMP_POINT: {
    DEFAULT_CAPACITY: 10,
    DEFAULT_COOLDOWN: 5,
    STANDARD_POSITIONS: [
      { angle: 0, radius: 850 },    // 북
      { angle: 90, radius: 850 },   // 동
      { angle: 180, radius: 850 },  // 남
      { angle: 270, radius: 850 },  // 서
    ],
  } as const,
  
  // 영역별 수정치
  ZONE_MODIFIERS: {
    INNER_ORBIT: {
      movementSpeed: 0.8,
      sensorRange: 1.2,
      weaponAccuracy: 1.0,
      shieldEfficiency: 0.9,
    },
    HABITABLE_ZONE: {
      movementSpeed: 1.0,
      sensorRange: 1.0,
      weaponAccuracy: 1.0,
      shieldEfficiency: 1.0,
    },
    ASTEROID_BELT: {
      movementSpeed: 0.6,
      sensorRange: 0.7,
      weaponAccuracy: 0.8,
      shieldEfficiency: 1.0,
    },
    OUTER_ORBIT: {
      movementSpeed: 1.1,
      sensorRange: 0.9,
      weaponAccuracy: 1.0,
      shieldEfficiency: 1.0,
    },
    KUIPER_BELT: {
      movementSpeed: 0.7,
      sensorRange: 0.6,
      weaponAccuracy: 0.9,
      shieldEfficiency: 1.0,
    },
    DEEP_SPACE: {
      movementSpeed: 1.2,
      sensorRange: 0.5,
      weaponAccuracy: 1.0,
      shieldEfficiency: 1.0,
    },
    JUMP_POINT: {
      movementSpeed: 1.0,
      sensorRange: 1.0,
      weaponAccuracy: 1.0,
      shieldEfficiency: 1.0,
    },
    STATION_ZONE: {
      movementSpeed: 0.9,
      sensorRange: 1.3,
      weaponAccuracy: 1.0,
      shieldEfficiency: 1.0,
    },
  } as const,
  
  // 영역별 위험도
  ZONE_HAZARDS: {
    INNER_ORBIT: { radiation: 0.3, debris: 0.1, gravityWell: 0.4 },
    HABITABLE_ZONE: { radiation: 0.1, debris: 0.05, gravityWell: 0.1 },
    ASTEROID_BELT: { radiation: 0.05, debris: 0.5, gravityWell: 0.05 },
    OUTER_ORBIT: { radiation: 0.05, debris: 0.1, gravityWell: 0.05 },
    KUIPER_BELT: { radiation: 0.02, debris: 0.3, gravityWell: 0.02 },
    DEEP_SPACE: { radiation: 0.01, debris: 0.01, gravityWell: 0 },
    JUMP_POINT: { radiation: 0.1, debris: 0.02, gravityWell: 0.1 },
    STATION_ZONE: { radiation: 0.05, debris: 0.05, gravityWell: 0.05 },
  } as const,
} as const;

/**
 * StarSystemGridService
 * 
 * 성계 내부 그리드 관리:
 * - 성계 영역(Zone) 관리
 * - 점프 포인트 관리
 * - 성계 내 이동 시간 계산
 * - 행성 궤도 진입/이탈
 */
export class StarSystemGridService extends EventEmitter {
  private static instance: StarSystemGridService;
  
  // 캐시: sessionId -> systemId -> zones
  private systemZonesCache: Map<string, Map<string, SystemZone[]>> = new Map();
  // 캐시: sessionId -> systemId -> jumpPoints
  private jumpPointsCache: Map<string, Map<string, JumpPoint[]>> = new Map();

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): StarSystemGridService {
    if (!StarSystemGridService.instance) {
      StarSystemGridService.instance = new StarSystemGridService();
    }
    return StarSystemGridService.instance;
  }

  /**
   * 서비스 초기화
   */
  public async initialize(): Promise<void> {
    logger.info('[StarSystemGridService] Initialized');
  }

  /**
   * 서비스 종료
   */
  public async shutdown(): Promise<void> {
    this.systemZonesCache.clear();
    this.jumpPointsCache.clear();
    logger.info('[StarSystemGridService] Shutdown');
  }

  // ============================================================
  // 성계 영역 관리
  // ============================================================

  /**
   * 성계 영역 초기화 (성계 생성 시 호출)
   */
  public async initializeSystemZones(sessionId: string, systemId: string): Promise<SystemZone[]> {
    const zones: SystemZone[] = [];
    
    // 각 영역 타입별로 Zone 생성
    const zoneTypes: SystemZoneType[] = [
      'INNER_ORBIT', 'HABITABLE_ZONE', 'ASTEROID_BELT', 
      'OUTER_ORBIT', 'KUIPER_BELT', 'DEEP_SPACE'
    ];

    for (const type of zoneTypes) {
      const radii = SYSTEM_GRID_CONSTANTS.ZONE_RADII[type];
      const modifiers = SYSTEM_GRID_CONSTANTS.ZONE_MODIFIERS[type];
      const hazards = SYSTEM_GRID_CONSTANTS.ZONE_HAZARDS[type];

      const zone: SystemZone = {
        zoneId: uuidv4(),
        systemId,
        type,
        bounds: {
          innerRadius: radii.inner,
          outerRadius: radii.outer,
        },
        modifiers: { ...modifiers },
        hazards: { ...hazards },
        occupants: [],
      };

      zones.push(zone);
    }

    // 캐시 저장
    this.setSystemZonesCache(sessionId, systemId, zones);
    
    logger.info(`[StarSystemGridService] Initialized ${zones.length} zones for system ${systemId}`);
    return zones;
  }

  /**
   * 좌표로 영역 타입 결정
   */
  public getZoneTypeFromCoordinates(localX: number, localY: number): SystemZoneType {
    // 중심(500, 500)에서의 거리 계산
    const centerX = SYSTEM_GRID_CONSTANTS.SYSTEM_SIZE / 2;
    const centerY = SYSTEM_GRID_CONSTANTS.SYSTEM_SIZE / 2;
    const distance = Math.sqrt(
      Math.pow(localX - centerX, 2) + Math.pow(localY - centerY, 2)
    );

    // 거리에 따른 영역 결정
    const radii = SYSTEM_GRID_CONSTANTS.ZONE_RADII;
    
    if (distance <= radii.INNER_ORBIT.outer) return 'INNER_ORBIT';
    if (distance <= radii.HABITABLE_ZONE.outer) return 'HABITABLE_ZONE';
    if (distance <= radii.ASTEROID_BELT.outer) return 'ASTEROID_BELT';
    if (distance <= radii.OUTER_ORBIT.outer) return 'OUTER_ORBIT';
    if (distance <= radii.KUIPER_BELT.outer) return 'KUIPER_BELT';
    return 'DEEP_SPACE';
  }

  /**
   * 영역 정보 조회
   */
  public async getZone(
    sessionId: string,
    systemId: string,
    zoneType: SystemZoneType
  ): Promise<SystemZone | null> {
    const zones = await this.getSystemZones(sessionId, systemId);
    return zones.find(z => z.type === zoneType) || null;
  }

  /**
   * 성계의 모든 영역 조회
   */
  public async getSystemZones(sessionId: string, systemId: string): Promise<SystemZone[]> {
    // 캐시 확인
    const cached = this.getSystemZonesCache(sessionId, systemId);
    if (cached) {
      return cached;
    }

    // 없으면 새로 생성
    return await this.initializeSystemZones(sessionId, systemId);
  }

  /**
   * 영역에 유닛 추가
   */
  public async addUnitToZone(
    sessionId: string,
    systemId: string,
    zoneType: SystemZoneType,
    unitId: string
  ): Promise<void> {
    const zone = await this.getZone(sessionId, systemId, zoneType);
    if (zone && !zone.occupants.includes(unitId)) {
      zone.occupants.push(unitId);
      
      this.emitSystemEvent(SYSTEM_GRID_EVENTS.ZONE_ENTERED, {
        sessionId,
        systemId,
        zoneType,
        unitId,
        modifiers: zone.modifiers,
        hazards: zone.hazards,
      });
    }
  }

  /**
   * 영역에서 유닛 제거
   */
  public async removeUnitFromZone(
    sessionId: string,
    systemId: string,
    zoneType: SystemZoneType,
    unitId: string
  ): Promise<void> {
    const zone = await this.getZone(sessionId, systemId, zoneType);
    if (zone) {
      zone.occupants = zone.occupants.filter(id => id !== unitId);
      
      this.emitSystemEvent(SYSTEM_GRID_EVENTS.ZONE_LEFT, {
        sessionId,
        systemId,
        zoneType,
        unitId,
      });
    }
  }

  // ============================================================
  // 점프 포인트 관리
  // ============================================================

  /**
   * 성계 점프 포인트 초기화
   */
  public async initializeJumpPoints(sessionId: string, systemId: string): Promise<JumpPoint[]> {
    const jumpPoints: JumpPoint[] = [];
    const positions = SYSTEM_GRID_CONSTANTS.JUMP_POINT.STANDARD_POSITIONS;
    const centerX = SYSTEM_GRID_CONSTANTS.SYSTEM_SIZE / 2;
    const centerY = SYSTEM_GRID_CONSTANTS.SYSTEM_SIZE / 2;
    
    const directions = ['North', 'East', 'South', 'West'];

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const angleRad = (pos.angle * Math.PI) / 180;
      
      const jumpPoint: JumpPoint = {
        pointId: uuidv4(),
        systemId,
        name: `${directions[i]} Jump Point`,
        position: {
          localX: Math.round(centerX + pos.radius * Math.cos(angleRad)),
          localY: Math.round(centerY + pos.radius * Math.sin(angleRad)),
        },
        isActive: true,
        capacity: SYSTEM_GRID_CONSTANTS.JUMP_POINT.DEFAULT_CAPACITY,
        cooldownTicks: SYSTEM_GRID_CONSTANTS.JUMP_POINT.DEFAULT_COOLDOWN,
        currentUsers: [],
      };

      jumpPoints.push(jumpPoint);
    }

    // 캐시 저장
    this.setJumpPointsCache(sessionId, systemId, jumpPoints);
    
    logger.info(`[StarSystemGridService] Initialized ${jumpPoints.length} jump points for system ${systemId}`);
    return jumpPoints;
  }

  /**
   * 성계 점프 포인트 조회
   */
  public async getJumpPoints(sessionId: string, systemId: string): Promise<JumpPoint[]> {
    const cached = this.getJumpPointsCache(sessionId, systemId);
    if (cached) {
      return cached;
    }
    return await this.initializeJumpPoints(sessionId, systemId);
  }

  /**
   * 가장 가까운 점프 포인트 찾기
   */
  public async findNearestJumpPoint(
    sessionId: string,
    systemId: string,
    localX: number,
    localY: number
  ): Promise<JumpPoint | null> {
    const jumpPoints = await this.getJumpPoints(sessionId, systemId);
    if (jumpPoints.length === 0) return null;

    let nearest: JumpPoint | null = null;
    let minDistance = Infinity;

    for (const jp of jumpPoints) {
      if (!jp.isActive) continue;
      
      const distance = Math.sqrt(
        Math.pow(jp.position.localX - localX, 2) +
        Math.pow(jp.position.localY - localY, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = jp;
      }
    }

    return nearest;
  }

  /**
   * 점프 포인트 사용
   */
  public async useJumpPoint(
    sessionId: string,
    systemId: string,
    jumpPointId: string,
    unitId: string
  ): Promise<{ success: boolean; error?: string; linkedPoint?: JumpPoint }> {
    const jumpPoints = await this.getJumpPoints(sessionId, systemId);
    const jumpPoint = jumpPoints.find(jp => jp.pointId === jumpPointId);

    if (!jumpPoint) {
      return { success: false, error: 'Jump point not found' };
    }

    if (!jumpPoint.isActive) {
      return { success: false, error: 'Jump point is not active' };
    }

    if (jumpPoint.currentUsers.length >= jumpPoint.capacity) {
      return { success: false, error: 'Jump point at capacity' };
    }

    // 쿨다운 체크
    if (jumpPoint.lastUsedAt) {
      const elapsed = (Date.now() - jumpPoint.lastUsedAt.getTime()) / 1000;
      if (elapsed < jumpPoint.cooldownTicks) {
        return { 
          success: false, 
          error: `Jump point on cooldown (${Math.ceil(jumpPoint.cooldownTicks - elapsed)} ticks remaining)` 
        };
      }
    }

    // 사용 등록
    jumpPoint.currentUsers.push(unitId);
    jumpPoint.lastUsedAt = new Date();

    this.emitSystemEvent(SYSTEM_GRID_EVENTS.JUMP_POINT_USED, {
      sessionId,
      systemId,
      jumpPointId,
      unitId,
      linkedSystemId: jumpPoint.linkedSystemId,
      linkedPointId: jumpPoint.linkedPointId,
    });

    // 연결된 점프 포인트 반환
    let linkedPoint: JumpPoint | undefined;
    if (jumpPoint.linkedSystemId && jumpPoint.linkedPointId) {
      const linkedPoints = await this.getJumpPoints(sessionId, jumpPoint.linkedSystemId);
      linkedPoint = linkedPoints.find(jp => jp.pointId === jumpPoint.linkedPointId);
    }

    return { success: true, linkedPoint };
  }

  /**
   * 점프 포인트 사용 완료 (유닛 제거)
   */
  public async releaseJumpPoint(
    sessionId: string,
    systemId: string,
    jumpPointId: string,
    unitId: string
  ): Promise<void> {
    const jumpPoints = await this.getJumpPoints(sessionId, systemId);
    const jumpPoint = jumpPoints.find(jp => jp.pointId === jumpPointId);

    if (jumpPoint) {
      jumpPoint.currentUsers = jumpPoint.currentUsers.filter(id => id !== unitId);
    }
  }

  /**
   * 두 성계 점프 포인트 연결
   */
  public async linkJumpPoints(
    sessionId: string,
    systemId1: string,
    pointId1: string,
    systemId2: string,
    pointId2: string
  ): Promise<boolean> {
    const points1 = await this.getJumpPoints(sessionId, systemId1);
    const points2 = await this.getJumpPoints(sessionId, systemId2);

    const jp1 = points1.find(jp => jp.pointId === pointId1);
    const jp2 = points2.find(jp => jp.pointId === pointId2);

    if (!jp1 || !jp2) {
      return false;
    }

    jp1.linkedSystemId = systemId2;
    jp1.linkedPointId = pointId2;
    jp2.linkedSystemId = systemId1;
    jp2.linkedPointId = pointId1;

    logger.info(`[StarSystemGridService] Linked jump points: ${systemId1}/${pointId1} <-> ${systemId2}/${pointId2}`);
    return true;
  }

  // ============================================================
  // 성계 내 이동 시간 계산
  // ============================================================

  /**
   * 성계 내 이동 시간 계산
   */
  public async calculateTravelTime(
    sessionId: string,
    systemId: string,
    fromLocation: SystemLocation,
    toLocation: SystemLocation,
    engineLevel: number = 1
  ): Promise<TravelTimeResult> {
    // 같은 영역 내 이동
    if (fromLocation.zone === toLocation.zone) {
      const baseTicks = SYSTEM_GRID_CONSTANTS.BASE_TRANSIT_TIME.SAME_ZONE;
      const zoneModifiers = SYSTEM_GRID_CONSTANTS.ZONE_MODIFIERS[fromLocation.zone];
      const speedModifier = zoneModifiers.movementSpeed;
      const engineBonus = 1 + (engineLevel * 0.1);
      
      const hazards = SYSTEM_GRID_CONSTANTS.ZONE_HAZARDS[fromLocation.zone];
      const hazardDelay = Math.ceil(hazards.debris * 2); // 파편 위험은 지연 유발

      const modifiedTicks = Math.max(1, Math.ceil(baseTicks / (speedModifier * engineBonus)));
      
      return {
        baseTicks,
        modifiedTicks,
        speedModifier,
        hazardDelay,
        totalTicks: modifiedTicks + hazardDelay,
      };
    }

    // 점프 포인트로 이동
    if (toLocation.zone === 'JUMP_POINT') {
      const baseTicks = SYSTEM_GRID_CONSTANTS.BASE_TRANSIT_TIME.TO_JUMP_POINT;
      const fromModifiers = SYSTEM_GRID_CONSTANTS.ZONE_MODIFIERS[fromLocation.zone];
      const speedModifier = fromModifiers.movementSpeed;
      const engineBonus = 1 + (engineLevel * 0.1);

      const hazards = SYSTEM_GRID_CONSTANTS.ZONE_HAZARDS[fromLocation.zone];
      const hazardDelay = Math.ceil(hazards.debris * 2);

      const modifiedTicks = Math.max(1, Math.ceil(baseTicks / (speedModifier * engineBonus)));

      return {
        baseTicks,
        modifiedTicks,
        speedModifier,
        hazardDelay,
        totalTicks: modifiedTicks + hazardDelay,
      };
    }

    // 인접 영역 간 이동
    const zoneOrder: SystemZoneType[] = [
      'INNER_ORBIT', 'HABITABLE_ZONE', 'ASTEROID_BELT',
      'OUTER_ORBIT', 'KUIPER_BELT', 'DEEP_SPACE'
    ];
    const fromIndex = zoneOrder.indexOf(fromLocation.zone);
    const toIndex = zoneOrder.indexOf(toLocation.zone);
    const zoneDiff = Math.abs(toIndex - fromIndex);

    const isAdjacent = zoneDiff === 1;
    const baseTicks = isAdjacent 
      ? SYSTEM_GRID_CONSTANTS.BASE_TRANSIT_TIME.ADJACENT_ZONE
      : SYSTEM_GRID_CONSTANTS.BASE_TRANSIT_TIME.CROSS_SYSTEM * zoneDiff;

    // 평균 수정치 계산
    const fromModifiers = SYSTEM_GRID_CONSTANTS.ZONE_MODIFIERS[fromLocation.zone];
    const toModifiers = SYSTEM_GRID_CONSTANTS.ZONE_MODIFIERS[toLocation.zone];
    const avgSpeedMod = (fromModifiers.movementSpeed + toModifiers.movementSpeed) / 2;
    const engineBonus = 1 + (engineLevel * 0.1);

    // 위험도 계산 (경로상 최대값)
    const fromHazards = SYSTEM_GRID_CONSTANTS.ZONE_HAZARDS[fromLocation.zone];
    const toHazards = SYSTEM_GRID_CONSTANTS.ZONE_HAZARDS[toLocation.zone];
    const maxDebris = Math.max(fromHazards.debris, toHazards.debris);
    const hazardDelay = Math.ceil(maxDebris * 3);

    const modifiedTicks = Math.max(1, Math.ceil(baseTicks / (avgSpeedMod * engineBonus)));

    return {
      baseTicks,
      modifiedTicks,
      speedModifier: avgSpeedMod,
      hazardDelay,
      totalTicks: modifiedTicks + hazardDelay,
    };
  }

  /**
   * 행성 궤도까지 이동 시간 계산
   */
  public async calculateOrbitApproachTime(
    sessionId: string,
    systemId: string,
    planetId: string,
    currentLocation: SystemLocation,
    engineLevel: number = 1
  ): Promise<TravelTimeResult> {
    // 행성 정보 조회
    const planet = await Planet.findOne({ sessionId, planetId, systemId });
    if (!planet) {
      throw new Error('Planet not found');
    }

    // 행성 궤도 인덱스로 위치 추정 (orbitIndex: 1-20)
    // 궤도 인덱스가 낮을수록 중심에 가까움
    const orbitRadius = 100 + (planet.orbitIndex * 40); // 100~900 범위
    const centerX = SYSTEM_GRID_CONSTANTS.SYSTEM_SIZE / 2;
    const centerY = SYSTEM_GRID_CONSTANTS.SYSTEM_SIZE / 2;
    
    // 행성 위치 계산 (간단히 x축에 배치)
    const planetX = centerX + orbitRadius;
    const planetY = centerY;

    // 행성 위치의 영역 결정
    const planetZone = this.getZoneTypeFromCoordinates(planetX, planetY);

    const toLocation: SystemLocation = {
      systemId,
      zone: planetZone,
      localX: planetX,
      localY: planetY,
      planetId,
    };

    return this.calculateTravelTime(sessionId, systemId, currentLocation, toLocation, engineLevel);
  }

  // ============================================================
  // 캐시 관리
  // ============================================================

  private getSystemZonesCache(sessionId: string, systemId: string): SystemZone[] | null {
    const sessionCache = this.systemZonesCache.get(sessionId);
    if (!sessionCache) return null;
    return sessionCache.get(systemId) || null;
  }

  private setSystemZonesCache(sessionId: string, systemId: string, zones: SystemZone[]): void {
    let sessionCache = this.systemZonesCache.get(sessionId);
    if (!sessionCache) {
      sessionCache = new Map();
      this.systemZonesCache.set(sessionId, sessionCache);
    }
    sessionCache.set(systemId, zones);
  }

  private getJumpPointsCache(sessionId: string, systemId: string): JumpPoint[] | null {
    const sessionCache = this.jumpPointsCache.get(sessionId);
    if (!sessionCache) return null;
    return sessionCache.get(systemId) || null;
  }

  private setJumpPointsCache(sessionId: string, systemId: string, jumpPoints: JumpPoint[]): void {
    let sessionCache = this.jumpPointsCache.get(sessionId);
    if (!sessionCache) {
      sessionCache = new Map();
      this.jumpPointsCache.set(sessionId, sessionCache);
    }
    sessionCache.set(systemId, jumpPoints);
  }

  /**
   * 세션 캐시 클리어
   */
  public clearSessionCache(sessionId: string): void {
    this.systemZonesCache.delete(sessionId);
    this.jumpPointsCache.delete(sessionId);
    logger.info(`[StarSystemGridService] Cleared cache for session ${sessionId}`);
  }

  // ============================================================
  // 이벤트 발송
  // ============================================================

  private emitSystemEvent(eventName: string, payload: any): void {
    this.emit(eventName, payload);
    
    const socketManager = getSocketManager();
    if (socketManager && payload.sessionId) {
      socketManager.getIO().to(`session:${payload.sessionId}`).emit(eventName, payload);
    }
  }
}

// 싱글톤 getter
export function getStarSystemGridService(): StarSystemGridService {
  return StarSystemGridService.getInstance();
}

