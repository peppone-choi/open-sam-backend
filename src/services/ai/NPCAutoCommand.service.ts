import { generalRepository } from '../../repositories/general.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { GameConst } from '../../constants/GameConst';
import { SimpleAI } from '../../core/SimpleAI';

/**
 * NPC 자동 명령 등록 서비스
 */
export class NPCAutoCommandService {
  /**
   * NPC에게 자동으로 명령 등록
   */
  static async assignCommandToNPC(
    sessionId: string,
    general: any,
    gameEnv: any
  ): Promise<{ success: boolean; command?: string; args?: any }> {
    const npcType = general.npc || general.data?.npc || 0;
    
    // NPC가 아니면 스킵
    if (npcType < 2) {
      return { success: false };
    }

    // 이미 명령이 있는지 확인
    const existingTurns = await generalTurnRepository.findByGeneral(
      sessionId,
      general.no || general.data?.no
    );
    
    // 비어있는 턴 찾기
    const maxTurn = 30; // 기본 턴 수
    const occupiedTurns = new Set(
      existingTurns.map(t => t.data?.turn_idx).filter(idx => idx !== undefined && idx >= 0)
    );
    
    let emptyTurnIdx = -1;
    for (let i = 0; i < maxTurn; i++) {
      if (!occupiedTurns.has(i)) {
        emptyTurnIdx = i;
        break;
      }
    }
    
    // 빈 턴이 없으면 스킵
    if (emptyTurnIdx === -1) {
      return { success: false };
    }

    try {
      // 장수가 속한 도시와 국가 정보 가져오기
      const generalData = general.data || general;
      const cityId = generalData.city;
      const nationId = generalData.nation;

      let city = null;
      let nation = null;

      if (cityId) {
        city = await cityRepository.findOneByFilter({
          session_id: sessionId,
          $or: [
            { city: cityId },
            { 'data.city': cityId }
          ]
        });
      }

      if (nationId && nationId !== 0) {
        nation = await nationRepository.findOneByFilter({
          session_id: sessionId,
          $or: [
            { nation: nationId },
            { 'data.nation': nationId }
          ]
        });
      }

      // SimpleAI를 사용하여 명령 결정
      const ai = new SimpleAI(general, city, nation, gameEnv);
      const decision = await ai.decideNextCommand();
      
      if (!decision) {
        // AI가 결정하지 못하면 기본 명령 (휴식)
        await this.registerCommand(sessionId, general, emptyTurnIdx, '휴식', {});
        return { success: true, command: '휴식', args: {} };
      }

      // 결정된 명령 등록
      await this.registerCommand(
        sessionId,
        general,
        emptyTurnIdx,
        decision.command,
        decision.args
      );
      
      return {
        success: true,
        command: decision.command,
        args: decision.args
      };
    } catch (error: any) {
      console.error(`NPC AI 명령 생성 실패 (장수 ${general.no}):`, error.message);
      
      // 에러 발생 시 기본 명령
      await this.registerCommand(sessionId, general, emptyTurnIdx, '휴식', {});
      return { success: true, command: '휴식', args: {} };
    }
  }

  /**
   * 명령 등록
   */
  private static async registerCommand(
    sessionId: string,
    general: any,
    turnIdx: number,
    action: string,
    args: any
  ): Promise<void> {
    const generalId = general.no || general.data?.no;
    
    await generalTurnRepository.create({
      session_id: sessionId,
      data: {
        general_id: generalId,
        turn_idx: turnIdx,
        action: action,
        arg: args,
        brief: this.getBrief(action, args)
      }
    });
  }

  /**
   * 명령 간략 설명 생성
   */
  private static getBrief(action: string, args: any): string {
    
    if (action === '휴식') {
      return '휴식';
    }
    
    return action;
  }

  /**
   * 모든 NPC에게 자동 명령 할당
   */
  static async assignCommandsToAllNPCs(
    sessionId: string,
    gameEnv: any
  ): Promise<{ success: boolean; count: number; errors: number }> {
    const npcs = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.npc': { $gte: 2 }
    });

    let successCount = 0;
    let errorCount = 0;

    for (const npc of npcs) {
      try {
        const result = await this.assignCommandToNPC(sessionId, npc, gameEnv);
        if (result.success) {
          successCount++;
        }
      } catch (error: any) {
        console.error(`NPC ${npc.no} 명령 할당 실패:`, error.message);
        errorCount++;
      }
    }

    return {
      success: true,
      count: successCount,
      errors: errorCount
    };
  }
}
