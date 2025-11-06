import { GeneralRecord } from '../../models/general_record.model';
import { WorldHistory } from '../../models/world_history.model';
import { Battle, BattleStatus } from '../../models/battle.model';

/**
 * GetBattleCenter Service
 * 진행 중인 전투 목록 조회
 */
export class GetBattleCenterService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // 진행 중인 실제 Battle 조회 (최우선)
      const activeBattles = await (Battle as any).find({
        session_id: sessionId,
        status: { $in: [BattleStatus.PREPARING, BattleStatus.DEPLOYING, BattleStatus.IN_PROGRESS] }
      })
        .sort({ startedAt: -1 })
        .limit(20)
        .lean();

      // 전투 기록 조회 (최근 30개)
      const battleRecords = await (GeneralRecord as any).find({
        session_id: sessionId,
        'data.log_type': 'battle'
      })
        .sort({ 'data.id': -1 })
        .limit(30)
        .lean();
      
      // 세계 역사에서 전투 기록 조회
      const worldBattles = await (WorldHistory as any).find({
        session_id: sessionId,
        $or: [
          { 'data.text': { $regex: /전투|싸움|공격|방어/i } },
          { 'data.type': 'battle' }
        ]
      })
        .sort({ 'data.id': -1 })
        .limit(30)
        .lean();
      
      // 진행 중인 Battle을 우선 표시
      const activeBattleList = activeBattles.map((battle: any) => ({
        battleId: battle.battleId,
        id: battle.battleId,
        type: 'active',
        status: battle.status,
        currentPhase: battle.currentPhase,
        currentTurn: battle.currentTurn,
        attackerNationId: battle.attackerNationId,
        defenderNationId: battle.defenderNationId,
        targetCityId: battle.targetCityId,
        text: `전투 진행 중 - ${battle.currentPhase === 'planning' ? '계획 단계' : '결전 단계'} (턴 ${battle.currentTurn}/${battle.maxTurns})`,
        date: battle.startedAt || battle.createdAt,
        generalId: 0,
        nationId: battle.attackerNationId
      }));

      const battles = [
        ...activeBattleList,
        ...battleRecords.map((record: any) => ({
          id: record.data?.id || record._id,
          type: 'general',
          text: record.data?.text || '',
          date: record.data?.created_at || record.createdAt,
          generalId: record.data?.general_id || 0,
          nationId: record.data?.nation_id || 0,
          status: 'completed'
        })),
        ...worldBattles.map((history: any) => ({
          id: history.data?.id || history._id,
          type: 'world',
          text: history.data?.text || '',
          date: history.data?.created_at || history.createdAt,
          nationId: history.data?.nation_id || 0,
          status: 'completed'
        }))
      ].sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date || 0).getTime();
        const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date || 0).getTime();
        return dateB - dateA;
      }).slice(0, 50);
      
      return {
        success: true,
        result: true,
        battles
      };
    } catch (error: any) {
      return {
        success: false,
        result: false,
        battles: [],
        reason: error.message || '전투 목록 조회 중 오류가 발생했습니다'
      };
    }
  }
}


