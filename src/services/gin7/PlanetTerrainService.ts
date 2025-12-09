/**
 * PlanetTerrainService - 행성 지형 관리 서비스
 * 
 * 행성 타입별 지형 수정자, 유닛 운용 가능 여부, 환경 효과를 담당합니다.
 */

import { EventEmitter } from 'events';
import { GroundUnitType, GROUND_UNIT_SPECS } from '../../models/gin7/GroundBattle';
import { PlanetType } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 행성 지형 타입 (확장)
 */
export type PlanetTerrainType =
  | 'TERRAN'          // 지구형 - 표준 환경
  | 'OCEAN'           // 해양 세계 - 수중 작전 필요
  | 'DESERT'          // 사막 - 열악한 환경, 자원 풍부
  | 'ICE'             // 빙결 - 극저온 환경
  | 'VOLCANIC'        // 화산 - 고열, 지형 불안정
  | 'GAS_GIANT'       // 가스 거인 - 지상전 불가
  | 'ARTIFICIAL';     // 인공 - 우주 정거장/요새

/**
 * 지형 수정자
 */
export interface TerrainModifiers {
  // 전투 수정자
  attackModifier: number;       // 공격력 배수 (1.0 = 100%)
  defenseModifier: number;      // 방어력 배수
  accuracyModifier: number;     // 명중률 수정 (0 = 기본)
  evasionModifier: number;      // 회피율 수정
  
  // 이동 수정자
  movementSpeedModifier: number;  // 이동 속도 배수
  mobilityModifier: number;       // 기동성 배수
  
  // 유지/보급 수정자
  supplyConsumptionModifier: number;  // 보급 소모 배수
  repairRateModifier: number;         // 수리 속도 배수
  attritionRate: number;              // 턴당 자연 손실률
  
  // 사기 수정자
  moraleModifier: number;        // 사기 변동 수정
  moraleRecoveryModifier: number; // 사기 회복 배수
  
  // 점령 수정자
  conquestSpeedModifier: number;  // 점령 속도 배수
  fortificationBonus: number;     // 요새화 보너스
  
  // 특수 효과
  specialEffects: EnvironmentalEffect[];
}

/**
 * 환경 효과
 */
export interface EnvironmentalEffect {
  effectId: string;
  name: string;
  description: string;
  
  // 효과 대상
  affectedUnits: 'ALL' | 'ATTACKER' | 'DEFENDER' | GroundUnitType[];
  
  // 효과 유형
  effectType: EnvironmentalEffectType;
  
  // 수치
  magnitude: number;           // 효과 강도
  duration: number;            // 지속 시간 (턴, -1 = 영구)
  tickRate: number;            // 적용 주기 (틱)
  
  // 조건
  chance: number;              // 발생 확률 (0-100)
  conditions?: EffectCondition[];
}

/**
 * 환경 효과 유형
 */
export type EnvironmentalEffectType =
  | 'DAMAGE'                   // 직접 피해
  | 'HEAL'                     // 회복
  | 'SUPPLY_DRAIN'             // 보급 소모
  | 'MORALE_CHANGE'            // 사기 변동
  | 'MOVEMENT_PENALTY'         // 이동 페널티
  | 'ACCURACY_PENALTY'         // 명중 페널티
  | 'VISIBILITY_REDUCTION'     // 시야 감소
  | 'EQUIPMENT_DAMAGE'         // 장비 손상
  | 'COMMUNICATION_JAM';       // 통신 방해

/**
 * 효과 조건
 */
export interface EffectCondition {
  type: 'TIME' | 'WEATHER' | 'UNIT_TYPE' | 'UNIT_COUNT' | 'FACTION';
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER' | 'LESS';
  value: string | number;
}

/**
 * 가스 행성 규칙
 */
export interface GasGiantRules {
  groundCombatAllowed: false;
  
  // 허용되는 작전
  allowedOperations: GasGiantOperation[];
  
  // 자원 추출
  resourceExtraction: {
    enabled: boolean;
    resourceType: string;
    extractionRate: number;
    requiredFacility: string;
  };
  
  // 궤도 시설
  orbitalFacilities: {
    maxCount: number;
    types: string[];
    constructionModifier: number;
  };
  
  // 위험 요소
  hazards: {
    stormChance: number;
    stormDamage: number;
    radiationLevel: number;
    gravityWellEffect: number;
  };
}

