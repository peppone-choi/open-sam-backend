/**
 * Relationship.service.ts - 혈연/인연 시스템 서비스
 *
 * 장수 간 가족 관계, 사제 관계, 우호/적대 관계를 담당합니다.
 */

import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';

/**
 * 관계 타입
 */
export enum RelationType {
  // 가족 관계
  PARENT = 'parent',           // 부모
  CHILD = 'child',             // 자식
  SIBLING = 'sibling',         // 형제자매
  SPOUSE = 'spouse',           // 배우자
  COUSIN = 'cousin',           // 사촌
  
  // 사제 관계
  MASTER = 'master',           // 스승
  DISCIPLE = 'disciple',       // 제자
  
  // 우호/적대 관계
  FRIEND = 'friend',           // 친구/의형제
  RIVAL = 'rival',             // 라이벌
  ENEMY = 'enemy',             // 원수
  RESPECT = 'respect',         // 존경
  CRUSH = 'crush',             // 연모
}

/**
 * 관계 정보 인터페이스
 */
export interface RelationshipInfo {
  id: string;
  sessionId: string;
  generalId1: number;          // 주체 장수
  generalId2: number;          // 대상 장수
  type: RelationType;
  level: number;               // 친밀도 (1-100)
  mutual: boolean;             // 상호 관계 여부
  createdAt: Date;
  updatedAt: Date;
  description?: string;
}

/**
 * 관계 효과
 */
export interface RelationshipEffect {
  leadership?: number;
  strength?: number;
  intel?: number;
  politics?: number;
  morale?: number;             // 사기 보너스
  loyalty?: number;            // 충성도 보너스
}

/**
 * 관계별 효과 설정
 */
const RELATIONSHIP_EFFECTS: Partial<Record<RelationType, RelationshipEffect>> = {
  [RelationType.PARENT]: { loyalty: 10 },
  [RelationType.CHILD]: { loyalty: 5 },
  [RelationType.SIBLING]: { morale: 5, loyalty: 5 },
  [RelationType.SPOUSE]: { morale: 10, loyalty: 10 },
  [RelationType.MASTER]: { intel: 3, politics: 2 },
  [RelationType.DISCIPLE]: { loyalty: 5 },
  [RelationType.FRIEND]: { morale: 5, loyalty: 3 },
  [RelationType.RIVAL]: { leadership: 5, strength: 5 },
  [RelationType.ENEMY]: { strength: 3 },
  [RelationType.RESPECT]: { morale: 3, loyalty: 5 },
};

/**
 * 혈연/인연 서비스 클래스
 */
