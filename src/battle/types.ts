import type { GameUnitDetail } from '../const/GameUnitConst';

export interface BattleGeneralInput {
  generalId: number;
  name: string;
  nationId: number;
  officerLevel?: number;
  crewTypeId: number;
  crew: number;
  train: number;
  atmos: number;
  leadership: number;
  strength: number;
  intel: number;
  dex1?: number;
  dex2?: number;
  dex3?: number;
  dex4?: number;
  dex5?: number;
  rice?: number;
  injury?: number;
  specialSkills?: string[];
  inheritBuff?: Partial<{
    warAvoidRatio: number;
    warCriticalRatio: number;
    warMagicTrialProb: number;
    warAvoidRatioOppose: number;
    warCriticalRatioOppose: number;
    warMagicTrialProbOppose: number;
  }>;
}

export interface BattleNationInfo {
  nationId: number;
  name: string;
  type?: string;
  level?: number;
  tech?: number;
  capitalCityId?: number;
}

export interface BattleCityInfo {
  cityId: number;
  name: string;
  level: number;
  defence: number;
  wall: number;
  nationId?: number;
  gate?: number;
  wallMax?: number;
  gateMax?: number;
  towerLevel?: number;
}

export interface BattleSideInput {
  side: 'attackers' | 'defenders';
  nation: BattleNationInfo;
  generals: BattleGeneralInput[];
  moraleBonus?: number;
  trainBonus?: number;
  cityBonus?: number;
}

export interface BattleConfig {
  attackers: BattleSideInput;
  defenders: BattleSideInput;
  city?: BattleCityInfo;
  maxTurns?: number;
  scenarioId?: string;
  seed?: string;
}

export interface BattleUnitState {
  generalId: number;
  name: string;
  nationId: number;
  side: 'attackers' | 'defenders';
  stats: BattleGeneralInput;
  unit: GameUnitDetail;
  maxHP: number;
  hp: number;
  train: number;
  atmos: number;
  moraleBonus: number;
  trainBonus: number;
  alive: boolean;
}

export interface BattleActionLog {
  attackerId: number;
  defenderId: number;
  damage: number;
  remainingHP: number;
  turn: number;
}

export interface BattleTurnLog {
  turn: number;
  actions: BattleActionLog[];
}

export interface BattleSummary {
  winner: 'attackers' | 'defenders' | 'draw';
  turns: number;
  attackerCasualties: number;
  defenderCasualties: number;
  attackerRiceUsed: number;
  defenderRiceUsed: number;
}

export interface BattleSimulationResult {
  summary: BattleSummary;
  turnLogs: BattleTurnLog[];
  unitStates: BattleUnitState[];
  battleLog?: string[];
  battleDetailLog?: string[];
}