/**
 * 가스 행성 작전 유형
 */
export type GasGiantOperation =
  | 'ORBITAL_STATION'          // 궤도 정거장 건설
  | 'GAS_EXTRACTION'           // 가스 추출
  | 'RECONNAISSANCE'           // 정찰
  | 'BLOCKADE';                // 봉쇄

/**
 * 유닛 운용 결과
 */
export interface UnitOperabilityResult {
  canOperate: boolean;
  operationalEfficiency: number;  // 0-100
  restrictions: string[];
  warnings: string[];
  requiredEquipment: string[];
}

/**
 * 환경 효과 적용 결과
 */
export interface EnvironmentalEffectResult {
  unitId: string;
  effectsApplied: {
    effectId: string;
    effectName: string;
    value: number;
    description: string;
  }[];
  totalDamage: number;
  totalHeal: number;
  moraleChange: number;
  supplyDrain: number;
}

// ============================================================
// Constants
// ============================================================

/**
 * 행성 타입별 지형 수정자
 */
const PLANET_TERRAIN_MODIFIERS: Record<PlanetTerrainType, TerrainModifiers> = {
  TERRAN: {
    attackModifier: 1.0,
    defenseModifier: 1.0,
    accuracyModifier: 0,
    evasionModifier: 0,
    movementSpeedModifier: 1.0,
    mobilityModifier: 1.0,
    supplyConsumptionModifier: 1.0,
    repairRateModifier: 1.0,
    attritionRate: 0,
    moraleModifier: 0,
    moraleRecoveryModifier: 1.0,
    conquestSpeedModifier: 1.0,
    fortificationBonus: 0,
    specialEffects: [],
  },
  
  OCEAN: {
    attackModifier: 0.8,
    defenseModifier: 1.1,
    accuracyModifier: -15,
    evasionModifier: 10,
    movementSpeedModifier: 0.6,
    mobilityModifier: 0.5,
    supplyConsumptionModifier: 1.3,
    repairRateModifier: 0.7,
    attritionRate: 0.02,
    moraleModifier: -5,
    moraleRecoveryModifier: 0.8,
    conquestSpeedModifier: 0.5,
    fortificationBonus: 20,
    specialEffects: [
      {
        effectId: 'OCEAN_STORM',
        name: '해양 폭풍',
        description: '갑작스러운 폭풍으로 인한 피해',
        affectedUnits: 'ALL',
        effectType: 'DAMAGE',
        magnitude: 5,
        duration: 1,
        tickRate: 1,
        chance: 15,
      },
      {
        effectId: 'AMPHIBIOUS_PENALTY',
        name: '수륙양용 페널티',
        description: '수중 작전으로 인한 이동 제한',
        affectedUnits: ['armored'],
        effectType: 'MOVEMENT_PENALTY',
        magnitude: 30,
        duration: -1,
        tickRate: 1,
        chance: 100,
      },
    ],
  },
  
  DESERT: {
    attackModifier: 1.1,
    defenseModifier: 0.9,
    accuracyModifier: -10,
    evasionModifier: 5,
    movementSpeedModifier: 0.9,
    mobilityModifier: 0.85,
    supplyConsumptionModifier: 1.5,
    repairRateModifier: 0.8,
    attritionRate: 0.03,
    moraleModifier: -10,
    moraleRecoveryModifier: 0.7,
    conquestSpeedModifier: 1.2,
    fortificationBonus: -10,
    specialEffects: [
      {
        effectId: 'SANDSTORM',
        name: '모래 폭풍',
        description: '모래 폭풍으로 인한 시야 및 장비 손상',
        affectedUnits: 'ALL',
        effectType: 'VISIBILITY_REDUCTION',
        magnitude: 50,
        duration: 2,
        tickRate: 1,
        chance: 20,
      },
      {
        effectId: 'HEAT_EXHAUSTION',
        name: '열사병',
        description: '극심한 더위로 인한 병력 손실',
        affectedUnits: ['infantry'],
        effectType: 'DAMAGE',
        magnitude: 3,
        duration: -1,
        tickRate: 3,
        chance: 100,
      },
      {
        effectId: 'EQUIPMENT_WEAR',
        name: '장비 마모',
        description: '모래로 인한 장비 손상',
        affectedUnits: ['armored'],
        effectType: 'EQUIPMENT_DAMAGE',
        magnitude: 2,
        duration: -1,
        tickRate: 5,
        chance: 100,
      },
    ],
  },
  
  ICE: {
    attackModifier: 0.9,
    defenseModifier: 1.2,
    accuracyModifier: -5,
    evasionModifier: -5,
    movementSpeedModifier: 0.7,
    mobilityModifier: 0.6,
    supplyConsumptionModifier: 1.4,
    repairRateModifier: 0.6,
    attritionRate: 0.04,
    moraleModifier: -15,
    moraleRecoveryModifier: 0.6,
    conquestSpeedModifier: 0.7,
    fortificationBonus: 15,
    specialEffects: [
      {
        effectId: 'FROSTBITE',
        name: '동상',
        description: '극저온으로 인한 병력 손실',
        affectedUnits: 'ALL',
        effectType: 'DAMAGE',
        magnitude: 4,
        duration: -1,
        tickRate: 2,
        chance: 100,
      },
      {
        effectId: 'ICE_SLIP',
        name: '빙판 미끄러짐',
        description: '얼음으로 인한 이동 제한',
        affectedUnits: ['armored'],
        effectType: 'MOVEMENT_PENALTY',
        magnitude: 40,
        duration: -1,
        tickRate: 1,
        chance: 100,
      },
      {
        effectId: 'BLIZZARD',
        name: '눈보라',
        description: '눈보라로 인한 시야 차단',
        affectedUnits: 'ALL',
        effectType: 'VISIBILITY_REDUCTION',
        magnitude: 70,
        duration: 3,
        tickRate: 1,
        chance: 25,
      },
    ],
  },
  
  VOLCANIC: {
    attackModifier: 1.0,
    defenseModifier: 0.8,
    accuracyModifier: -20,
    evasionModifier: -10,
    movementSpeedModifier: 0.5,
    mobilityModifier: 0.4,
    supplyConsumptionModifier: 1.6,
    repairRateModifier: 0.5,
    attritionRate: 0.06,
    moraleModifier: -20,
    moraleRecoveryModifier: 0.5,
    conquestSpeedModifier: 0.4,
    fortificationBonus: -20,
    specialEffects: [
      {
        effectId: 'LAVA_FLOW',
        name: '용암 흐름',
        description: '용암으로 인한 대규모 피해',
        affectedUnits: 'ALL',
        effectType: 'DAMAGE',
        magnitude: 15,
        duration: 1,
        tickRate: 1,
        chance: 10,
      },
      {
        effectId: 'TOXIC_GAS',
        name: '독성 가스',
        description: '화산 가스로 인한 병력 손실',
        affectedUnits: ['infantry', 'grenadier'],
        effectType: 'DAMAGE',
        magnitude: 5,
        duration: -1,
        tickRate: 2,
        chance: 100,
      },
      {
        effectId: 'ERUPTION_TREMOR',
        name: '화산 진동',
        description: '지진으로 인한 이동 방해',
        affectedUnits: 'ALL',
        effectType: 'MOVEMENT_PENALTY',
        magnitude: 50,
        duration: 2,
        tickRate: 1,
        chance: 30,
      },
      {
        effectId: 'HEAT_DAMAGE',
        name: '고열 피해',
        description: '극심한 열기로 인한 장비 손상',
        affectedUnits: ['armored'],
        effectType: 'EQUIPMENT_DAMAGE',
        magnitude: 5,
        duration: -1,
        tickRate: 3,
        chance: 100,
      },
    ],
  },
  
  GAS_GIANT: {
    // 지상전 불가 - 모든 수정자 0 또는 극단적
    attackModifier: 0,
    defenseModifier: 0,
    accuracyModifier: -100,
    evasionModifier: 0,
    movementSpeedModifier: 0,
    mobilityModifier: 0,
    supplyConsumptionModifier: 10,
    repairRateModifier: 0,
    attritionRate: 1.0,  // 100% 손실
    moraleModifier: -100,
    moraleRecoveryModifier: 0,
    conquestSpeedModifier: 0,
    fortificationBonus: 0,
    specialEffects: [
      {
        effectId: 'ATMOSPHERIC_CRUSH',
        name: '대기압 압사',
        description: '극심한 대기압으로 인한 즉사',
        affectedUnits: 'ALL',
        effectType: 'DAMAGE',
        magnitude: 100,
        duration: 1,
        tickRate: 1,
        chance: 100,
      },
    ],
  },
  
  ARTIFICIAL: {
    attackModifier: 1.1,
    defenseModifier: 1.3,
    accuracyModifier: 5,
    evasionModifier: -5,
    movementSpeedModifier: 0.8,
    mobilityModifier: 0.9,
    supplyConsumptionModifier: 0.8,
    repairRateModifier: 1.3,
    attritionRate: 0,
    moraleModifier: 5,
    moraleRecoveryModifier: 1.2,
    conquestSpeedModifier: 0.8,
    fortificationBonus: 30,
    specialEffects: [
      {
        effectId: 'HULL_BREACH',
        name: '선체 파손',
        description: '전투로 인한 선체 파손 위험',
        affectedUnits: 'ALL',
        effectType: 'DAMAGE',
        magnitude: 20,
        duration: 1,
        tickRate: 1,
        chance: 5,
        conditions: [
          { type: 'UNIT_COUNT', operator: 'GREATER', value: 10 },
        ],
      },
      {
        effectId: 'CLOSE_QUARTERS',
        name: '근접전',
        description: '협소한 공간에서의 근접전 보너스',
        affectedUnits: ['infantry', 'grenadier'],
        effectType: 'DAMAGE',
        magnitude: -5,  // 방어 보너스
        duration: -1,
        tickRate: 1,
        chance: 100,
      },
    ],
  },
};

