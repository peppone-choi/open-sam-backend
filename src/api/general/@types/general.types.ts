/**
 * General 도메인 타입 정의
 * schema.sql의 general 테이블 기반
 */

export interface IGeneral {
  id: string;
  
  // 게임 세션 (중요!)
  sessionId: string; // GameSession ID - 데이터 격리
  
  // 기본 정보
  name: string;
  owner?: string; // user ID
  ownerName?: string;
  npc: boolean; // NPC 여부
  npcOrg?: boolean; // 원래 NPC였는지
  
  // 국가/위치
  nation?: string; // nationId
  city?: string; // cityId
  troop?: string; // troopId
  
  // 능력치 (삼국지: 통솔, 무력, 지력)
  leadership: number; // 통솔
  leadershipExp: number;
  strength: number; // 무력
  strengthExp: number;
  intel: number; // 지력
  intelExp: number;
  
  // 직책 (officer)
  officerLevel: number; // 0: 일반, 1: 군주, 2: 승상 등
  officerCity?: string;
  permission: 'normal' | 'auditor' | 'ambassador';
  
  // 자원
  gold: number;
  rice: number;
  
  // 병력
  crew: number; // 병사 수
  crewType: number; // 병종 (1100: 보병, 1200: 궁병, 1300: 기병 등)
  train: number; // 훈련도
  atmos: number; // 사기
  
  // 장비
  weapon: string; // 무기명
  book: string; // 병서명
  horse: string; // 말명
  item: string; // 아이템명
  
  // 특기
  personal: string; // 특기 (귀병, 기병, 보병, 궁병, 무쌍 등)
  special: string; // 특수 기술
  specAge: number; // 특수 기술 습득 나이
  special2: string; // 특수 기술 2
  specAge2: number;
  
  // 경험치 & 헌신도
  experience: number;
  dedication: number;
  dedLevel: number;
  expLevel: number;
  
  // 특기 레벨
  dex1: number;
  dex2: number;
  dex3: number;
  dex4: number;
  dex5: number;
  
  // 턴/시간
  turnTime: Date;
  recentWar?: Date;
  
  // 상태
  injury: number; // 부상도
  age: number;
  startAge: number;
  birthYear: number;
  deadYear: number;
  
  // 소속/배신
  belong: number; // 소속 (1: 정상)
  betray: number; // 배신 횟수
  affinity: number; // 친화도
  
  // 이미지
  picture: string;
  imgServer: number;
  
  // NPC 메시지
  npcMsg?: string;
  newMsg: boolean;
  
  // 기타
  makeLimiturn?: number;
  killTurn?: number;
  block: boolean;
  defenceTrain: number; // 방어 훈련도
  tournament: number;
  newVote: boolean;
  
  // JSON 필드
  lastTurn: Record<string, any>; // 마지막 턴 정보
  aux: Record<string, any>; // 보조 데이터
  penalty: Record<string, any>; // 패널티 정보
  
  createdAt: Date;
  updatedAt: Date;
}

// TODO: DTO 타입 정의
export interface CreateGeneralDto {
  name: string;
  leadership?: number;
  strength?: number;
  intel?: number;
  politics?: number;
}

export interface UpdateGeneralDto {
  name?: string;
  leadership?: number;
  strength?: number;
  intel?: number;
  politics?: number;
}
