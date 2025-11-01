/**
 * UpdateGameSessionDto
 * 
 * 게임 세션 업데이트 요청 DTO
 */
export interface UpdateGameSessionDto {
  status?: 'waiting' | 'running' | 'paused' | 'finished';
  currentYear?: number;
  currentMonth?: number;
  title?: string;
  config?: {
    joinRuinedNPCProp?: number;
    npcBanMessageProb?: number;
    defaultMaxGeneral?: number;
    fiction?: number;
    life?: number;
  };
}
