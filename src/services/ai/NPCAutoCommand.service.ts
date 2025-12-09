import { generalRepository } from '../../repositories/general.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { GameConst } from '../../constants/GameConst';
import { SimpleAI } from '../../core/SimpleAI';

// 접속 상태 확인을 위한 기준 시간 (10분)
const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * 플레이어가 접속 중인지 확인 (lastActiveAt 기준)
 * @param general 장수 데이터
 * @returns 접속 중이면 true
 */
function isPlayerActive(general: any): boolean {
  const generalData = general.data || general;
  const lastActiveAt = generalData.lastActiveAt;
  
  if (!lastActiveAt) {
    return false; // 활동 기록 없음 = 미접속
  }
  
  const lastActiveTime = new Date(lastActiveAt).getTime();
  const now = Date.now();
  
  return (now - lastActiveTime) < ACTIVE_THRESHOLD_MS;
}

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
    const generalData = general.data || general;
    const owner = generalData.owner || general.owner;
    const generalName = generalData.name || general.name || `General ${general.no}`;
    
    // 플레이어(npc=0)는 스킵
    if (npcType < 1) {
      // console.log(`[NPC AI] 장수 ${general.no} (${generalName}) - 스킵: 플레이어 (npc=${npcType})`);
      return { success: false };
    }
    
    // 유저가 소유한 NPC는 스킵 (owner가 있으면 유저가 플레이 중)
    // NOTE: owner가 숫자 0이거나 '0' 문자열이면 무시 (실제 소유자가 없음)
    if (owner && owner !== 0 && owner !== '0') {
      // console.log(`[NPC AI] 장수 ${general.no} (${generalName}) - 스킵: 유저 소유 (owner=${owner})`);
      return { success: false };
    }
    
    // 반자동 NPC(npc=1)는 플레이어 접속 중이면 스킵
    if (npcType === 1 && isPlayerActive(general)) {
      // console.log(`[NPC AI] 장수 ${general.no} (${generalName}) - 스킵: 반자동 NPC 접속 중`);
      return { success: false };
    }

    // city=0 (방랑/미등장) 장수는 스킵
    const cityId = generalData.city;
    if (!cityId || cityId === 0) {
      // console.log(`[NPC AI] 장수 ${general.no} (${generalName}) - 스킵: 도시 없음 (city=${cityId})`);
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
      console.log(`[NPC AI] 장수 ${general.no} (${general.data?.name || general.name}) - 빈 턴 없음 (턴 수: ${existingTurns.length})`);
      return { success: false };
    }
    
    console.log(`[NPC AI] 장수 ${general.no} (${general.data?.name || general.name}) - 턴 ${emptyTurnIdx}에 명령 등록 시도`);

    try {
      // 장수가 속한 도시와 국가 정보 가져오기
      const cityId = generalData.city;
      const nationId = generalData.nation;

      let city = null;
      let nation = null;

      if (cityId) {
        // Use findByCityNum instead of findOneByFilter for proper cache lookup
        city = await cityRepository.findByCityNum(sessionId, cityId);
        if (!city) {
          console.log(`[NPC AI] WARNING: City ${cityId} not found in cache for general ${general.no}`);
        } else {
          console.log(`[NPC AI] City ${cityId} loaded: nation=${city.nation || city.data?.nation}`);
        }
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
      
      // NPC 유형에 따른 AI 옵션 설정
      const npcType = generalData.npc || 0;
      const officerLevel = generalData.officer_level || 0;
      
      // 모든 NPC에게 기본 AI 옵션 제공 (징병/내정/훈련/전투 허용)
      const aiOptions = {
        chief: officerLevel >= 5,  // 수뇌 권한 (officer_level >= 5)
        develop: true,             // 내정 허용
        recruit: true,             // 징병 허용
        train: true,               // 훈련 허용
        battle: true,              // 전투 허용
        warp: false,               // 일반 장수는 워프 불가
      };
      
      ai.initializePolicies(aiOptions, null, null);
      
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
      
      console.log(`[NPC AI] ✅ 장수 ${general.no} (${general.data?.name || general.name}) - 명령 등록: ${decision.command}, args:`, JSON.stringify(decision.args));
      
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
   * 명령 등록 (upsert 사용으로 중복 방지)
   */
  private static async registerCommand(
    sessionId: string,
    general: any,
    turnIdx: number,
    action: string,
    args: any
  ): Promise<void> {
    const generalId = general.no || general.data?.no;
    
    try {
      // upsert로 중복 키 에러 방지
      await generalTurnRepository.upsert(
        sessionId,
        generalId,
        turnIdx,
        {
          action: action,
          arg: args,
          brief: this.getBrief(action, args)
        }
      );
    } catch (error: any) {
      // 중복 키 에러는 무시 (이미 등록된 명령)
      if (error?.code === 11000 || error?.message?.includes('duplicate key')) {
        console.log(`[NPC AI] 장수 ${generalId} 턴 ${turnIdx} - 이미 명령 존재, 스킵`);
        return;
      }
      throw error;
    }
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
   * npc >= 1인 장수 대상 (반자동 NPC 포함)
   * 반자동 NPC(npc=1)는 플레이어 접속 중이면 스킵
   */
  static async assignCommandsToAllNPCs(
    sessionId: string,
    gameEnv: any
  ): Promise<{ success: boolean; count: number; errors: number }> {
    // npc >= 1인 장수 모두 가져오기 (반자동 + 완전자동)
    const npcs = await generalRepository.findByFilter({
      session_id: sessionId,
      $or: [
        { npc: { $gte: 1 } },
        { 'data.npc': { $gte: 1 } }
      ]
    });

    console.log(`[NPC AI] ${sessionId} - NPC 장수 ${npcs.length}명 발견 (반자동 포함)`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const npc of npcs) {
      try {
        const result = await this.assignCommandToNPC(sessionId, npc, gameEnv);
        if (result.success) {
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`NPC ${npc.no} 명령 할당 실패:`, error.message);
        errorCount++;
      }
    }

    console.log(`[NPC AI] ${sessionId} - 완료: 성공 ${successCount}, 스킵 ${skippedCount}, 실패 ${errorCount}`);

    return {
      success: true,
      count: successCount,
      errors: errorCount
    };
  }

  /**
   * 국가턴 자동 등록 (NPC 수뇌 - officer_level >= 5)
   * 수뇌는 각자 자기만의 국가턴 테이블을 가지고 있음
   */
  static async assignNationTurn(
    sessionId: string,
    nation: any,
    general: any, // 수뇌 장수
    gameEnv: any
  ): Promise<{ success: boolean; command?: string; args?: any }> {
    const nationId = nation.nation || nation.data?.nation;
    const generalId = general.no || general.data?.no;
    const generalData = general.data || general;
    const officerLevel = generalData.officer_level || 0;
    
    // 수뇌가 아니면 스킵 (officer_level >= 5)
    if (officerLevel < 5) {
      return { success: false };
    }
    
    // 이 수뇌의 국가턴 확인 (general_id 기준으로 조회)
    const existingTurns = await nationTurnRepository.findByFilter({
      session_id: sessionId,
      'data.nation_id': nationId,
      'data.general_id': generalId // 수뇌별로 별도 턴 테이블
    });
    
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
      console.log(`[NPC AI] 수뇌 ${generalId} (국가 ${nationId}) - 빈 턴 없음 (턴 수: ${existingTurns.length})`);
      return { success: false };
    }
    
    console.log(`[NPC AI] 수뇌 ${generalId} (${generalData.name || ''}, 국가 ${nationId}) - 턴 ${emptyTurnIdx}에 명령 등록 시도`);

    try {
      // 수도 정보 가져오기
      const nationData = nation.data || nation;
      const capitalCityId = nationData.capital;
      
      let city = null;
      if (capitalCityId) {
        // Use findByCityNum instead of findOneByFilter for proper cache lookup
        city = await cityRepository.findByCityNum(sessionId, capitalCityId);
      }

      // SimpleAI를 사용하여 국가 명령 결정
      const ai = new SimpleAI(general, city, nation, gameEnv);
      
      // 국가 정책 초기화 (수뇌: officer_level >= 5)
      const npcType = generalData.npc || 0;
      
      // NPC 유형에 따른 AI 옵션 설정
      // npc >= 2: 완전 자동 NPC (AutorunGeneralPolicy에서 기본값 사용)
      // npc < 2: 유저장/반자동 (aiOptions에 따라 활성화)
      const aiOptions = {
        chief: true,        // 수뇌 권한
        develop: true,      // 내정 허용
        recruit: true,      // 징병 허용
        train: true,        // 훈련 허용
        battle: true,       // 전투 허용
        warp: true,         // 워프 허용
      };
      
      ai.initializePolicies(
        aiOptions,
        null, // nationPolicyOverride
        null  // serverPolicyOverride
      );
      
      // 국가 명령만 결정 (장수 명령 제외)
      const decision = await ai.decideNationCommandOnly();
      
      if (!decision) {
        console.log(`[NPC AI] 수뇌 ${generalId} (국가 ${nationId}) - 국가 명령 결정 실패`);
        return { success: false };
      }
      
      console.log(`[NPC AI] 수뇌 ${generalId} (국가 ${nationId}) - 국가 명령 선택: ${decision.command}`);

      // 결정된 명령 등록 (general_id 포함)
      // id는 고유해야 함: nation_general_turn 형식
      const turnId = `${nationId}_${generalId}_${emptyTurnIdx}`;
      await nationTurnRepository.create({
        session_id: sessionId,
        data: {
          id: turnId,
          nation_id: nationId,
          general_id: generalId, // 수뇌별 턴 테이블 구분
          turn_idx: emptyTurnIdx,
          action: decision.command,
          arg: decision.args,
          brief: this.getBrief(decision.command, decision.args)
        }
      });
      
      console.log(`[NPC AI] ✅ 수뇌 ${generalId} (국가 ${nationId}) - 명령 등록: ${decision.command}`);
      
      return {
        success: true,
        command: decision.command,
        args: decision.args
      };
    } catch (error: any) {
      console.error(`국가 AI 명령 생성 실패 (수뇌 ${generalId}, 국가 ${nationId}):`, error.message);
      return { success: false };
    }
  }

  /**
   * 모든 NPC 수뇌에 국가턴 자동 할당
   */
  static async assignNationTurnsToAllNPCs(
    sessionId: string,
    gameEnv: any
  ): Promise<{ success: boolean; count: number; errors: number }> {
    // NPC 수뇌 찾기 (officer_level >= 5, npc >= 1)
    // npc=0: 플레이어, npc>=1: 자동 명령 대상 (반자동 포함)
    const npcChiefs = await generalRepository.findByFilter({
      session_id: sessionId,
      $or: [
        { 'data.officer_level': { $gte: 5 }, 'data.npc': { $gte: 1 } },
        { officer_level: { $gte: 5 }, npc: { $gte: 1 } }
      ]
    });

    console.log(`[NPC AI] ${sessionId} - NPC 수뇌 ${npcChiefs.length}명 발견`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const chief of npcChiefs) {
      try {
        const chiefData = chief.data || chief;
        const nationId = chiefData.nation;
        
        if (!nationId || nationId === 0) {
          skippedCount++;
          continue;
        }
        
        // 국가 정보 가져오기
        const nation = await nationRepository.findOneByFilter({
          session_id: sessionId,
          $or: [
            { nation: nationId },
            { 'data.nation': nationId }
          ]
        });
        
        if (!nation) {
          skippedCount++;
          continue;
        }
        
        const result = await this.assignNationTurn(sessionId, nation, chief, gameEnv);
        if (result.success) {
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`수뇌 ${chief.no} (국가 ${chief.data?.nation || chief.nation}) 명령 할당 실패:`, error.message);
        errorCount++;
      }
    }

    console.log(`[NPC AI] ${sessionId} - 국가턴 완료: 성공 ${successCount}, 스킵 ${skippedCount}, 실패 ${errorCount}`);

    return {
      success: true,
      count: successCount,
      errors: errorCount
    };
  }
}
