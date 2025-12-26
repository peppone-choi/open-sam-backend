/**
 * 3D 전투 시스템 타입 정의
 */

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export enum HeightLevel {
  DEEP_WATER = -2,
  SHALLOW_WATER = -1,
  GROUND = 0,
  HILL_LOW = 2,
  HILL_MID = 5,
  HILL_HIGH = 8,
  WALL_1F = 10,
  WALL_2F = 12,
  WALL_3F = 14,
  FLYING_LOW = 15,
  FLYING_HIGH = 18,
  MAX_HEIGHT = 19
}

export enum TerrainType {
  PLAIN = 'PLAIN',
  SHALLOW_WATER = 'SHALLOW_WATER',
  DEEP_WATER = 'DEEP_WATER',
  HILL_LOW = 'HILL_LOW',
  HILL_MID = 'HILL_MID',
  HILL_HIGH = 'HILL_HIGH',
  CLIFF = 'CLIFF',
  WALL = 'WALL',
  GATE = 'GATE',
  TOWER = 'TOWER',
  SKY = 'SKY'
}

export enum UnitType {
  FOOTMAN = 'FOOTMAN',
  CAVALRY = 'CAVALRY',
  ARCHER = 'ARCHER',
  WIZARD = 'WIZARD',
  SIEGE = 'SIEGE'
}

export interface BattleTile3D {
  x: number;
  y: number;
  z: number;
  type: TerrainType;
  walkable: boolean;
  flyable: boolean;
  occupied?: string;
  building?: Building;
}

export interface Building {
  type: 'wall' | 'gate' | 'tower' | 'throne';
  hp: number;
  maxHp: number;
  z: number;
}

export interface BattleUnit3D {
  id: string;
  name: string;
  generalId: number;
  playerId: number;
  side: 'attacker' | 'defender';
  position: Position3D;

  troops: number;
  maxTroops: number;
  hp: number;
  maxHp: number;

  unitType: UnitType;
  leadership: number;
  strength: number;
  intelligence: number;

  morale: number;
  training: number;

  canFly?: boolean;
  maxAltitude?: number;
  canClimb?: boolean;
  maxClimbHeight?: number;

  speed: number;
  attackRange: number;
  visionRange: number;

  skills?: string[];
  buffs?: Buff[];
  debuffs?: Debuff[];

  hasActed: boolean;
  afkTurns: number;
}

export interface Buff {
  type: string;
  value: number;
  duration: number;
}

export interface Debuff {
  type: string;
  value: number;
  duration: number;
}

export interface HeightBonus {
  attackBonus: number;
  defenseBonus: number;
  rangeBonus: number;
  visionBonus: number;
}

export type Action =
  | { type: 'move'; unitId: string; path: Position3D[] }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'defend'; unitId: string }
  | { type: 'skill'; unitId: string; skillId: string; target: Position3D }
  | { type: 'wait'; unitId: string }
  | { type: 'retreat'; unitId: string }
  | { type: 'fire'; unitId: string; target: Position3D }
  | { type: 'ambush'; unitId: string }
  | { type: 'duel'; unitId: string; targetId: string }
  | { type: 'stone'; unitId: string; targetId: string }
  | { type: 'misinform'; unitId: string; targetId: string }
  | { type: 'discord'; unitId: string; targetId: string }
  | { type: 'confuse'; unitId: string; targetId: string };

export type WeatherType = 'clear' | 'rain' | 'wind' | 'snow' | 'heat';

export interface TileEffect {
  type: 'fire' | 'pit' | 'rubble';
  duration: number;
  value: number;
}

export interface BattleState {
  battleId: string;
  currentTurn: number;
  phase: 'preparing' | 'deployment' | 'planning' | 'resolution' | 'finished';
  weather: WeatherType;
  tileEffects: Map<string, TileEffect>; // key: "x,y"

  map: BattleTile3D[][];
  units: Map<string, BattleUnit3D>;
  buildings: Building[];

  attackerPlayerId: number;
  defenderPlayerId: number;

  planningDeadline?: Date;
  turnSeconds: number;
  resolutionSeconds: number;

  actions: Map<string, Action>;
  readyPlayers: Set<number>;
  aiControlled: Set<string>;

  winner?: 'attacker' | 'defender' | 'draw';
  battleLog: string[];
}

export interface ResolutionResult {
  casualties: Map<string, number>;
  moraleLosses: Map<string, number>;
  buildingDamage: Map<string, number>;
  positions: Map<string, Position3D>;
  effects: string[];
}

export interface VictoryCondition {
  type: 'throne_captured' | 'elimination' | 'time_limit' | 'surrender' | 'retreat';
  winner: 'attacker' | 'defender';
  reason: string;
}