/**
 * 가스 행성 규칙
 */
const GAS_GIANT_RULES: GasGiantRules = {
  groundCombatAllowed: false,
  
  allowedOperations: [
    'ORBITAL_STATION',
    'GAS_EXTRACTION',
    'RECONNAISSANCE',
    'BLOCKADE',
  ],
  
  resourceExtraction: {
    enabled: true,
    resourceType: 'hydrogen_fuel',
    extractionRate: 100,
    requiredFacility: 'gas_processing_station',
  },
  
  orbitalFacilities: {
    maxCount: 5,
    types: ['gas_processing_station', 'orbital_defense', 'sensor_array', 'refueling_depot'],
    constructionModifier: 1.5,  // 건설 비용 1.5배
  },
  
  hazards: {
    stormChance: 30,
    stormDamage: 25,
    radiationLevel: 40,
    gravityWellEffect: 20,  // 탈출 속도 감소
  },
};

/**
 * 유닛별 행성 운용 제한
 */
const UNIT_TERRAIN_RESTRICTIONS: Record<GroundUnitType, {
  restricted: PlanetTerrainType[];
  limited: PlanetTerrainType[];
  optimal: PlanetTerrainType[];
}> = {
  armored: {
    restricted: ['GAS_GIANT', 'OCEAN'],
    limited: ['ICE', 'VOLCANIC', 'MOUNTAIN' as PlanetTerrainType],
    optimal: ['TERRAN', 'DESERT'],
  },
  infantry: {
    restricted: ['GAS_GIANT'],
    limited: ['VOLCANIC', 'ICE'],
    optimal: ['TERRAN', 'ARTIFICIAL', 'URBAN' as PlanetTerrainType],
  },
  grenadier: {
    restricted: ['GAS_GIANT'],
    limited: ['OCEAN'],
    optimal: ['ARTIFICIAL', 'VOLCANIC', 'MOUNTAIN' as PlanetTerrainType],
  },
};

