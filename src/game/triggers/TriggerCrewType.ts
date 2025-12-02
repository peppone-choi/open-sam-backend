/**
 * 병종 타입 트리거
 * PHP 대응: core/hwe/sammo/GameUnitDetail.php
 * 
 * 병종에 따른 전투 보너스/페널티 적용
 */

import type { GameAction } from '../actions/Action';
import type { WarUnit } from '../../battle/WarUnit';
import type { WarUnitTriggerCaller } from './WarUnitTriggerCaller';

/**
 * 병종 타입 상수
 * PHP 대응: GameUnitConstBase
 */
export const CrewArmType = {
  T_CASTLE: 0,    // 성벽
  T_FOOTMAN: 1,   // 보병
  T_ARCHER: 2,    // 궁병
  T_CAVALRY: 3,   // 기병
  T_WIZARD: 4,    // 귀병
  T_SIEGE: 5,     // 차병
  T_MISC: 6,      // 기타
} as const;

export type ArmType = typeof CrewArmType[keyof typeof CrewArmType];

/**
 * 기본 병종 정보
 */
export interface CrewTypeInfo {
  id: number;
  armType: ArmType;
  name: string;
  attack: number;
  defence: number;
  speed: number;
  avoid: number;
  magicCoef: number;
  cost: number;
  rice: number;
  attackCoef: Record<number, number>;  // 상대 병종별 공격 계수
  defenceCoef: Record<number, number>; // 상대 병종별 방어 계수
}

/**
 * 기본 병종 데이터
 * PHP GameUnitConstBase::getBuildData() 간소화 버전
 */
const DEFAULT_CREW_TYPES: Record<number, CrewTypeInfo> = {
  // 보병 (기본)
  1100: {
    id: 1100,
    armType: CrewArmType.T_FOOTMAN,
    name: '보병',
    attack: 100,
    defence: 150,
    speed: 7,
    avoid: 10,
    magicCoef: 0,
    cost: 9,
    rice: 9,
    attackCoef: { [CrewArmType.T_ARCHER]: 1.2, [CrewArmType.T_CAVALRY]: 0.8, [CrewArmType.T_SIEGE]: 1.2 },
    defenceCoef: { [CrewArmType.T_ARCHER]: 0.8, [CrewArmType.T_CAVALRY]: 1.2, [CrewArmType.T_SIEGE]: 0.8 },
  },
  // 궁병 (기본)
  1200: {
    id: 1200,
    armType: CrewArmType.T_ARCHER,
    name: '궁병',
    attack: 100,
    defence: 100,
    speed: 7,
    avoid: 10,
    magicCoef: 0,
    cost: 10,
    rice: 10,
    attackCoef: { [CrewArmType.T_CAVALRY]: 1.2, [CrewArmType.T_FOOTMAN]: 0.8, [CrewArmType.T_SIEGE]: 1.2 },
    defenceCoef: { [CrewArmType.T_CAVALRY]: 0.8, [CrewArmType.T_FOOTMAN]: 1.2, [CrewArmType.T_SIEGE]: 0.8 },
  },
  // 기병 (기본)
  1300: {
    id: 1300,
    armType: CrewArmType.T_CAVALRY,
    name: '기병',
    attack: 150,
    defence: 100,
    speed: 10,
    avoid: 15,
    magicCoef: 0,
    cost: 15,
    rice: 15,
    attackCoef: { [CrewArmType.T_FOOTMAN]: 1.2, [CrewArmType.T_ARCHER]: 0.8, [CrewArmType.T_SIEGE]: 1.2 },
    defenceCoef: { [CrewArmType.T_FOOTMAN]: 0.8, [CrewArmType.T_ARCHER]: 1.2, [CrewArmType.T_SIEGE]: 0.8 },
  },
  // 귀병 (기본)
  1400: {
    id: 1400,
    armType: CrewArmType.T_WIZARD,
    name: '귀병',
    attack: 100,
    defence: 100,
    speed: 7,
    avoid: 10,
    magicCoef: 0.5,
    cost: 12,
    rice: 12,
    attackCoef: {},
    defenceCoef: {},
  },
  // 차병 (기본)
  1500: {
    id: 1500,
    armType: CrewArmType.T_SIEGE,
    name: '차병',
    attack: 200,
    defence: 50,
    speed: 5,
    avoid: 0,
    magicCoef: 0,
    cost: 20,
    rice: 20,
    attackCoef: { [CrewArmType.T_CASTLE]: 2.0 },
    defenceCoef: { [CrewArmType.T_FOOTMAN]: 1.2, [CrewArmType.T_ARCHER]: 1.2, [CrewArmType.T_CAVALRY]: 1.2 },
  },
};

export class TriggerCrewType implements GameAction {
  private crewInfo: CrewTypeInfo;
  
  constructor(crewTypeId: number) {
    this.crewInfo = DEFAULT_CREW_TYPES[crewTypeId] || DEFAULT_CREW_TYPES[1100];
  }
  
  get id(): number {
    return this.crewInfo.id;
  }
  
  get armType(): ArmType {
    return this.crewInfo.armType;
  }
  
  get name(): string {
    return this.crewInfo.name;
  }
  
  /**
   * 내정 계산 보정 (병종은 영향 없음)
   */
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return value;
  }
  
  /**
   * 스탯 계산 보정 (병종은 영향 없음)
   */
  onCalcStat(general: any, statName: string, value: any, aux?: any): any {
    return value;
  }
  
  /**
   * 상대 스탯 계산 보정
   */
  onCalcOpposeStat(general: any, statName: string, value: any, aux?: any): any {
    return value;
  }
  
  /**
   * 전투력 배수
   * PHP 대응: GameUnitDetail에서 attackCoef, defenceCoef 적용
   */
  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    // 기본적으로 병종 상성은 WarUnit 레벨에서 처리
    // 여기서는 기본 배수만 반환
    return [1, 1];
  }
  
  /**
   * 병종 정보 조회
   */
  getInfo(): CrewTypeInfo {
    return this.crewInfo;
  }
  
  /**
   * 상대 병종에 대한 공격 계수
   */
  getAttackCoef(targetArmType: ArmType): number {
    return this.crewInfo.attackCoef[targetArmType] ?? 1;
  }
  
  /**
   * 상대 병종에 대한 방어 계수
   */
  getDefenceCoef(targetArmType: ArmType): number {
    return this.crewInfo.defenceCoef[targetArmType] ?? 1;
  }
  
  getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    // TODO: 병종별 전투 시작 트리거 (궁병 선제사격 등)
    return null;
  }
  
  getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    // TODO: 병종별 전투 페이즈 트리거
    return null;
  }
}

/**
 * 병종 타입 트리거 팩토리
 * @param crewTypeId 병종 ID (기본값 1100: 보병)
 */
export function createCrewTypeTrigger(crewTypeId: number = 1100): TriggerCrewType {
  return new TriggerCrewType(crewTypeId);
}

/**
 * 병종 ID로 병종 정보 조회
 */
export function getCrewTypeInfo(crewTypeId: number): CrewTypeInfo | null {
  return DEFAULT_CREW_TYPES[crewTypeId] ?? null;
}




