import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * 전투정 타입
 * - Walküre: 제국 전투기 (고기동성, 고회피)
 * - Spartanian: 동맹 전투기 (고화력, 대함공격)
 */
export type FighterType = 'walkure' | 'spartanian';

/**
 * 전투정 임무 타입
 */
export type FighterMission =
  | 'IDLE'           // 대기 (격납고 내)
  | 'LAUNCHING'      // 사출 중
  | 'PATROL'         // 순찰/호위
  | 'INTERCEPT'      // 요격 (적 전투기 공격)
  | 'ATTACK'         // 대함 공격
  | 'ESCORT'         // 함대 호위
  | 'RECON'          // 정찰
  | 'RETURNING'      // 귀환 중
  | 'DESTROYED';     // 격추됨

/**
 * 전투정 스펙 인터페이스
 */
export interface IFighterSpec {
  type: FighterType;
  name: string;
  nameKo: string;
  faction: 'EMPIRE' | 'ALLIANCE' | 'NEUTRAL';
  
  // 기동 스탯
  speed: number;           // 이동 속도 (1-100)
  maneuverability: number; // 기동성/회피율 (1-100)
  
  // 전투 스탯
  antiShip: number;        // 대함 공격력 (1-100)
  antiAir: number;         // 대공 공격력 (1-100)
  accuracy: number;        // 명중률 (1-100)
  
  // 내구도
  hp: number;              // 최대 체력
  armor: number;           // 장갑 (1-100)
  
  // 자원 소모
  fuelCapacity: number;    // 연료 용량 (작전 시간 결정)
  ammoCapacity: number;    // 탄약 용량
  
  // 파일럿 수
  pilotCount: number;      // 필요 파일럿 수 (보통 1-2)
}

/**
 * 전투정 유닛 인터페이스 (함재기 그룹)
 */
export interface IFighterSquadron {
  squadronId: string;
  type: FighterType;
  
  // 모함 정보
  motherShipId: string;     // 모함 유닛 ID
  fleetId: string;
  factionId: string;
  
  // 수량
  count: number;            // 현재 전투정 수
  maxCount: number;         // 최대 수용량
  activeCount: number;      // 출격 중인 전투정 수
  
  // 상태
  mission: FighterMission;
  targetId?: string;        // 공격 대상 (함선/전투정 ID)
  
  // 자원
  fuel: number;             // 현재 연료 (출격 시간 결정)
  maxFuel: number;
  ammo: number;             // 현재 탄약
  maxAmmo: number;
  
  // 경험/상태
  veterancy: number;        // 숙련도 (0-100)
  morale: number;           // 사기 (0-100)
  
  // 타이밍
  launchStartTick?: number; // 사출 시작 틱
  returnETA?: number;       // 귀환 예상 틱
  missionStartTick?: number; // 임무 시작 틱
  
  // 손실 기록
  losses: {
    destroyed: number;      // 격추된 전투정 수
    pilots: number;         // 전사한 파일럿 수
  };
}

/**
 * 전투정 스펙 테이블
 */
export const FIGHTER_SPECS: Record<FighterType, IFighterSpec> = {
  walkure: {
    type: 'walkure',
    name: 'Walküre',
    nameKo: '발퀴레',
    faction: 'EMPIRE',
    
    speed: 90,
    maneuverability: 95,
    
    antiShip: 40,
    antiAir: 80,
    accuracy: 85,
    
    hp: 100,
    armor: 20,
    
    fuelCapacity: 100,
    ammoCapacity: 60,
    
    pilotCount: 1,
  },
  spartanian: {
    type: 'spartanian',
    name: 'Spartanian',
    nameKo: '스파르타니안',
    faction: 'ALLIANCE',
    
    speed: 75,
    maneuverability: 70,
    
    antiShip: 85,
    antiAir: 60,
    accuracy: 80,
    
    hp: 120,
    armor: 35,
    
    fuelCapacity: 120,
    ammoCapacity: 80,
    
    pilotCount: 2,
  },
};

/**
 * 함선별 격납고(Hangar) 용량
 * carrier: 300대, battleship(제국): 50대, flagship: 100대
 */
export const HANGAR_CAPACITY: Record<string, number> = {
  carrier: 300,
  flagship: 100,
  battleship: 50,  // 제국 전함만 (isEmpire 체크 필요)
  cruiser: 0,
  destroyer: 0,
  frigate: 0,
  corvette: 0,
  transport: 0,
  engineering: 0,
};

