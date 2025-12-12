import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WarpNavigationService, WARP_CONSTANTS, WarpRequest } from './WarpNavigationService';
import { SpaceGridService, GridCell } from './SpaceGridService';
import { StarSystemGridService } from './StarSystemGridService';
import { GalaxyGrid, GridTerrain } from '../../models/gin7/GalaxyGrid';
import { logger } from '../../common/logger';
import { getSocketManager } from '../../socket/socketManager';

/**
 * 워프 오차 원인
 */
export type MisjumpCause = 
  | 'DISTANCE'          // 장거리 이동
  | 'ENGINE_FAILURE'    // 엔진 오작동
  | 'NAVIGATOR_ERROR'   // 항법사 실수
  | 'TERRAIN'           // 지형 영향 (성운 등)
  | 'GRAVITY_WELL'      // 중력장 영향
  | 'WARP_INTERDICTION' // 워프 차단
  | 'WEATHER'           // 우주 날씨
  | 'SABOTAGE';         // 사보타주

/**
 * 우주 날씨 타입
 */
export type SpaceWeatherType = 
  | 'CLEAR'             // 맑음 (기본)
  | 'ION_STORM'         // 이온 폭풍
  | 'SOLAR_FLARE'       // 태양 플레어
  | 'COSMIC_DUST'       // 우주 먼지
  | 'RADIATION_BELT'    // 방사선 벨트
  | 'WARP_TURBULENCE';  // 워프 난류

/**
 * 워프 계산 결과 인터페이스
 */
export interface WarpCalculation {
  distance: number;             // 이동 거리 (광년)
  fuelCost: number;             // 연료 소비량
  travelTime: number;           // 이동 시간 (틱)
  mishapChance: number;         // 미스점프 확률 (0-1)
  deviationRange: number;       // 오차 범위 (그리드)
  factors: WarpCalculationFactors;  // 계산 요소
}

/**
 * 워프 계산 요소 상세
 */
export interface WarpCalculationFactors {
  baseDistance: number;
  baseFuel: number;
  baseTime: number;
  baseMishapChance: number;
  
  // 수정치들
  distanceModifier: number;
  engineModifier: number;
  terrainModifier: number;
  weatherModifier: number;
  skillModifier: number;
  gravityModifier: number;
}

/**
 * 워프 차단 필드
 */
export interface WarpInterdictionField {
  fieldId: string;
  sessionId: string;
  ownerFactionId: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;               // 영향 범위 (그리드)
  strength: number;             // 차단 강도 (0-1)
  activeUntil: Date;            // 활성화 종료 시간
  sourceType: 'SHIP' | 'STATION' | 'GRAVITY_WELL';
  sourceId: string;             // 함선 또는 시설 ID
}

/**
 * 미스점프 결과
 */
export interface MisjumpResult {
  hasMisjump: boolean;
  cause?: MisjumpCause;
  offset?: { x: number; y: number; z: number };
  actualDestination?: { gridX: number; gridY: number; gridZ: number };
  damage?: number;              // 미스점프로 인한 피해 (%)
  delayTicks?: number;          // 추가 지연 시간
}

/**
 * 연료 소모 상세
 */
export interface FuelConsumptionDetail {
  baseCost: number;
  distanceCost: number;
  engineEfficiency: number;
  terrainPenalty: number;
  weatherPenalty: number;
  totalCost: number;
  fuelType: 'STANDARD' | 'PREMIUM' | 'EMERGENCY';
}

/**
 * 워프 확장 이벤트
 */
export const WARP_EXTENSION_EVENTS = {
  WARP_INTERDICTED: 'GIN7:WARP_INTERDICTED',
  WARP_DEVIATION: 'GIN7:WARP_DEVIATION',
  WARP_WEATHER_WARNING: 'GIN7:WARP_WEATHER_WARNING',
  GRAVITY_WELL_DETECTED: 'GIN7:GRAVITY_WELL_DETECTED',
  FUEL_WARNING: 'GIN7:FUEL_WARNING',
  EMERGENCY_DROP: 'GIN7:EMERGENCY_DROP',
} as const;

/**
 * 워프 확장 상수
 */
