/**
 * City 도메인 타입 정의
 * schema.sql의 city 테이블 기반
 */

export interface ICity {
  id: string;
  
  // 게임 세션 (중요!)
  sessionId: string; // GameSession ID - 데이터 격리
  
  name: string;
  level: number; // 도시 레벨
  nation?: string; // nationId
  
  // 보급/전선
  supply: number; // 보급 상태
  front: boolean; // 전선 여부
  
  // 인구
  pop: number; // 현재 인구
  popMax: number; // 최대 인구
  dead: number; // 사망자
  
  // 내정 수치
  agri: number; // 농업
  agriMax: number;
  comm: number; // 상업
  commMax: number;
  secu: number; // 치안
  secuMax: number;
  trust: number; // 민심
  trade: number; // 시세 (100이 표준)
  
  // 방어 시설
  def: number; // 방어력
  defMax: number;
  wall: number; // 성벽
  wallMax: number;
  
  // 관리
  officerSet: number; // 임명된 관리
  state: number; // 상태
  region: number; // 지역
  term: number; // 기간
  
  // JSON 필드
  conflict: Record<string, any>; // 전투 정보
  
  createdAt: Date;
  updatedAt: Date;
}
