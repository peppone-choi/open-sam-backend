import { GeneralRecord } from '../../models/general_record.model';
import { WorldHistory } from '../../models/world_history.model';

/**
 * GetBattleDetail Service
 * 전투 상세 정보 조회
 */
export class GetBattleDetailService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const battleID = data.battleID || data.battle_id;
    
    try {
      if (!battleID) {
        return {
          success: false,
          result: false,
          reason: 'battleID가 필요합니다'
        };
      }
      
      // 전투 기록 조회 (GeneralRecord에서 battle 로그 타입으로)
      const battleRecord = await (GeneralRecord as any).findOne({
        session_id: sessionId,
        $or: [
          { 'data.id': battleID },
          { 'data.battle_id': battleID },
          { _id: battleID }
        ],
        'data.log_type': 'battle'
      }).lean();
      
      if (battleRecord) {
        const recordData = battleRecord.data || {};
        return {
          success: true,
          result: true,
          battle: {
            battleID: battleID,
            id: recordData.id || battleID,
            status: recordData.status || 'COMPLETED',
            attackerNationId: recordData.attacker_nation_id || 0,
            defenderNationId: recordData.defender_nation_id || 0,
            targetCityId: recordData.target_city_id || 0,
            currentTurn: recordData.current_turn || 0,
            maxTurn: recordData.max_turn || 30,
            winner: recordData.winner || null,
            text: recordData.text || '',
            detail: recordData.detail || {},
            createdAt: recordData.created_at || battleRecord.createdAt
          }
        };
      }
      
      // WorldHistory에서도 찾기
      const worldBattle = await (WorldHistory as any).findOne({
        session_id: sessionId,
        $or: [
          { 'data.id': battleID },
          { 'data.battle_id': battleID },
          { _id: battleID }
        ],
        $or: [
          { 'data.type': 'battle' },
          { 'data.text': { $regex: /전투|싸움|공격|방어/i } }
        ]
      }).lean();
      
      if (worldBattle) {
        const historyData = worldBattle.data || {};
        return {
          success: true,
          result: true,
          battle: {
            battleID: battleID,
            id: historyData.id || battleID,
            status: 'COMPLETED',
            attackerNationId: historyData.attacker_nation_id || 0,
            defenderNationId: historyData.defender_nation_id || 0,
            targetCityId: historyData.target_city_id || 0,
            text: historyData.text || '',
            createdAt: historyData.created_at || worldBattle.createdAt
          }
        };
      }
      
      // 기본값 반환 (전투가 아직 진행 중이거나 기록이 없는 경우)
      return {
        success: true,
        result: true,
        battle: {
          battleID: battleID,
          status: 'IN_PROGRESS',
          attackerNationId: 0,
          defenderNationId: 0,
          targetCityId: 0,
          currentTurn: 0
        }
      };
    } catch (error: any) {
      return {
        success: false,
        result: false,
        reason: error.message || '전투 상세 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}