// ============================================================
// PlanetTerrainService Class
// ============================================================

export class PlanetTerrainService extends EventEmitter {
  private static instance: PlanetTerrainService;
  
  private constructor() {
    super();
    logger.info('[PlanetTerrainService] Initialized');
  }
  
  public static getInstance(): PlanetTerrainService {
    if (!PlanetTerrainService.instance) {
      PlanetTerrainService.instance = new PlanetTerrainService();
    }
    return PlanetTerrainService.instance;
  }
  
  // ============================================================
  // Terrain Modifiers
  // ============================================================
  
  /**
   * 행성 타입별 지형 수정자 조회
   */
  getTerrainModifiers(planetType: PlanetType | PlanetTerrainType): TerrainModifiers {
    // PlanetType을 PlanetTerrainType으로 변환
    const terrainType = this.convertToPlanetTerrainType(planetType);
    
    const modifiers = PLANET_TERRAIN_MODIFIERS[terrainType];
    if (!modifiers) {
      logger.warn('[PlanetTerrainService] Unknown terrain type, using TERRAN defaults', {
        planetType,
      });
      return PLANET_TERRAIN_MODIFIERS.TERRAN;
    }
    
    return { ...modifiers };
  }
  
  /**
   * PlanetType을 PlanetTerrainType으로 변환
   */
  private convertToPlanetTerrainType(type: string): PlanetTerrainType {
    const mapping: Record<string, PlanetTerrainType> = {
      terran: 'TERRAN',
      ocean: 'OCEAN',
      desert: 'DESERT',
      ice: 'ICE',
      volcanic: 'VOLCANIC',
      gas_giant: 'GAS_GIANT',
      artificial: 'ARTIFICIAL',
      barren: 'DESERT',  // barren은 DESERT와 유사하게 처리
    };
    
    return mapping[type.toLowerCase()] || 'TERRAN';
  }
  
