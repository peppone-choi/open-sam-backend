// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';
import { troopRepository } from '../../repositories/troop.repository';
import { DEFAULT_GENERAL_PRIORITY, GeneralActionType } from '../../core/AutorunGeneralPolicy';
import { DEFAULT_NATION_PRIORITY, NationActionType, DEFAULT_NATION_POLICY } from '../../core/AutorunNationPolicy';

/**
 * SetNPCControl Service
 * NPC 제어 설정
 */
export class SetNPCControlService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;
    const { type, control } = data;
    
    try {
      if (!generalId) {
        const general = await generalRepository.findBySessionAndOwner(
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
      }
      
      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalId
      });
      
      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }
      
      const generalData = general.data || {};
      const nationId = generalData.nation || 0;
      const generalName = generalData.name || '알수없음';
      
      if (nationId === 0) {
        return {
          result: false,
          reason: '국가에 소속되어 있지 않습니다'
        };
      }
      
      // 권한 확인 (수뇌부 이상)
      const officerLevel = generalData.officer_level || 0;
      if (officerLevel < 5) {
        return {
          result: false,
          reason: '권한이 부족합니다. 수뇌부가 아니거나 사관년도가 부족합니다'
        };
      }

      // 타입 검증
      const availableTypes = ['generalPriority', 'nationPriority', 'nationPolicy'];
      if (!availableTypes.includes(type)) {
        return {
          result: false,
          reason: '올바른 타입이 아닙니다.'
        };
      }

      // 데이터 검증
      if (!control || !Array.isArray(control) && typeof control !== 'object') {
        return {
          result: false,
          reason: '올바른 입력이 아닙니다.'
        };
      }

      // 타입별 처리
      let error: string | null = null;
      if (type === 'nationPolicy') {
        error = await this.applyNationPolicy(sessionId, nationId, control, generalName);
      } else if (type === 'generalPriority') {
        error = await this.applyGeneralPriority(sessionId, nationId, control, generalName);
      } else if (type === 'nationPriority') {
        error = await this.applyNationPriority(sessionId, nationId, control, generalName);
      }

      if (error) {
        return {
          result: false,
          reason: error
        };
      }
      
      return {
        result: true,
        message: 'NPC 제어 설정이 완료되었습니다'
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || 'NPC 제어 설정 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 국가 정책 적용
   */
  private static async applyNationPolicy(
    sessionId: string, 
    nationId: number, 
    policy: Record<string, any>, 
    generalName: string
  ): Promise<string | null> {
    try {
      const storageKey = `nation_env:${nationId}`;
      let storage = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        key: storageKey
      });

      let storageData: any = {};
      if (storage) {
        try {
          storageData = typeof storage.value === 'string' 
            ? JSON.parse(storage.value) 
            : storage.value || {};
        } catch {
          storageData = {};
        }
      }

      let nationPolicyRoot = storageData.npc_nation_policy || {
        priority: DEFAULT_NATION_PRIORITY,
        values: { ...DEFAULT_NATION_POLICY }
      };

      const nationPolicy = nationPolicyRoot.values || { ...DEFAULT_NATION_POLICY };
      const troopCache: Record<number, string> = {};

      // 부대 목록 캐싱
      const troops = await troopRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });
      
      for (const troop of troops) {
        const troopLeader = troop.data?.troop_leader || troop.data?.no;
        if (troopLeader) {
          troopCache[troopLeader] = 'Neutral';
        }
      }

      // 정책 검증 및 적용
      for (const [key, val] of Object.entries(policy)) {
        // 특수 처리: CombatForce (전투부대)
        if (key === 'CombatForce') {
          if (!val || typeof val !== 'object') {
            return `${key}는 올바른 정책값이 아닙니다.`;
          }
          for (const [troopIdStr, troopTarget] of Object.entries(val)) {
            const troopId = Number(troopIdStr);
            if (!troopCache[troopId]) {
              return `${troopId}는 국가의 부대가 아닙니다.`;
            }
            if (troopCache[troopId] !== 'Neutral') {
              return `부대(${troopId})는 하나의 역할만 지정할 수 있습니다.`;
            }
            troopCache[troopId] = key;
          }
          nationPolicy[key] = val;
          continue;
        }

        // 특수 처리: SupportForce, DevelopForce (지원/개발부대)
        if (key === 'SupportForce' || key === 'DevelopForce') {
          if (!Array.isArray(val)) {
            return `${key}는 올바른 정책값이 아닙니다.`;
          }
          for (const troopId of val) {
            if (!troopCache[troopId]) {
              return `${troopId}는 국가의 부대가 아닙니다.`;
            }
            if (troopCache[troopId] !== 'Neutral') {
              return `부대(${troopId})는 하나의 역할만 지정할 수 있습니다.`;
            }
            troopCache[troopId] = key;
          }
          nationPolicy[key] = val;
          continue;
        }

        // 기본 정책값 검증
        const defaultValue = DEFAULT_NATION_POLICY[key];
        if (defaultValue === undefined) {
          return `${key}는 올바른 정책값이 아닙니다.`;
        }

        // 타입 검증
        if (typeof defaultValue !== typeof val) {
          return `${key}는 올바른 값이 아닙니다.`;
        }

        if (typeof val === 'number' && val < 0) {
          nationPolicy[key] = 0;
        } else {
          nationPolicy[key] = val;
        }
      }

      // 저장
      nationPolicyRoot.values = nationPolicy;
      nationPolicyRoot.valueSetter = generalName;
      nationPolicyRoot.valueSetTime = new Date();
      storageData.npc_nation_policy = nationPolicyRoot;

      if (storage) {
        await kvStorageRepository.updateOneByFilter(
          { session_id: sessionId, key: storageKey },
          { value: JSON.stringify(storageData) }
        );
      } else {
        await kvStorageRepository.create({
          session_id: sessionId,
          key: storageKey,
          value: JSON.stringify(storageData)
        });
      }

      return null;
    } catch (error: any) {
      return error.message || '국가 정책 저장 중 오류가 발생했습니다.';
    }
  }

  /**
   * 국가 우선순위 적용
   */
  private static async applyNationPriority(
    sessionId: string,
    nationId: number,
    priority: string[],
    generalName: string
  ): Promise<string | null> {
    try {
      const storageKey = `nation_env:${nationId}`;
      let storage = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        key: storageKey
      });

      let storageData: any = {};
      if (storage) {
        try {
          storageData = typeof storage.value === 'string' 
            ? JSON.parse(storage.value) 
            : storage.value || {};
        } catch {
          storageData = {};
        }
      }

      let nationPolicyRoot = storageData.npc_nation_policy || {
        priority: DEFAULT_NATION_PRIORITY,
        values: { ...DEFAULT_NATION_POLICY }
      };

      // 우선순위 검증
      const validActions = Object.values(NationActionType);
      for (const item of priority) {
        if (!validActions.includes(item as NationActionType)) {
          return `${item}은 올바른 명령이 아닙니다.`;
        }
      }

      // 저장
      nationPolicyRoot.priority = priority;
      nationPolicyRoot.prioritySetter = generalName;
      nationPolicyRoot.prioritySetTime = new Date();
      storageData.npc_nation_policy = nationPolicyRoot;

      if (storage) {
        await kvStorageRepository.updateOneByFilter(
          { session_id: sessionId, key: storageKey },
          { value: JSON.stringify(storageData) }
        );
      } else {
        await kvStorageRepository.create({
          session_id: sessionId,
          key: storageKey,
          value: JSON.stringify(storageData)
        });
      }

      return null;
    } catch (error: any) {
      return error.message || '국가 우선순위 저장 중 오류가 발생했습니다.';
    }
  }

  /**
   * 장수 우선순위 적용
   */
  private static async applyGeneralPriority(
    sessionId: string,
    nationId: number,
    priority: string[],
    generalName: string
  ): Promise<string | null> {
    try {
      const storageKey = `nation_env:${nationId}`;
      let storage = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        key: storageKey
      });

      let storageData: any = {};
      if (storage) {
        try {
          storageData = typeof storage.value === 'string' 
            ? JSON.parse(storage.value) 
            : storage.value || {};
        } catch {
          storageData = {};
        }
      }

      let generalPolicyRoot = storageData.npc_general_policy || {
        priority: DEFAULT_GENERAL_PRIORITY
      };

      // 우선순위 검증
      const validActions = Object.values(GeneralActionType);
      const mustHaveActions: Record<string, number> = { 
        '출병': 1, 
        '일반내정': 1 
      };
      const orderMap: Record<string, number> = {};

      for (const item of priority) {
        if (!validActions.includes(item as GeneralActionType)) {
          return `${item}은 올바른 명령이 아닙니다.`;
        }
        if (mustHaveActions[item] !== undefined) {
          mustHaveActions[item] = 0;
        }
        orderMap[item] = Object.keys(orderMap).length;
      }

      // 필수 행동 체크
      const actionOrder: [string, string][] = [['출병', '일반내정']];
      for (const [preItem, postItem] of actionOrder) {
        if (orderMap[preItem] !== undefined && orderMap[postItem] !== undefined) {
          if (orderMap[preItem] > orderMap[postItem]) {
            return `${preItem} 명령은 ${postItem} 명령보다 먼저여야 합니다.`;
          }
        }
      }

      for (const [actionKey, unset] of Object.entries(mustHaveActions)) {
        if (unset) {
          return `${actionKey}은 항상 사용해야 합니다.`;
        }
      }

      // 저장
      generalPolicyRoot.priority = priority;
      generalPolicyRoot.prioritySetter = generalName;
      generalPolicyRoot.prioritySetTime = new Date();
      storageData.npc_general_policy = generalPolicyRoot;

      if (storage) {
        await kvStorageRepository.updateOneByFilter(
          { session_id: sessionId, key: storageKey },
          { value: JSON.stringify(storageData) }
        );
      } else {
        await kvStorageRepository.create({
          session_id: sessionId,
          key: storageKey,
          value: JSON.stringify(storageData)
        });
      }

      return null;
    } catch (error: any) {
      return error.message || '장수 우선순위 저장 중 오류가 발생했습니다.';
    }
  }
}