/**
 * 대공포 화력 (함선별)
 * 전투정 요격 시 사용
 */
export const ANTI_AIR_POWER: Record<string, number> = {
  carrier: 80,
  flagship: 100,
  battleship: 120,
  cruiser: 60,
  destroyer: 40,
  frigate: 30,
  corvette: 20,
  transport: 10,
  engineering: 10,
};

/**
 * FighterGroup Document (MongoDB)
 * 함대 내 전투정 그룹 관리
 */
export interface IFighterGroup extends Document {
  groupId: string;
  sessionId: string;
  fleetId: string;
  factionId: string;
  
  // 편대 목록
  squadrons: IFighterSquadron[];
  
  // 전체 통계
  totalFighters: number;
  totalActive: number;
  
  // 타임스탬프
  createdAt: Date;
  updatedAt: Date;
}

const FighterSquadronSchema = new Schema<IFighterSquadron>({
  squadronId: { type: String, required: true },
  type: { type: String, enum: ['walkure', 'spartanian'], required: true },
  
  motherShipId: { type: String, required: true },
  fleetId: { type: String, required: true },
  factionId: { type: String, required: true },
  
  count: { type: Number, default: 0, min: 0 },
  maxCount: { type: Number, default: 0, min: 0 },
  activeCount: { type: Number, default: 0, min: 0 },
  
  mission: {
    type: String,
    enum: ['IDLE', 'LAUNCHING', 'PATROL', 'INTERCEPT', 'ATTACK', 'ESCORT', 'RECON', 'RETURNING', 'DESTROYED'],
    default: 'IDLE',
  },
  targetId: String,
  
  fuel: { type: Number, default: 100 },
  maxFuel: { type: Number, default: 100 },
  ammo: { type: Number, default: 100 },
  maxAmmo: { type: Number, default: 100 },
  
  veterancy: { type: Number, default: 0, min: 0, max: 100 },
  morale: { type: Number, default: 100, min: 0, max: 100 },
  
  launchStartTick: Number,
  returnETA: Number,
  missionStartTick: Number,
  
  losses: {
    destroyed: { type: Number, default: 0 },
    pilots: { type: Number, default: 0 },
  },
}, { _id: false });