  /**
   * 전투 수정자 계산
   */
  getCombatModifiers(planetType: PlanetType | PlanetTerrainType, side: 'ATTACKER' | 'DEFENDER'): {
    attackMod: number;
    defenseMod: number;
    accuracyMod: number;
    evasionMod: number;
  } {
    const modifiers = this.getTerrainModifiers(planetType);
    
    // 방어측 약간 유리
    const defenderBonus = side === 'DEFENDER' ? modifiers.fortificationBonus / 100 : 0;
    
    return {
      attackMod: modifiers.attackModifier,
      defenseMod: modifiers.defenseModifier + defenderBonus,
      accuracyMod: modifiers.accuracyModifier,
      evasionMod: modifiers.evasionModifier,
    };
  }
  
  // ============================================================
  // Unit Operability
  // ============================================================
  
  /**
   * 유닛 운용 가능 여부 확인
   */
  canUnitOperate(
    unitType: GroundUnitType,
    planetType: PlanetType | PlanetTerrainType
  ): UnitOperabilityResult {
    const terrainType = this.convertToPlanetTerrainType(planetType);
    const restrictions = UNIT_TERRAIN_RESTRICTIONS[unitType];
    
    const result: UnitOperabilityResult = {
      canOperate: true,
      operationalEfficiency: 100,
      restrictions: [],
      warnings: [],
      requiredEquipment: [],
    };
    
    // 완전 제한 확인
    if (restrictions.restricted.includes(terrainType)) {
      result.canOperate = false;
      result.operationalEfficiency = 0;
      result.restrictions.push(`${unitType}는 ${terrainType} 환경에서 운용 불가`);
      
      if (terrainType === 'GAS_GIANT') {
        result.restrictions.push('가스 행성에서는 지상전이 불가능합니다');
      }
      
      return result;
    }
    
    // 제한적 운용
    if (restrictions.limited.includes(terrainType)) {
      result.operationalEfficiency = 60;
      result.warnings.push(`${terrainType} 환경에서 효율 감소`);
      
      // 필요 장비 추가
      switch (terrainType) {
        case 'ICE':
          result.requiredEquipment.push('극지방 장비', '가열 시스템');
          break;
        case 'VOLCANIC':
          result.requiredEquipment.push('내열 장갑', '가스 마스크');
          break;
        case 'OCEAN':
          result.requiredEquipment.push('수중 장비', '밀폐 시스템');
          break;
      }
    }
    
    // 최적 환경
    if (restrictions.optimal.includes(terrainType)) {
      result.operationalEfficiency = 100;
    }
    
    // 환경 효과 경고
    const modifiers = this.getTerrainModifiers(planetType);
    for (const effect of modifiers.specialEffects) {
      if (this.isUnitAffectedByEffect(unitType, effect)) {
        result.warnings.push(`${effect.name}: ${effect.description}`);
      }
    }
    
    return result;
  }
  
  /**
   * 유닛이 효과의 영향을 받는지 확인
   */
  private isUnitAffectedByEffect(unitType: GroundUnitType, effect: EnvironmentalEffect): boolean {
    if (effect.affectedUnits === 'ALL') return true;
    if (effect.affectedUnits === 'ATTACKER' || effect.affectedUnits === 'DEFENDER') return true;
    if (Array.isArray(effect.affectedUnits)) {
      return effect.affectedUnits.includes(unitType);
    }
    return false;
  }
  
  // ============================================================
  // Gas Giant Rules
  // ============================================================
  