export const WARP_EXTENSION_CONSTANTS = {
  // 미스점프 기본 계수
  MISJUMP: {
    BASE_CHANCE: 0.03,           // 기본 3%
    DISTANCE_FACTOR: 0.0005,     // 100광년당 0.05% 추가
    ENGINE_REDUCTION: 0.005,     // 엔진 레벨당 0.5% 감소
    NAVIGATOR_REDUCTION: 0.01,   // 항법 스킬당 1% 감소
    MAX_CHANCE: 0.5,             // 최대 50%
    MIN_CHANCE: 0.001,           // 최소 0.1%
  } as const,
  
  // 오차 범위
  DEVIATION: {
    MIN_OFFSET: 1,
    MAX_OFFSET: 10,
    DISTANCE_FACTOR: 0.01,       // 100광년당 1그리드 최대 오차
    TERRAIN_MULTIPLIER: 1.5,     // 불안정 지형에서 1.5배
  } as const,
  
  // 지형별 워프 영향
  TERRAIN_WARP_MODIFIERS: {
    normal: { mishapChance: 0, fuelMultiplier: 1.0, speedMultiplier: 1.0 },
    nebula: { mishapChance: 0.15, fuelMultiplier: 1.3, speedMultiplier: 0.7 },
    asteroid_field: { mishapChance: 0.1, fuelMultiplier: 1.2, speedMultiplier: 0.8 },
    corridor: { mishapChance: -0.02, fuelMultiplier: 0.9, speedMultiplier: 1.2 },
    black_hole: { mishapChance: 1.0, fuelMultiplier: 10.0, speedMultiplier: 0.1 },
  } as const,
  
  // 날씨 영향
  WEATHER_MODIFIERS: {
    CLEAR: { mishapChance: 0, fuelMultiplier: 1.0, speedMultiplier: 1.0 },
    ION_STORM: { mishapChance: 0.2, fuelMultiplier: 1.5, speedMultiplier: 0.6 },
    SOLAR_FLARE: { mishapChance: 0.1, fuelMultiplier: 1.2, speedMultiplier: 0.8 },
    COSMIC_DUST: { mishapChance: 0.05, fuelMultiplier: 1.1, speedMultiplier: 0.9 },
    RADIATION_BELT: { mishapChance: 0.08, fuelMultiplier: 1.15, speedMultiplier: 0.85 },
    WARP_TURBULENCE: { mishapChance: 0.25, fuelMultiplier: 1.4, speedMultiplier: 0.5 },
  } as const,
  
  // 워프 차단
  INTERDICTION: {
    MIN_STRENGTH: 0.1,
    MAX_STRENGTH: 1.0,
    DEFAULT_RADIUS: 3,           // 기본 3그리드 반경
    DROP_DISTANCE: 2,            // 차단 시 떨어지는 거리
    DAMAGE_PERCENT: 5,           // 강제 드롭 시 피해 %
  } as const,
  
  // 중력장 영향
  GRAVITY_WELL: {
    STAR_SYSTEM_RADIUS: 2,       // 성계 중력장 반경
    BLACK_HOLE_RADIUS: 5,        // 블랙홀 중력장 반경
    MISHAP_BONUS: 0.1,           // 중력장 근처 미스점프 증가
    SPEED_PENALTY: 0.3,          // 속도 30% 감소
  } as const,
  
  // 연료 상수
  FUEL: {
    BASE_COST: 100,
    DISTANCE_FACTOR: 10,         // 100광년당 10
    ENGINE_REDUCTION: 0.05,      // 엔진 레벨당 5% 감소
    PREMIUM_MULTIPLIER: 0.8,     // 프리미엄 연료 20% 절약
    EMERGENCY_MULTIPLIER: 2.0,   // 비상 연료 2배 소모
    WARNING_THRESHOLD: 0.2,      // 20% 이하 경고
  } as const,
} as const;

/**
 * WarpSystemExtension
 * 
 * 워프 시스템 확장 기능:
 * - 워프 오차 상세 계산
 * - 미스점프 처리
 * - 워프 차단 (중력장)
 * - 연료 소모 상세 계산
 * - 우주 날씨 영향
 */
export class WarpSystemExtension extends EventEmitter {
  private static instance: WarpSystemExtension;
  
  // 워프 차단 필드 캐시: sessionId -> fieldId -> field
  private interdictionFields: Map<string, Map<string, WarpInterdictionField>> = new Map();
  
