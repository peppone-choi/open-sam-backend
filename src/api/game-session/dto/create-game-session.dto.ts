/**
 * CreateGameSessionDto
 * 
 * 게임 세션 생성 요청 DTO
 */
export interface CreateGameSessionDto {
  scenarioId: string; // 필수: Entity의 scenario 필드와 매칭
  title?: string; // 선택: 기본값 "새 게임"
  startYear?: number; // 선택: 기본값 220
  mapName?: string; // 선택: 기본값 "che"
  gameMode?: 'turnBased' | 'realtime'; // 선택: 기본값 "turnBased"
  turnInterval?: number; // 선택: 기본값 300 (5분)
  config?: {
    joinRuinedNPCProp?: number;
    npcBanMessageProb?: number;
    defaultMaxGeneral?: number;
    fiction?: number;
    life?: number;
  };
}