export class RelationshipService {
  /**
   * 관계 설정
   */
  static async setRelationship(
    sessionId: string,
    generalId1: number,
    generalId2: number,
    type: RelationType,
    mutual: boolean = true,
    description?: string
  ): Promise<{ success: boolean; error?: string; relationId?: string }> {
    try {
      if (generalId1 === generalId2) {
        return { success: false, error: '자기 자신과 관계를 설정할 수 없습니다.' };
      }

      // 장수 존재 확인
      const [general1, general2] = await Promise.all([
        generalRepository.findBySessionAndNo(sessionId, generalId1),
        generalRepository.findBySessionAndNo(sessionId, generalId2),
      ]);

      if (!general1 || !general2) {
        return { success: false, error: '장수를 찾을 수 없습니다.' };
      }

      // 기존 관계 확인 및 업데이트
      const existingRelation = await this.findRelationship(sessionId, generalId1, generalId2, type);
      
      const relationId = existingRelation?.id || `rel_${Date.now()}_${generalId1}_${generalId2}`;
      const now = new Date();

      const relationshipInfo: RelationshipInfo = {
        id: relationId,
        sessionId,
        generalId1,
        generalId2,
        type,
        level: existingRelation?.level || 50,
        mutual,
        createdAt: existingRelation?.createdAt || now,
        updatedAt: now,
        description,
      };

      // 관계 저장
      await this.saveRelationship(sessionId, generalId1, relationshipInfo);
      
      // 상호 관계면 반대편도 저장
      if (mutual) {
        const reverseType = this.getReverseRelationType(type);
        const reverseInfo: RelationshipInfo = {
          ...relationshipInfo,
          id: `rel_${Date.now()}_${generalId2}_${generalId1}`,
          generalId1: generalId2,
          generalId2: generalId1,
          type: reverseType,
        };
        await this.saveRelationship(sessionId, generalId2, reverseInfo);
      }

      logger.info('[Relationship] Set', {
        sessionId,
        generalId1,
        generalId2,
        type,
        mutual,
      });

      return { success: true, relationId };
    } catch (error: any) {
      logger.error('[Relationship] Set failed', {
        sessionId,
        generalId1,
        generalId2,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 관계 삭제
   */
  static async removeRelationship(
    sessionId: string,
    generalId1: number,
    generalId2: number,
    type: RelationType
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId1);
      if (!general) {
        return { success: false, error: '장수를 찾을 수 없습니다.' };
      }

      const generalData = general.data || {};
      const relationships: RelationshipInfo[] = generalData.relationships || [];
      
      // 해당 관계 제거
      generalData.relationships = relationships.filter(
        r => !(r.generalId2 === generalId2 && r.type === type)
      );

      await generalRepository.updateBySessionAndNo(sessionId, generalId1, {
        data: generalData,
      });

      // 상호 관계도 제거
      const general2 = await generalRepository.findBySessionAndNo(sessionId, generalId2);
      if (general2) {
        const generalData2 = general2.data || {};
        const relationships2: RelationshipInfo[] = generalData2.relationships || [];
        const reverseType = this.getReverseRelationType(type);
        
        generalData2.relationships = relationships2.filter(
          r => !(r.generalId2 === generalId1 && r.type === reverseType)
        );

        await generalRepository.updateBySessionAndNo(sessionId, generalId2, {
          data: generalData2,
        });
      }

      logger.info('[Relationship] Removed', {
        sessionId,
        generalId1,
        generalId2,
        type,
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[Relationship] Remove failed', {
        sessionId,
        generalId1,
        generalId2,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 친밀도 증가
   */
  static async increaseAffinity(
    sessionId: string,
    generalId1: number,
    generalId2: number,
    type: RelationType,
    amount: number = 5
  ): Promise<{ success: boolean; newLevel?: number }> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId1);
      if (!general) {
        return { success: false };
      }

      const generalData = general.data || {};
      const relationships: RelationshipInfo[] = generalData.relationships || [];
      
      const relation = relationships.find(
        r => r.generalId2 === generalId2 && r.type === type
      );

      if (!relation) {
        return { success: false };
      }

      relation.level = Math.min(100, relation.level + amount);
      relation.updatedAt = new Date();

      await generalRepository.updateBySessionAndNo(sessionId, generalId1, {
        data: generalData,
      });

      return { success: true, newLevel: relation.level };
    } catch (error: any) {
      logger.error('[Relationship] Increase affinity failed', {
        sessionId,
        generalId1,
        generalId2,
        error: error.message,
      });
      return { success: false };
    }
  }

  /**
   * 장수의 관계 목록 조회
   */
  static async getRelationships(
    sessionId: string,
    generalId: number
  ): Promise<RelationshipInfo[]> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return [];

      const generalData = general.data || {};
      return generalData.relationships || [];
    } catch (error: any) {
      logger.error('[Relationship] Get failed', {
        sessionId,
        generalId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 특정 타입의 관계 조회
   */
  static async getRelationshipsByType(
    sessionId: string,
    generalId: number,
    type: RelationType
  ): Promise<RelationshipInfo[]> {
    const relationships = await this.getRelationships(sessionId, generalId);
    return relationships.filter(r => r.type === type);
  }

  /**
   * 관계 효과 계산
   */
  static calculateRelationshipEffects(
    relationships: RelationshipInfo[]
  ): RelationshipEffect {
    const totalEffect: RelationshipEffect = {};

    for (const relation of relationships) {
      const effect = RELATIONSHIP_EFFECTS[relation.type];
      if (!effect) continue;

      // 친밀도에 따른 효과 가중치 (50 기준, 100이면 2배)
      const multiplier = relation.level / 50;

      for (const [key, value] of Object.entries(effect)) {
        if (typeof value === 'number') {
          const effectKey = key as keyof RelationshipEffect;
          totalEffect[effectKey] = (totalEffect[effectKey] || 0) + Math.floor(value * multiplier);
        }
      }
    }

    return totalEffect;
  }

  /**
   * 같은 도시에 있는 관계자 효과 계산
   */
  static async calculateCityRelationshipBonus(
    sessionId: string,
    generalId: number,
    cityId: number
  ): Promise<RelationshipEffect> {
    try {
      const relationships = await this.getRelationships(sessionId, generalId);
      
      // 같은 도시에 있는 관계자만 필터링
      const activeRelationships: RelationshipInfo[] = [];
      
      for (const rel of relationships) {
        const relatedGeneral = await generalRepository.findBySessionAndNo(sessionId, rel.generalId2);
        if (!relatedGeneral) continue;
        
        const relatedCity = relatedGeneral.data?.city || relatedGeneral.city;
        if (relatedCity === cityId) {
          activeRelationships.push(rel);
        }
      }

      return this.calculateRelationshipEffects(activeRelationships);
    } catch (error: any) {
      logger.error('[Relationship] Calculate city bonus failed', {
        sessionId,
        generalId,
        cityId,
        error: error.message,
      });
      return {};
    }
  }

  /**
   * 역관계 타입 반환
   */
  private static getReverseRelationType(type: RelationType): RelationType {
    switch (type) {
      case RelationType.PARENT:
        return RelationType.CHILD;
      case RelationType.CHILD:
        return RelationType.PARENT;
      case RelationType.MASTER:
        return RelationType.DISCIPLE;
      case RelationType.DISCIPLE:
        return RelationType.MASTER;
      default:
        return type; // 대칭 관계
    }
  }

  /**
   * 관계 조회
   */
  private static async findRelationship(
    sessionId: string,
    generalId1: number,
    generalId2: number,
    type: RelationType
  ): Promise<RelationshipInfo | null> {
    const relationships = await this.getRelationships(sessionId, generalId1);
    return relationships.find(r => r.generalId2 === generalId2 && r.type === type) || null;
  }

  /**
   * 관계 저장
   */
  private static async saveRelationship(
    sessionId: string,
    generalId: number,
    relationship: RelationshipInfo
  ): Promise<void> {
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
    if (!general) return;

    const generalData = general.data || {};
    const relationships: RelationshipInfo[] = generalData.relationships || [];

    // 기존 관계 업데이트 또는 새로 추가
    const existingIndex = relationships.findIndex(
      r => r.generalId2 === relationship.generalId2 && r.type === relationship.type
    );

    if (existingIndex >= 0) {
      relationships[existingIndex] = relationship;
    } else {
      relationships.push(relationship);
    }

    generalData.relationships = relationships;

    await generalRepository.updateBySessionAndNo(sessionId, generalId, {
      data: generalData,
    });
  }

  /**
   * 가족 관계 일괄 설정 (시나리오용)
   */
  static async setupFamilyRelations(
    sessionId: string,
    familyTree: { parent: number; children: number[] }[]
  ): Promise<void> {
    for (const family of familyTree) {
      for (const childId of family.children) {
        await this.setRelationship(sessionId, family.parent, childId, RelationType.PARENT);
        
        // 형제자매 관계도 설정
        for (const siblingId of family.children) {
          if (siblingId !== childId) {
            await this.setRelationship(sessionId, childId, siblingId, RelationType.SIBLING);
          }
        }
      }
    }

    logger.info('[Relationship] Family relations setup complete', {
      sessionId,
      familyCount: familyTree.length,
    });
  }
}

export default RelationshipService;










