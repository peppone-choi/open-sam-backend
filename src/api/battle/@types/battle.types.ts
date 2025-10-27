/**
 * Battle 도메인 타입 정의
 */

export interface IBattle {
  id: string;
  sessionId: string;
  
  // 전투 참가자
  attackerGeneralId: string;
  defenderGeneralId: string;
  
  // 전투 정보
  cityId?: string;
  battleType: 'field' | 'siege' | 'ambush';
  
  // 병력 정보
  attackerTroops: number;
  defenderTroops: number;
  
  // 결과
  status: 'pending' | 'in_progress' | 'completed';
  winnerId?: string;
  
  // 손실
  attackerLosses?: number;
  defenderLosses?: number;
  
  // 전투 로그
  battleLog?: any[];
  
  startTime?: Date;
  endTime?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}
