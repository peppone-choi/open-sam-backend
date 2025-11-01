/**
 * Admin 도메인 타입 정의
 */

// 게임 설정
export interface IGameConfig {
  id: string;
  
  // 병종 상성 설정
  unitAdvantage: UnitAdvantageConfig;
  
  // 게임 밸런스 설정
  balance: GameBalanceConfig;
  
  // 턴 설정
  turnConfig: TurnConfig;
  
  // 경험치 설정
  expConfig: ExpConfig;
  
  version: string;
  updatedAt: Date;
  updatedBy: string; // 수정한 관리자 ID
}

// 병종 상성 설정
export interface UnitAdvantageConfig {
  // 병종 ID: [강한 병종 ID 목록]
  // 예: 1100(보병): [1200(궁병)] - 보병이 궁병에게 강함
  advantages: Record<number, number[]>;
  
  // 상성 배율 (기본값: 1.2)
  advantageMultiplier: number;
  
  // 역상성 배율 (기본값: 0.8)
  disadvantageMultiplier: number;
  
  // 병종 정보
  units: UnitInfo[];
}

export interface UnitInfo {
  id: number; // 병종 ID (1100, 1200, 1300 등)
  name: string; // 병종명 (보병, 궁병, 기병)
  type: 'INFANTRY' | 'ARCHER' | 'CAVALRY' | 'SPECIAL';
  description: string;
  
  // 기본 스탯
  baseAttack: number;
  baseDefense: number;
  baseMobility: number;
  
  // 비용
  recruitCost: number; // 징병 비용
  hiringCost: number; // 모병 비용
  maintenanceCost: number; // 유지비
  
  // 필요 조건
  requiredTech?: number; // 필요 기술력
  requiredFacility?: string; // 필요 시설
}

// 게임 밸런스 설정
export interface GameBalanceConfig {
  // 내정 효율
  domestic: {
    agriculture: number; // 농업 효율
    commerce: number; // 상업 효율
    technology: number; // 기술 효율
    defense: number; // 방어 효율
    wall: number; // 성벽 효율
    security: number; // 치안 효율
    settlement: number; // 정착 효율
    governance: number; // 선정 효율
  };
  
  // 군사 효율
  military: {
    trainEfficiency: number; // 훈련 효율
    moraleEfficiency: number; // 사기 효율
    recruitmentRate: number; // 징병율
    hiringRate: number; // 모병율
  };
  
  // 자원 생산
  production: {
    goldPerPopulation: number; // 인구당 금 생산
    ricePerAgriculture: number; // 농업당 쌀 생산
    taxRate: number; // 기본 세율
  };
  
  // 전투
  combat: {
    baseDamage: number; // 기본 데미지
    criticalRate: number; // 크리티컬 확률
    criticalMultiplier: number; // 크리티컬 배율
    retreatThreshold: number; // 퇴각 임계값
  };
}

// 턴 설정
export interface TurnConfig {
  turnDuration: number; // 턴 시간 (초)
  maxTurnsPerDay: number; // 일일 최대 턴 수
  
  // CP 설정
  pcp: {
    max: number; // 최대 PCP
    recovery: number; // 턴당 PCP 회복량
  };
  
  mcp: {
    max: number; // 최대 MCP
    recovery: number; // 턴당 MCP 회복량
  };
}

// 경험치 설정
export interface ExpConfig {
  // 레벨업 필요 경험치
  levelUpExp: number[];
  
  // 스탯별 경험치 획득량
  leadership: {
    domestic: number; // 내정으로 획득
    military: number; // 군사로 획득
  };
  
  strength: {
    combat: number; // 전투로 획득
    training: number; // 훈련으로 획득
  };
  
  intel: {
    research: number; // 연구로 획득
    stratagem: number; // 계략으로 획득
  };
}

// Admin 사용자
export interface IAdminUser {
  id: string;
  username: string;
  password: string; // hashed
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';
  permissions: AdminPermission[];
  createdAt: Date;
  updatedAt: Date;
}

export enum AdminPermission {
  // 게임 설정
  MANAGE_CONFIG = 'MANAGE_CONFIG',
  
  // 도메인 관리
  MANAGE_GENERALS = 'MANAGE_GENERALS',
  MANAGE_CITIES = 'MANAGE_CITIES',
  MANAGE_NATIONS = 'MANAGE_NATIONS',
  MANAGE_COMMANDS = 'MANAGE_COMMANDS',
  
  // 게임 세션
  MANAGE_SESSIONS = 'MANAGE_SESSIONS',
  
  // 사용자
  MANAGE_USERS = 'MANAGE_USERS',
  
  // 시스템
  VIEW_LOGS = 'VIEW_LOGS',
  EXECUTE_SCRIPTS = 'EXECUTE_SCRIPTS',
}

// Admin 로그
export interface IAdminLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string; // 수행한 작업
  resource: string; // 대상 리소스
  resourceId?: string;
  changes: Record<string, any>; // 변경 내용
  ip: string;
  timestamp: Date;
}