  // 우주 날씨 캐시: sessionId -> (gridKey -> weather)
  private weatherCache: Map<string, Map<string, SpaceWeatherType>> = new Map();

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): WarpSystemExtension {
    if (!WarpSystemExtension.instance) {
      WarpSystemExtension.instance = new WarpSystemExtension();
    }
    return WarpSystemExtension.instance;
  }

  /**
   * 서비스 초기화
   */
  public async initialize(): Promise<void> {
    logger.info('[WarpSystemExtension] Initialized');
  }

  /**
   * 서비스 종료
   */
  public async shutdown(): Promise<void> {
    this.interdictionFields.clear();
    this.weatherCache.clear();
    logger.info('[WarpSystemExtension] Shutdown');
  }

  // ============================================================
  // 워프 계산 (확장)
  // ============================================================

  /**
   * 상세 워프 계산
   */
  public async calculateWarp(
    sessionId: string,
    origin: { gridX: number; gridY: number; gridZ?: number },
    destination: { gridX: number; gridY: number; gridZ?: number },
    engineLevel: number,
    navigatorSkill: number = 50,    // 기본 항법 스킬 50
    fuelType: 'STANDARD' | 'PREMIUM' | 'EMERGENCY' = 'STANDARD'
  ): Promise<WarpCalculation> {
    const originZ = origin.gridZ ?? 0;
    const destZ = destination.gridZ ?? 0;
    
    // 기본 거리 계산 (3D)
    const dx = destination.gridX - origin.gridX;
    const dy = destination.gridY - origin.gridY;
    const dz = destZ - originZ;
    const gridDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const distance = gridDistance * 100; // 100광년/그리드

    // 지형 정보 수집
    const originTerrain = await this.getGridTerrain(sessionId, origin.gridX, origin.gridY);
    const destTerrain = await this.getGridTerrain(sessionId, destination.gridX, destination.gridY);
    
    // 경로상 날씨
    const weather = this.getWeatherAlongPath(sessionId, origin, destination);
    
    // 중력장 영향
    const gravityEffect = await this.calculateGravityEffect(sessionId, origin, destination);

    // 지형 수정치 (더 나쁜 쪽 적용)
    const originTerrainMod = WARP_EXTENSION_CONSTANTS.TERRAIN_WARP_MODIFIERS[originTerrain] 
      ?? WARP_EXTENSION_CONSTANTS.TERRAIN_WARP_MODIFIERS.normal;
    const destTerrainMod = WARP_EXTENSION_CONSTANTS.TERRAIN_WARP_MODIFIERS[destTerrain]
      ?? WARP_EXTENSION_CONSTANTS.TERRAIN_WARP_MODIFIERS.normal;
    
    const terrainModifier = {
      mishapChance: Math.max(originTerrainMod.mishapChance, destTerrainMod.mishapChance),
      fuelMultiplier: Math.max(originTerrainMod.fuelMultiplier, destTerrainMod.fuelMultiplier),
      speedMultiplier: Math.min(originTerrainMod.speedMultiplier, destTerrainMod.speedMultiplier),
    };

    // 날씨 수정치
    const weatherMod = WARP_EXTENSION_CONSTANTS.WEATHER_MODIFIERS[weather];

    // 미스점프 확률 계산
    const baseMishap = WARP_EXTENSION_CONSTANTS.MISJUMP.BASE_CHANCE;
    const distanceMishap = distance * WARP_EXTENSION_CONSTANTS.MISJUMP.DISTANCE_FACTOR;
    const engineReduction = engineLevel * WARP_EXTENSION_CONSTANTS.MISJUMP.ENGINE_REDUCTION;
    const navigatorReduction = (navigatorSkill / 100) * WARP_EXTENSION_CONSTANTS.MISJUMP.NAVIGATOR_REDUCTION;
    
    let mishapChance = baseMishap + distanceMishap + terrainModifier.mishapChance + 
                       weatherMod.mishapChance + gravityEffect.mishapBonus - 
                       engineReduction - navigatorReduction;
    
    mishapChance = Math.max(
      WARP_EXTENSION_CONSTANTS.MISJUMP.MIN_CHANCE,
      Math.min(WARP_EXTENSION_CONSTANTS.MISJUMP.MAX_CHANCE, mishapChance)
    );

    // 오차 범위 계산
    const baseDeviation = Math.ceil(distance * WARP_EXTENSION_CONSTANTS.DEVIATION.DISTANCE_FACTOR);
    const deviationRange = Math.max(
      WARP_EXTENSION_CONSTANTS.DEVIATION.MIN_OFFSET,
      Math.min(
        WARP_EXTENSION_CONSTANTS.DEVIATION.MAX_OFFSET,
        baseDeviation * (terrainModifier.mishapChance > 0 ? WARP_EXTENSION_CONSTANTS.DEVIATION.TERRAIN_MULTIPLIER : 1)
      )
    );

    // 연료 소비 계산
    const fuelDetail = this.calculateFuelConsumption(
      distance, 
      engineLevel, 
      terrainModifier.fuelMultiplier, 
      weatherMod.fuelMultiplier,
      fuelType
    );

    // 이동 시간 계산
    const baseTime = Math.ceil(distance / (WARP_CONSTANTS.BASE_WARP_SPEED * (1 + engineLevel * WARP_CONSTANTS.ENGINE_LEVEL_MULTIPLIER)));
    const modifiedTime = Math.ceil(baseTime / (terrainModifier.speedMultiplier * weatherMod.speedMultiplier * (1 - gravityEffect.speedPenalty)));
    
    return {
      distance,
      fuelCost: fuelDetail.totalCost,
      travelTime: modifiedTime + WARP_CONSTANTS.BASE_CHARGE_TIME + WARP_CONSTANTS.COOLING_TIME,
      mishapChance,
      deviationRange,
      factors: {
        baseDistance: distance,
        baseFuel: fuelDetail.baseCost + fuelDetail.distanceCost,
        baseTime,
        baseMishapChance: baseMishap + distanceMishap,
        distanceModifier: distanceMishap,
        engineModifier: -engineReduction,
        terrainModifier: terrainModifier.mishapChance,
        weatherModifier: weatherMod.mishapChance,
        skillModifier: -navigatorReduction,
        gravityModifier: gravityEffect.mishapBonus,
      },
    };
  }

  /**
   * 연료 소비 상세 계산
   */
  private calculateFuelConsumption(
    distance: number,
    engineLevel: number,
    terrainMultiplier: number,
    weatherMultiplier: number,
    fuelType: 'STANDARD' | 'PREMIUM' | 'EMERGENCY'
  ): FuelConsumptionDetail {
    const baseCost = WARP_EXTENSION_CONSTANTS.FUEL.BASE_COST;
    const distanceCost = Math.ceil((distance / 100) * WARP_EXTENSION_CONSTANTS.FUEL.DISTANCE_FACTOR);
    const engineEfficiency = 1 - (engineLevel * WARP_EXTENSION_CONSTANTS.FUEL.ENGINE_REDUCTION);
    
    const terrainPenalty = (terrainMultiplier - 1) * (baseCost + distanceCost);
    const weatherPenalty = (weatherMultiplier - 1) * (baseCost + distanceCost);
    
    let fuelTypeMultiplier = 1.0;
    if (fuelType === 'PREMIUM') {
      fuelTypeMultiplier = WARP_EXTENSION_CONSTANTS.FUEL.PREMIUM_MULTIPLIER;
    } else if (fuelType === 'EMERGENCY') {
      fuelTypeMultiplier = WARP_EXTENSION_CONSTANTS.FUEL.EMERGENCY_MULTIPLIER;
    }

    const totalCost = Math.max(50, Math.ceil(
      ((baseCost + distanceCost) * engineEfficiency + terrainPenalty + weatherPenalty) * fuelTypeMultiplier
    ));

    return {
      baseCost,
      distanceCost,
      engineEfficiency,
      terrainPenalty,
      weatherPenalty,
      totalCost,
      fuelType,
    };
  }

  // ============================================================
  // 미스점프 처리
  // ============================================================

  /**
   * 미스점프 발생 여부 및 결과 계산
   */
  public calculateMisjump(
    calculation: WarpCalculation,
    destination: { gridX: number; gridY: number; gridZ?: number }
  ): MisjumpResult {
    const roll = Math.random();
    
    if (roll >= calculation.mishapChance) {
      return { hasMisjump: false };
    }

    // 미스점프 원인 결정
    const cause = this.determineMisjumpCause(calculation.factors);
    
    // 오차 계산
    const maxOffset = Math.ceil(calculation.deviationRange);
    const offsetX = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
    const offsetY = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
    const offsetZ = Math.floor(Math.random() * 3) - 1; // Z축은 -1 ~ 1
    
    // 실제 도착지 계산 (범위 내로 클램핑)
    const actualX = Math.max(0, Math.min(99, destination.gridX + offsetX));
    const actualY = Math.max(0, Math.min(99, destination.gridY + offsetY));
    const actualZ = Math.max(0, Math.min(9, (destination.gridZ ?? 0) + offsetZ));
    
    // 피해 및 지연 계산
    const damage = cause === 'WARP_INTERDICTION' || cause === 'GRAVITY_WELL' 
      ? 5 + Math.random() * 10 
      : Math.random() * 5;
    const delayTicks = Math.ceil(Math.random() * 5);

    return {
      hasMisjump: true,
      cause,
      offset: { x: offsetX, y: offsetY, z: offsetZ },
      actualDestination: { gridX: actualX, gridY: actualY, gridZ: actualZ },
      damage: Math.round(damage * 10) / 10,
      delayTicks,
    };
  }

  /**
   * 미스점프 원인 결정
   */
  private determineMisjumpCause(factors: WarpCalculationFactors): MisjumpCause {
    // 가장 큰 영향 요소 기반으로 원인 결정
    const causes: Array<{ cause: MisjumpCause; weight: number }> = [
      { cause: 'DISTANCE', weight: factors.distanceModifier },
      { cause: 'TERRAIN', weight: factors.terrainModifier },
      { cause: 'WEATHER', weight: factors.weatherModifier },
      { cause: 'GRAVITY_WELL', weight: factors.gravityModifier },
      { cause: 'ENGINE_FAILURE', weight: Math.random() * 0.1 },
      { cause: 'NAVIGATOR_ERROR', weight: Math.random() * 0.1 },
    ];

    causes.sort((a, b) => b.weight - a.weight);
    return causes[0].cause;
  }

  // ============================================================
  // 워프 차단
  // ============================================================

  /**
   * 워프 차단 필드 생성
   */
  public createInterdictionField(
    sessionId: string,
    ownerFactionId: string,
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    strength: number,
    durationTicks: number,
    sourceType: 'SHIP' | 'STATION' | 'GRAVITY_WELL',
    sourceId: string
  ): WarpInterdictionField {
    const field: WarpInterdictionField = {
      fieldId: uuidv4(),
      sessionId,
      ownerFactionId,
      centerX,
      centerY,
      centerZ,
      radius: Math.max(1, Math.min(10, radius)),
      strength: Math.max(
        WARP_EXTENSION_CONSTANTS.INTERDICTION.MIN_STRENGTH,
        Math.min(WARP_EXTENSION_CONSTANTS.INTERDICTION.MAX_STRENGTH, strength)
      ),
      activeUntil: new Date(Date.now() + durationTicks * 1000),
      sourceType,
      sourceId,
    };

    // 캐시에 저장
    let sessionFields = this.interdictionFields.get(sessionId);
    if (!sessionFields) {
      sessionFields = new Map();
      this.interdictionFields.set(sessionId, sessionFields);
    }
    sessionFields.set(field.fieldId, field);

    logger.info(`[WarpSystemExtension] Interdiction field created at (${centerX},${centerY},${centerZ}) radius ${radius}`);
    return field;
  }

  /**
   * 워프 차단 필드 제거
   */
  public removeInterdictionField(sessionId: string, fieldId: string): boolean {
    const sessionFields = this.interdictionFields.get(sessionId);
    if (!sessionFields) return false;
    return sessionFields.delete(fieldId);
  }

  /**
   * 경로상 워프 차단 체크
   */
  public async checkWarpInterdiction(
    sessionId: string,
    origin: { gridX: number; gridY: number; gridZ?: number },
    destination: { gridX: number; gridY: number; gridZ?: number },
    factionId: string
  ): Promise<{ isInterdicted: boolean; field?: WarpInterdictionField; dropPoint?: { x: number; y: number; z: number } }> {
    const sessionFields = this.interdictionFields.get(sessionId);
    if (!sessionFields || sessionFields.size === 0) {
      return { isInterdicted: false };
    }

    const now = new Date();
    const originZ = origin.gridZ ?? 0;
    const destZ = destination.gridZ ?? 0;

    // 경로 점들 생성 (선형 보간)
    const steps = Math.max(
      Math.abs(destination.gridX - origin.gridX),
      Math.abs(destination.gridY - origin.gridY)
    ) + 1;

    for (const [, field] of sessionFields) {
      // 만료된 필드 건너뛰기
      if (field.activeUntil < now) continue;
      
      // 같은 진영은 차단 안함
      if (field.ownerFactionId === factionId) continue;

      // 경로상 각 점에서 차단 필드와의 거리 체크
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = Math.round(origin.gridX + (destination.gridX - origin.gridX) * t);
        const py = Math.round(origin.gridY + (destination.gridY - origin.gridY) * t);
        const pz = Math.round(originZ + (destZ - originZ) * t);

        const distance = Math.sqrt(
          Math.pow(px - field.centerX, 2) +
          Math.pow(py - field.centerY, 2) +
          Math.pow(pz - field.centerZ, 2)
        );

        if (distance <= field.radius) {
          // 차단됨 - 드롭 포인트 계산
          const dropDistance = WARP_EXTENSION_CONSTANTS.INTERDICTION.DROP_DISTANCE;
          const dirX = origin.gridX - field.centerX;
          const dirY = origin.gridY - field.centerY;
          const dirZ = originZ - field.centerZ;
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;

          const dropX = Math.max(0, Math.min(99, Math.round(field.centerX + (dirX / dirLen) * (field.radius + dropDistance))));
          const dropY = Math.max(0, Math.min(99, Math.round(field.centerY + (dirY / dirLen) * (field.radius + dropDistance))));
          const dropZ = Math.max(0, Math.min(9, Math.round(field.centerZ + (dirZ / dirLen) * (field.radius + dropDistance))));

          this.emitWarpEvent(WARP_EXTENSION_EVENTS.WARP_INTERDICTED, {
            sessionId,
            factionId,
            fieldId: field.fieldId,
            fieldOwner: field.ownerFactionId,
            originalDestination: destination,
            dropPoint: { x: dropX, y: dropY, z: dropZ },
          });

          return {
            isInterdicted: true,
            field,
            dropPoint: { x: dropX, y: dropY, z: dropZ },
          };
        }
      }
    }

    return { isInterdicted: false };
  }

  // ============================================================
  // 중력장 영향
  // ============================================================

  /**
   * 중력장 영향 계산
   */
  private async calculateGravityEffect(
    sessionId: string,
    origin: { gridX: number; gridY: number; gridZ?: number },
    destination: { gridX: number; gridY: number; gridZ?: number }
  ): Promise<{ mishapBonus: number; speedPenalty: number }> {
    let maxMishapBonus = 0;
    let maxSpeedPenalty = 0;

    // 출발지/도착지 주변 성계 확인
    const nearbyGrids = [origin, destination];
    
    for (const pos of nearbyGrids) {
      // 해당 그리드에 성계가 있는지 확인
      const grid = await GalaxyGrid.findOne({ 
        sessionId, 
        x: pos.gridX, 
        y: pos.gridY 
      });

      if (grid?.starSystemIds && grid.starSystemIds.length > 0) {
        maxMishapBonus = Math.max(maxMishapBonus, WARP_EXTENSION_CONSTANTS.GRAVITY_WELL.MISHAP_BONUS);
        maxSpeedPenalty = Math.max(maxSpeedPenalty, WARP_EXTENSION_CONSTANTS.GRAVITY_WELL.SPEED_PENALTY);
      }

      // 블랙홀 체크
      if (grid?.terrain === 'black_hole') {
        maxMishapBonus = Math.max(maxMishapBonus, 0.5);
        maxSpeedPenalty = Math.max(maxSpeedPenalty, 0.8);
      }
    }

    return {
      mishapBonus: maxMishapBonus,
      speedPenalty: maxSpeedPenalty,
    };
  }

  // ============================================================
  // 우주 날씨
  // ============================================================

  /**
   * 그리드 날씨 설정
   */
  public setGridWeather(
    sessionId: string,
    gridX: number,
    gridY: number,
    weather: SpaceWeatherType
  ): void {
    let sessionWeather = this.weatherCache.get(sessionId);
    if (!sessionWeather) {
      sessionWeather = new Map();
      this.weatherCache.set(sessionId, sessionWeather);
    }
    sessionWeather.set(`${gridX},${gridY}`, weather);
  }

  /**
   * 그리드 날씨 조회
   */
  public getGridWeather(sessionId: string, gridX: number, gridY: number): SpaceWeatherType {
    const sessionWeather = this.weatherCache.get(sessionId);
    if (!sessionWeather) return 'CLEAR';
    return sessionWeather.get(`${gridX},${gridY}`) || 'CLEAR';
  }

  /**
   * 경로상 최악의 날씨 조회
   */
  private getWeatherAlongPath(
    sessionId: string,
    origin: { gridX: number; gridY: number },
    destination: { gridX: number; gridY: number }
  ): SpaceWeatherType {
    const weatherPriority: SpaceWeatherType[] = [
      'WARP_TURBULENCE', 'ION_STORM', 'SOLAR_FLARE', 
      'RADIATION_BELT', 'COSMIC_DUST', 'CLEAR'
    ];

    let worstWeather: SpaceWeatherType = 'CLEAR';
    let worstIndex = weatherPriority.length - 1;

    // 경로상 그리드들 확인
    const steps = Math.max(
      Math.abs(destination.gridX - origin.gridX),
      Math.abs(destination.gridY - origin.gridY)
    ) + 1;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(origin.gridX + (destination.gridX - origin.gridX) * t);
      const y = Math.round(origin.gridY + (destination.gridY - origin.gridY) * t);
      
      const weather = this.getGridWeather(sessionId, x, y);
      const index = weatherPriority.indexOf(weather);
      
      if (index < worstIndex) {
        worstIndex = index;
        worstWeather = weather;
      }
    }

    if (worstWeather !== 'CLEAR') {
      this.emitWarpEvent(WARP_EXTENSION_EVENTS.WARP_WEATHER_WARNING, {
        sessionId,
        weather: worstWeather,
        origin,
        destination,
      });
    }

    return worstWeather;
  }

  /**
   * 랜덤 우주 날씨 생성 (세션 초기화용)
   */
  public generateRandomWeather(sessionId: string, coverage: number = 0.1): void {
    const weatherTypes: SpaceWeatherType[] = [
      'ION_STORM', 'SOLAR_FLARE', 'COSMIC_DUST', 'RADIATION_BELT', 'WARP_TURBULENCE'
    ];
    
    const gridCount = Math.floor(100 * 100 * coverage);
    
    for (let i = 0; i < gridCount; i++) {
      const x = Math.floor(Math.random() * 100);
      const y = Math.floor(Math.random() * 100);
      const weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      this.setGridWeather(sessionId, x, y, weather);
    }

    logger.info(`[WarpSystemExtension] Generated weather for ${gridCount} grids in session ${sessionId}`);
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  /**
   * 그리드 지형 조회
   */
  private async getGridTerrain(sessionId: string, x: number, y: number): Promise<GridTerrain> {
    const grid = await GalaxyGrid.findOne({ sessionId, x, y });
    return grid?.terrain || 'normal';
  }

  /**
   * 캐시 클리어
   */
  public clearSessionCache(sessionId: string): void {
    this.interdictionFields.delete(sessionId);
    this.weatherCache.delete(sessionId);
    logger.info(`[WarpSystemExtension] Cleared cache for session ${sessionId}`);
  }

  /**
   * 만료된 차단 필드 정리
   */
  public cleanupExpiredFields(sessionId: string): number {
    const sessionFields = this.interdictionFields.get(sessionId);
    if (!sessionFields) return 0;

    const now = new Date();
    let removed = 0;

    for (const [fieldId, field] of sessionFields) {
      if (field.activeUntil < now) {
        sessionFields.delete(fieldId);
        removed++;
      }
    }

    return removed;
  }

  // ============================================================
  // 이벤트 발송
  // ============================================================

  private emitWarpEvent(eventName: string, payload: any): void {
    this.emit(eventName, payload);
    
    const socketManager = getSocketManager();
    if (socketManager && payload.sessionId) {
      socketManager.getIO().to(`session:${payload.sessionId}`).emit(eventName, payload);
    }
  }
}

// 싱글톤 getter
export function getWarpSystemExtension(): WarpSystemExtension {
  return WarpSystemExtension.getInstance();
}







