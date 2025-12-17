// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';
import { DEFAULT_GENERAL_PRIORITY } from '../../core/AutorunGeneralPolicy';
import { DEFAULT_NATION_PRIORITY, DEFAULT_NATION_POLICY } from '../../core/AutorunNationPolicy';

/**
 * GetNPCControl Service
 * NPC 제어 정보 조회
 */
export class GetNPCControlService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    let generalId = user?.generalId || data.general_id;
    
    try {
      let general: any = null;
      
      // generalId가 없으면 userId로 장수 검색
      if (!generalId) {
        general = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId),
          { npc: { $lt: 2 } }
        );
        
        if (!general) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다'
          };
        }
        generalId = general.data?.no || general.no;
      } else {
        // generalId가 있으면 해당 장수 검색
        general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      }
      
      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }
      
      const generalData = general.data || {};
      const nationId = generalData.nation || 0;
      
      if (nationId === 0) {
        return {
          result: false,
          reason: '국가에 소속되어 있지 않습니다'
        };
      }
      
      // 권한 확인 (군주 또는 수뇌부 이상)
      const officerLevel = generalData.officer_level || 0;
      const isRuler = generalData.chief === true || generalData.officer_level >= 12;
      
      if (officerLevel < 5 && !isRuler) {
        return {
          result: false,
          reason: '권한이 부족합니다. 수뇌부가 아니거나 사관년도가 부족합니다'
        };
      }
      
      // 국가별 정책 조회 (kvStorage)
      const storageKey = `nation_env:${nationId}`;
      const storage = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        key: storageKey
      });
      
      let nationPolicyData: any = { values: { ...DEFAULT_NATION_POLICY }, priority: [...DEFAULT_NATION_PRIORITY] };
      let generalPolicyData: any = { priority: [...DEFAULT_GENERAL_PRIORITY] };
      
      if (storage) {
        try {
          const storageData = typeof storage.value === 'string' 
            ? JSON.parse(storage.value) 
            : storage.value || {};
          
          if (storageData.npc_nation_policy) {
            nationPolicyData = {
              values: { ...DEFAULT_NATION_POLICY, ...storageData.npc_nation_policy.values },
              priority: storageData.npc_nation_policy.priority || [...DEFAULT_NATION_PRIORITY],
              valueSetter: storageData.npc_nation_policy.valueSetter,
              valueSetTime: storageData.npc_nation_policy.valueSetTime,
              prioritySetter: storageData.npc_nation_policy.prioritySetter,
              prioritySetTime: storageData.npc_nation_policy.prioritySetTime,
            };
          }
          
          if (storageData.npc_general_policy) {
            generalPolicyData = {
              priority: storageData.npc_general_policy.priority || [...DEFAULT_GENERAL_PRIORITY],
              prioritySetter: storageData.npc_general_policy.prioritySetter,
              prioritySetTime: storageData.npc_general_policy.prioritySetTime,
            };
          }
        } catch {
          // JSON 파싱 실패 시 기본값 사용
        }
      }
      
      // NPC 정책 정보 반환
      const control = {
        nationPolicy: nationPolicyData,
        generalPolicy: generalPolicyData,
        // 기본값 참조용
        defaultNationPolicy: DEFAULT_NATION_POLICY,
        defaultNationPriority: DEFAULT_NATION_PRIORITY,
        defaultGeneralPriority: DEFAULT_GENERAL_PRIORITY,
      };
      
      return {
        result: true,
        control
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || 'NPC 제어 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}


