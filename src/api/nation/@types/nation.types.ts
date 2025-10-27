/**
 * Nation 도메인 타입 정의
 * schema.sql의 nation 테이블 기반
 */

export interface INation {
  id: string;
  
  // 게임 세션 (중요!)
  sessionId: string; // GameSession ID - 데이터 격리
  
  name: string;
  color: string; // 국가 색상
  
  // 수도
  capital: number;
  capSet: string; // cityId
  
  // 인구 & 자원
  genNum: number; // 장수 수
  gold: number;
  rice: number;
  
  // 세율
  bill: number;
  rate: number;
  rateTemp: number;
  
  // 외교/정보
  secretLimit: number; // 밀서 제한
  chiefSet: number; // 군주 설정
  scout: boolean; // 정찰
  war: boolean; // 전쟁 상태
  
  // 커맨드
  strategicCmdLimit: number; // 전략 명령 제한
  surLimit: number; // 턴 제한
  
  // 국력
  tech: number; // 기술력
  power: number; // 국력
  level: number; // 레벨
  type: string; // 국가 타입 (che_중립 등)
  
  // JSON 필드
  spy: Record<string, any>; // 첩보 정보
  aux: Record<string, any>; // 보조 데이터
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNationDto {
  name: string;
  color: string;
  type?: string;
}

export interface UpdateNationDto {
  name?: string;
  color?: string;
  capital?: number;
  rate?: number;
}