  /**
   * 가스 행성 규칙 조회
   */
  getGasGiantRules(): GasGiantRules {
    return { ...GAS_GIANT_RULES };
  }
  
  /**
   * 가스 행성에서 작전 가능 여부 확인
   */
  canConductOperationOnGasGiant(operation: GasGiantOperation): boolean {
    return GAS_GIANT_RULES.allowedOperations.includes(operation);
  }
  
  /**
   * 가스 행성 자원 추출률 계산
   */
  getGasGiantExtractionRate(facilityLevel: number): number {
    const baseRate = GAS_GIANT_RULES.resourceExtraction.extractionRate;
    return Math.floor(baseRate * (1 + facilityLevel * 0.2));
  }
  
  /**
   * 가스 행성 위험 확인
   */
  checkGasGiantHazards(): {
    stormOccurred: boolean;
    stormDamage: number;
    radiationDamage: number;
  } {
    const hazards = GAS_GIANT_RULES.hazards;
    
    const stormOccurred = Math.random() * 100 < hazards.stormChance;
    const stormDamage = stormOccurred ? hazards.stormDamage : 0;
    
    // 방사선 피해는 항상 적용
    const radiationDamage = Math.floor(hazards.radiationLevel * 0.1);
    
    return {
      stormOccurred,
      stormDamage,
      radiationDamage,
    };
  }
  
  // ============================================================
  // Environmental Effects
  // ============================================================
  
  /**
   * 환경 효과 적용
   */
  applyEnvironmentalEffects(params: {
    planetType: PlanetType | PlanetTerrainType;
    units: { unitId: string; unitType: GroundUnitType; count: number; hp: number; morale: number }[];
    currentTick: number;
    side?: 'ATTACKER' | 'DEFENDER';
  }): EnvironmentalEffectResult[] {
    const { planetType, units, currentTick, side } = params;
    const modifiers = this.getTerrainModifiers(planetType);
    const results: EnvironmentalEffectResult[] = [];
    
    for (const unit of units) {
      const result: EnvironmentalEffectResult = {
        unitId: unit.unitId,
        effectsApplied: [],
        totalDamage: 0,
        totalHeal: 0,
        moraleChange: 0,
        supplyDrain: 0,
      };
      
      // 기본 소모 (attrition)
      if (modifiers.attritionRate > 0) {
        const attritionDamage = Math.floor(unit.count * modifiers.attritionRate);
        result.totalDamage += attritionDamage;
        result.effectsApplied.push({
          effectId: 'BASE_ATTRITION',
          effectName: '환경 소모',
          value: attritionDamage,
          description: `환경으로 인한 기본 손실: ${attritionDamage}명`,
        });
      }
      
      // 특수 효과 적용
      for (const effect of modifiers.specialEffects) {
        // 대상 확인
        if (!this.shouldApplyEffect(effect, unit.unitType, side)) {
          continue;
        }
        
        // 발생 확률 확인
        if (Math.random() * 100 > effect.chance) {
          continue;
        }
        
        // 틱 주기 확인
        if (effect.tickRate > 1 && currentTick % effect.tickRate !== 0) {
          continue;
        }
        
        // 효과 적용
        const effectResult = this.applyEffect(effect, unit);
        result.effectsApplied.push({
          effectId: effect.effectId,
          effectName: effect.name,
          value: effectResult.value,
          description: effect.description,
        });
        
        result.totalDamage += effectResult.damage;
        result.totalHeal += effectResult.heal;
        result.moraleChange += effectResult.moraleChange;
        result.supplyDrain += effectResult.supplyDrain;
      }
      
      results.push(result);
    }
    
    logger.info('[PlanetTerrainService] Environmental effects applied', {
      planetType,
      unitsAffected: results.length,
      totalEffects: results.reduce((sum, r) => sum + r.effectsApplied.length, 0),
    });
    
    this.emit('effects:applied', {
      planetType,
      results,
    });
    
    return results;
  }
  
  /**
   * 효과 적용 여부 확인
   */
  private shouldApplyEffect(
    effect: EnvironmentalEffect,
    unitType: GroundUnitType,
    side?: 'ATTACKER' | 'DEFENDER'
  ): boolean {
    // 대상 확인
    if (effect.affectedUnits === 'ALL') return true;
    
    if (effect.affectedUnits === 'ATTACKER' && side !== 'ATTACKER') return false;
    if (effect.affectedUnits === 'DEFENDER' && side !== 'DEFENDER') return false;
    
    if (Array.isArray(effect.affectedUnits)) {
      return effect.affectedUnits.includes(unitType);
    }
    
    return true;
  }
  