const FighterGroupSchema = new Schema<IFighterGroup>({
  groupId: { type: String, required: true },
  sessionId: { type: String, required: true },
  fleetId: { type: String, required: true },
  factionId: { type: String, required: true },
  
  squadrons: { type: [FighterSquadronSchema], default: [] },
  
  totalFighters: { type: Number, default: 0 },
  totalActive: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Indexes
FighterGroupSchema.index({ groupId: 1, sessionId: 1 }, { unique: true });
FighterGroupSchema.index({ sessionId: 1, fleetId: 1 });
FighterGroupSchema.index({ sessionId: 1, factionId: 1 });

/**
 * Pre-save hook to calculate totals
 */
FighterGroupSchema.pre('save', function(next) {
  this.totalFighters = this.squadrons.reduce((sum, sq) => sum + sq.count, 0);
  this.totalActive = this.squadrons.reduce((sum, sq) => sum + sq.activeCount, 0);
  next();
});

export const FighterGroup: Model<IFighterGroup> =
  mongoose.models.FighterGroup || mongoose.model<IFighterGroup>('FighterGroup', FighterGroupSchema);

// ============================================================================
// 전투정 관련 상수
// ============================================================================

/**
 * 사출 시간 (틱)
 * - 모함에서 전투정 출격까지 필요한 시간
 */
export const LAUNCH_DELAY_TICKS = 5; // 약 0.3초 (60ms per tick)

/**
 * 귀환 시간 (틱)
 * - 착함 및 보급까지 필요한 시간
 */
export const RECOVERY_DELAY_TICKS = 10;

/**
 * 사출 중 모함 방어력 감소율
 * - 격납고 개방으로 인한 취약성
 */
export const LAUNCH_DEFENSE_PENALTY = 0.2; // 20% 방어력 감소

/**
 * 전투정 출격 중 연료 소모율 (tick당)
 */
export const FIGHTER_FUEL_CONSUMPTION_PER_TICK = 0.1;

/**
 * 전투정 공격 시 탄약 소모
 */
export const FIGHTER_AMMO_CONSUMPTION_PER_ATTACK = 5;

/**
 * 대함 공격 성공 시 속도 감소 디버프
 */
export const ANTI_SHIP_SPEED_DEBUFF = 0.3; // 30% 속도 감소

/**
 * 대함 공격 성공 시 디버프 지속 시간 (틱)
 */
export const ANTI_SHIP_DEBUFF_DURATION_TICKS = 100;

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 팩션에 따른 기본 전투정 타입 결정
 */
export function getDefaultFighterType(factionId: string, isEmpire: boolean): FighterType {
  return isEmpire ? 'walkure' : 'spartanian';
}

/**
 * 함선이 전투정을 탑재할 수 있는지 확인
 */
export function canCarryFighters(shipClass: string, isEmpire: boolean): boolean {
  if (shipClass === 'carrier' || shipClass === 'flagship') {
    return true;
  }
  // 제국 전함만 소수의 전투정 탑재 가능
  if (shipClass === 'battleship' && isEmpire) {
    return true;
  }
  return false;
}

/**
 * 함선의 격납고 용량 반환
 */
export function getHangarCapacity(shipClass: string, isEmpire: boolean): number {
  if (shipClass === 'battleship') {
    return isEmpire ? HANGAR_CAPACITY.battleship : 0;
  }
  return HANGAR_CAPACITY[shipClass] || 0;
}

/**
 * 공전(Dogfight) 결과 계산
 * @returns 승리한 측과 손실 수
 */
export function calculateDogfightResult(
  attackerType: FighterType,
  attackerCount: number,
  attackerVeterancy: number,
  defenderType: FighterType,
  defenderCount: number,
  defenderVeterancy: number
): { attackerLosses: number; defenderLosses: number } {
  const attackerSpec = FIGHTER_SPECS[attackerType];
  const defenderSpec = FIGHTER_SPECS[defenderType];
  
  // 공대공 전투력 계산
  const attackerPower = attackerCount * attackerSpec.antiAir * 
    (1 + attackerVeterancy / 100) * (attackerSpec.maneuverability / 100);
  const defenderPower = defenderCount * defenderSpec.antiAir * 
    (1 + defenderVeterancy / 100) * (defenderSpec.maneuverability / 100);
  
  // 총 전투력
  const totalPower = attackerPower + defenderPower;
  if (totalPower === 0) {
    return { attackerLosses: 0, defenderLosses: 0 };
  }
  
  // 손실 비율 계산 (상대 전투력 비례)
  const attackerLossRatio = defenderPower / totalPower * 0.3; // 최대 30% 손실
  const defenderLossRatio = attackerPower / totalPower * 0.3;
  
  // 회피율 적용
  const attackerEvasion = attackerSpec.maneuverability / 200; // 0~50% 회피
  const defenderEvasion = defenderSpec.maneuverability / 200;
  
  const attackerLosses = Math.floor(attackerCount * attackerLossRatio * (1 - attackerEvasion));
  const defenderLosses = Math.floor(defenderCount * defenderLossRatio * (1 - defenderEvasion));
  
  return { attackerLosses, defenderLosses };
}

/**
 * 대함 공격 데미지 계산
 */
export function calculateAntiShipDamage(
  fighterType: FighterType,
  fighterCount: number,
  fighterVeterancy: number,
  targetShipClass: string,
  targetAntiAir: number
): { damage: number; fighterLosses: number; speedDebuff: boolean } {
  const spec = FIGHTER_SPECS[fighterType];
  
  // 기본 데미지 계산
  const baseDamage = fighterCount * spec.antiShip * (1 + fighterVeterancy / 100);
  
  // 명중률 적용 (함선 크기에 따른 보정)
  const sizeMultiplier: Record<string, number> = {
    flagship: 1.5,
    carrier: 1.4,
    battleship: 1.3,
    cruiser: 1.0,
    destroyer: 0.7,
    frigate: 0.5,
    corvette: 0.3,
    transport: 1.2,
    engineering: 0.8,
  };
  const hitRate = (spec.accuracy / 100) * (sizeMultiplier[targetShipClass] || 1.0);
  
  // 대공포에 의한 전투정 손실
  const antiAirEffectiveness = targetAntiAir / 100;
  const fighterLosses = Math.floor(fighterCount * antiAirEffectiveness * 0.2);
  
  // 최종 데미지
  const effectiveFighters = fighterCount - fighterLosses;
  const damage = Math.floor(baseDamage * hitRate * (effectiveFighters / fighterCount));
  
  // 속도 감소 디버프 적용 여부 (일정 데미지 이상일 때)
  const speedDebuff = damage > 100;
  
  return { damage, fighterLosses, speedDebuff };
}













