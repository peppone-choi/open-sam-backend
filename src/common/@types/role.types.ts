/**
 * Lore 중립 Role 시스템
 * 
 * 시나리오마다 다른 용어를 사용하지만 동일한 게임 역할을 추상화
 */

/**
 * 게임 역할 (Lore 중립)
 */
export enum Role {
  // 핵심 게임 엔티티
  SETTLEMENT = 'SETTLEMENT',  // 거점 (도시/행성/마을/기지)
  COMMANDER = 'COMMANDER',    // 지휘관 (장수/영웅/커맨더/대장)
  FACTION = 'FACTION',        // 세력 (국가/왕국/세력/조직)
  FORCE = 'FORCE',            // 전투 단위 (부대/군단/함대/소대)
  DIPLOMACY = 'DIPLOMACY',    // 외교 관계
  
  // 게임 시스템 엔티티
  ITEM = 'ITEM',              // 아이템 (무기/방어구/소모품)
  AUCTION = 'AUCTION',        // 경매
  BID = 'BID',                // 입찰
  POST = 'POST',              // 게시글 (board/message/comment 통합)
  VOTE = 'VOTE',              // 투표/반응
  
  // 메타 엔티티
  USER = 'USER',              // 유저
  LOG_ENTRY = 'LOG_ENTRY',    // 로그/히스토리 (범용)
  RESERVATION = 'RESERVATION', // 예약
  NPC_POOL = 'NPC_POOL',      // NPC 풀
}

/**
 * 시나리오 ID
 */
export type ScenarioId = string; // 'sangokushi' | 'fantasy' | 'sf' | ...

/**
 * 엔티티 ID
 */
export type EntityId = string;

/**
 * Role 기반 참조 (Lore 중립)
 */
export interface RoleRef<R extends Role = Role> {
  role: R;
  id: EntityId;
  scenario: ScenarioId;
}

/**
 * 관계 키 (Lore 중립)
 */
export type RelationKey =
  | 'ASSIGNED_SETTLEMENT'  // 지휘관 → 소속 거점
  | 'OWNS'                 // 세력 → 소유 거점
  | 'GARRISONED_AT'        // 병력 → 주둔 거점
  | 'LEADS'                // 지휘관 → 지휘 병력
  | 'MEMBER_OF'            // 지휘관 → 소속 세력
  | 'ALLIED_WITH'          // 세력 → 동맹 세력
  | 'AT_WAR_WITH';         // 세력 → 전쟁 세력

/**
 * 글로벌 ID 생성
 */
export function gid(ref: RoleRef): string {
  return `${ref.scenario}:${ref.role}:${ref.id}`;
}

/**
 * 글로벌 ID 파싱
 */
export function parseGid(gid: string): RoleRef | null {
  const parts = gid.split(':');
  if (parts.length !== 3) return null;
  
  return {
    scenario: parts[0],
    role: parts[1] as Role,
    id: parts[2]
  };
}

/**
 * RoleRef 생성 헬퍼
 */
export function createRef<R extends Role>(
  role: R,
  id: EntityId,
  scenario: ScenarioId
): RoleRef<R> {
  return { role, id, scenario };
}