  /**
   * 개별 효과 적용
   */
  private applyEffect(
    effect: EnvironmentalEffect,
    unit: { count: number; hp: number; morale: number }
  ): {
    value: number;
    damage: number;
    heal: number;
    moraleChange: number;
    supplyDrain: number;
  } {
    const result = {
      value: 0,
      damage: 0,
      heal: 0,
      moraleChange: 0,
      supplyDrain: 0,
    };
    
    switch (effect.effectType) {
      case 'DAMAGE':
        result.damage = Math.floor(unit.count * effect.magnitude / 100);
        result.value = result.damage;
        break;
        
      case 'HEAL':
        result.heal = Math.floor(unit.hp * effect.magnitude / 100);
        result.value = result.heal;
        break;
        
      case 'MORALE_CHANGE':
        result.moraleChange = effect.magnitude;
        result.value = result.moraleChange;
        break;
        
      case 'SUPPLY_DRAIN':
        result.supplyDrain = effect.magnitude;
        result.value = result.supplyDrain;
        break;
        
      case 'EQUIPMENT_DAMAGE':
        // 장비 손상은 데미지로 환산
        result.damage = Math.floor(unit.count * effect.magnitude / 200);
        result.value = result.damage;
        break;
        
      default:
        // 다른 효과는 값만 기록
        result.value = effect.magnitude;
    }
    
    return result;
  }
  
  // ============================================================
  // Utility Methods
  // ============================================================
  
  /**
   * 모든 행성 지형 타입 조회
   */
  getAllTerrainTypes(): PlanetTerrainType[] {
    return ['TERRAN', 'OCEAN', 'DESERT', 'ICE', 'VOLCANIC', 'GAS_GIANT', 'ARTIFICIAL'];
  }
  
  /**
   * 지상전 가능 행성 타입 조회
   */
  getGroundCombatCapableTypes(): PlanetTerrainType[] {
    return this.getAllTerrainTypes().filter(t => t !== 'GAS_GIANT');
  }
  
  /**
   * 특정 유닛이 운용 가능한 행성 타입 조회
   */
  getOperableTerrainForUnit(unitType: GroundUnitType): PlanetTerrainType[] {
    const restrictions = UNIT_TERRAIN_RESTRICTIONS[unitType];
    return this.getAllTerrainTypes().filter(t => !restrictions.restricted.includes(t));
  }
  
  /**
   * 특정 행성에서 운용 가능한 유닛 타입 조회
   */
  getOperableUnitsForTerrain(planetType: PlanetType | PlanetTerrainType): GroundUnitType[] {
    const terrainType = this.convertToPlanetTerrainType(planetType);
    const unitTypes: GroundUnitType[] = ['armored', 'infantry', 'grenadier'];
    
    return unitTypes.filter(ut => {
      const restrictions = UNIT_TERRAIN_RESTRICTIONS[ut];
      return !restrictions.restricted.includes(terrainType);
    });
  }
  
  /**
   * 행성 타입 설명 조회
   */
  getTerrainDescription(planetType: PlanetType | PlanetTerrainType): string {
    const terrainType = this.convertToPlanetTerrainType(planetType);
    
    const descriptions: Record<PlanetTerrainType, string> = {
      TERRAN: '지구와 유사한 환경으로, 대부분의 작전에 적합합니다.',
      OCEAN: '대부분이 물로 덮인 세계입니다. 수륙양용 작전이 필요합니다.',
      DESERT: '극심한 더위와 모래폭풍이 특징입니다. 보급 소모가 증가합니다.',
      ICE: '극저온 환경으로, 특수 장비 없이는 생존이 어렵습니다.',
      VOLCANIC: '화산 활동이 활발하여 매우 위험한 환경입니다.',
      GAS_GIANT: '고체 지표면이 없어 지상전이 불가능합니다. 궤도 작전만 가능합니다.',
      ARTIFICIAL: '인공 구조물로, 근접전에 유리하지만 선체 손상 위험이 있습니다.',
    };
    
    return descriptions[terrainType] || '알 수 없는 지형입니다.';
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const planetTerrainService = PlanetTerrainService.getInstance();





