/**
 * 장수 특기 레지스트리
 * PHP core/hwe/sammo/SpecialityHelper.php 기반
 * 
 * 모든 특기를 중앙에서 관리하고, 장수에게 특기를 배정하는 로직 제공
 */

import {
  SpecialityBase,
  SpecialityCategory,
  StatRequirement,
  SelectWeightType,
  BattleSpecialityBase,
  TacticsSpecialityBase,
  PoliticsSpecialityBase,
  UnitSpecialityBase,
} from './SpecialityBase';

import { BattleSpecialities } from './battle';
import { TacticsSpecialities } from './tactics';
import { PoliticsSpecialities } from './politics';
import { UnitSpecialities } from './unit';

// ============================================================================
// 장수 스탯 인터페이스
// ============================================================================

/**
 * 장수 기본 스탯
 */
export interface IGeneralStats {
  leadership: number;   // 통솔
  strength: number;     // 무력
  intel: number;        // 지력
  dex1?: number;        // 보병 숙련
  dex2?: number;        // 궁병 숙련
  dex3?: number;        // 기병 숙련
  dex4?: number;        // 귀병(계략) 숙련
  dex5?: number;        // 공성 숙련
}

/**
 * 특기 선택 옵션
 */
export interface ISpecialityPickOptions {
  excludeIds?: number[];           // 제외할 특기 ID
  excludeNames?: string[];         // 제외할 특기 이름
  categoryFilter?: SpecialityCategory[];  // 카테고리 필터
  forceCategory?: SpecialityCategory;     // 강제 카테고리
}

// ============================================================================
// 특기 레지스트리
// ============================================================================

/**
 * 장수 특기 레지스트리
 * 싱글톤 패턴
 */
export class SpecialityRegistry {
  private static instance: SpecialityRegistry;

  /** 모든 특기 클래스 */
  private battleSpecialities: Array<new () => BattleSpecialityBase>;
  private tacticsSpecialities: Array<new () => TacticsSpecialityBase>;
  private politicsSpecialities: Array<new () => PoliticsSpecialityBase>;
  private unitSpecialities: Array<new () => UnitSpecialityBase>;

  /** 캐시된 인스턴스 */
  private instanceCache: Map<number, SpecialityBase> = new Map();
  private nameToIdCache: Map<string, number> = new Map();

  private constructor() {
    this.battleSpecialities = [...BattleSpecialities];
    this.tacticsSpecialities = [...TacticsSpecialities];
    this.politicsSpecialities = [...PoliticsSpecialities];
    this.unitSpecialities = [...UnitSpecialities];

    // 캐시 초기화
    this.initializeCache();
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): SpecialityRegistry {
    if (!SpecialityRegistry.instance) {
      SpecialityRegistry.instance = new SpecialityRegistry();
    }
    return SpecialityRegistry.instance;
  }

  /**
   * 캐시 초기화
   */
  private initializeCache(): void {
    const allSpecialities = this.getAllSpecialityClasses();

    for (const SpecClass of allSpecialities) {
      const instance = new SpecClass();
      this.instanceCache.set(instance.id, instance);
      this.nameToIdCache.set(instance.name, instance.id);
    }
  }

  // ==========================================================================
  // 특기 조회
  // ==========================================================================

  /**
   * ID로 특기 인스턴스 반환
   */
  getById(id: number): SpecialityBase | undefined {
    return this.instanceCache.get(id);
  }

  /**
   * 이름으로 특기 인스턴스 반환
   */
  getByName(name: string): SpecialityBase | undefined {
    const id = this.nameToIdCache.get(name);
    if (id !== undefined) {
      return this.instanceCache.get(id);
    }
    return undefined;
  }

  /**
   * 새 인스턴스 생성
   */
  createInstance(id: number): SpecialityBase | undefined {
    const allClasses = this.getAllSpecialityClasses();
    const SpecClass = allClasses.find((cls) => {
      const temp = new cls();
      return temp.id === id;
    });

    if (SpecClass) {
      return new SpecClass();
    }
    return undefined;
  }

  /**
   * 카테고리별 특기 목록 반환
   */
  getByCategory(category: SpecialityCategory): SpecialityBase[] {
    return Array.from(this.instanceCache.values()).filter(
      (spec) => spec.category === category
    );
  }

  /**
   * 모든 특기 클래스 반환
   */
  private getAllSpecialityClasses(): Array<new () => SpecialityBase> {
    return [
      ...this.battleSpecialities,
      ...this.tacticsSpecialities,
      ...this.politicsSpecialities,
      ...this.unitSpecialities,
    ];
  }

  /**
   * 모든 특기 인스턴스 반환
   */
  getAll(): SpecialityBase[] {
    return Array.from(this.instanceCache.values());
  }

  // ==========================================================================
  // 특기 선택 로직 (PHP SpecialityHelper 참조)
  // ==========================================================================

  /**
   * 장수 스탯에 따른 조건 계산
   */
  private calcCondGeneric(stats: IGeneralStats): number {
    const CHIEF_STAT_MIN = 60; // GameConst.$chiefStatMin
    let myCond = 0;

    const { leadership, strength, intel } = stats;

    if (leadership > CHIEF_STAT_MIN) {
      myCond |= StatRequirement.STAT_LEADERSHIP;
    }

    if (strength >= intel * 0.95 && strength > CHIEF_STAT_MIN) {
      myCond |= StatRequirement.STAT_STRENGTH;
    }

    if (intel >= strength * 0.95 && intel > CHIEF_STAT_MIN) {
      myCond |= StatRequirement.STAT_INTEL;
    }

    if (myCond !== 0) {
      if (leadership < CHIEF_STAT_MIN) {
        myCond |= StatRequirement.STAT_NOT_LEADERSHIP;
      }
      if (strength < CHIEF_STAT_MIN) {
        myCond |= StatRequirement.STAT_NOT_STRENGTH;
      }
      if (intel < CHIEF_STAT_MIN) {
        myCond |= StatRequirement.STAT_NOT_INTEL;
      }
    }

    // 모든 조건이 0이면 최고 스탯 기준으로 설정
    if (myCond === 0) {
      if (leadership * 0.9 > strength && leadership * 0.9 > intel) {
        myCond |= StatRequirement.STAT_LEADERSHIP;
      } else if (strength >= intel) {
        myCond |= StatRequirement.STAT_STRENGTH;
      } else {
        myCond |= StatRequirement.STAT_INTEL;
      }
    }

    return myCond;
  }

  /**
   * 숙련도에 따른 병종 조건 계산
   */
  private calcCondDexterity(stats: IGeneralStats): number {
    const dex = {
      [StatRequirement.ARMY_FOOTMAN]: stats.dex1 ?? 0,
      [StatRequirement.ARMY_ARCHER]: stats.dex2 ?? 0,
      [StatRequirement.ARMY_CAVALRY]: stats.dex3 ?? 0,
      [StatRequirement.ARMY_WIZARD]: stats.dex4 ?? 0,
      [StatRequirement.ARMY_SIEGE]: stats.dex5 ?? 0,
    };

    const dexSum = Object.values(dex).reduce((a, b) => a + b, 0);

    // 80% 확률로 병종 조건 무시
    if (Math.random() < 0.8) {
      return 0;
    }

    const dexBase = Math.round(Math.sqrt(dexSum) / 4);
    if (Math.floor(Math.random() * 100) < dexBase) {
      return 0;
    }

    // 최고 숙련도 병종 반환
    if (dexSum === 0) {
      const keys = Object.keys(dex).map(Number);
      return keys[Math.floor(Math.random() * keys.length)];
    }

    const maxDex = Math.max(...Object.values(dex));
    const maxKeys = Object.entries(dex)
      .filter(([_, v]) => v === maxDex)
      .map(([k]) => Number(k));

    return maxKeys[Math.floor(Math.random() * maxKeys.length)];
  }

  /**
   * 전투 특기 선택
   */
  pickBattleSpeciality(
    stats: IGeneralStats,
    options: ISpecialityPickOptions = {}
  ): SpecialityBase | null {
    return this.pickSpeciality(
      [...this.battleSpecialities, ...this.unitSpecialities],
      stats,
      { ...options, forceCategory: undefined },
      true
    );
  }

  /**
   * 내정 특기 선택
   */
  pickDomesticSpeciality(
    stats: IGeneralStats,
    options: ISpecialityPickOptions = {}
  ): SpecialityBase | null {
    return this.pickSpeciality(
      [...this.politicsSpecialities, ...this.tacticsSpecialities],
      stats,
      { ...options, forceCategory: undefined },
      false
    );
  }

  /**
   * 특기 선택 공통 로직
   */
  private pickSpeciality(
    classes: Array<new () => SpecialityBase>,
    stats: IGeneralStats,
    options: ISpecialityPickOptions,
    isWar: boolean
  ): SpecialityBase | null {
    const pAbs: Map<new () => SpecialityBase, number> = new Map();
    const pRel: Map<new () => SpecialityBase, number> = new Map();

    let myCond = this.calcCondGeneric(stats);
    if (isWar) {
      myCond |= this.calcCondDexterity(stats);
      myCond |= StatRequirement.REQ_DEXTERITY;
    }

    for (const SpecClass of classes) {
      const instance = new SpecClass();

      // 제외 조건 확인
      if (options.excludeIds?.includes(instance.id)) continue;
      if (options.excludeNames?.includes(instance.name)) continue;

      // 요구 조건 확인
      const requirements = (SpecClass as any).requirements ?? [];
      let valid = false;

      if (requirements.length === 0) {
        valid = true;
      } else {
        for (const cond of requirements) {
          if (cond === (cond & myCond)) {
            valid = true;
            break;
          }
        }
      }

      if (!valid) continue;

      // 가중치 분류
      const weightType =
        (SpecClass as any).selectWeightType ?? SelectWeightType.NORM;
      const weight = (SpecClass as any).selectWeight ?? 1;

      if (weight <= 0) continue;

      if (weightType === SelectWeightType.PERCENT) {
        pAbs.set(SpecClass, weight);
      } else {
        pRel.set(SpecClass, weight);
      }
    }

    // 절대 가중치 우선
    if (pAbs.size > 0) {
      const totalAbs = Array.from(pAbs.values()).reduce((a, b) => a + b, 0);

      if (pRel.size > 0) {
        // 나머지 확률로 상대 가중치 선택
        const remainProb = Math.max(0, 100 - totalAbs);
        if (Math.random() * 100 >= remainProb) {
          // 절대 가중치에서 선택
          return this.weightedRandomSelect(pAbs);
        }
        // 상대 가중치에서 선택
        return this.weightedRandomSelect(pRel);
      }

      return this.weightedRandomSelect(pAbs);
    }

    // 상대 가중치만 있는 경우
    if (pRel.size > 0) {
      return this.weightedRandomSelect(pRel);
    }

    return null;
  }

  /**
   * 가중치 기반 랜덤 선택
   */
  private weightedRandomSelect(
    weights: Map<new () => SpecialityBase, number>
  ): SpecialityBase | null {
    const entries = Array.from(weights.entries());
    const total = entries.reduce((sum, [_, w]) => sum + w, 0);

    if (total <= 0) return null;

    let rand = Math.random() * total;

    for (const [SpecClass, weight] of entries) {
      rand -= weight;
      if (rand <= 0) {
        return new SpecClass();
      }
    }

    // 폴백
    const lastClass = entries[entries.length - 1][0];
    return new lastClass();
  }

  // ==========================================================================
  // 유틸리티
  // ==========================================================================

  /**
   * 특기 목록을 JSON으로 반환
   */
  toJSON(): object[] {
    return this.getAll().map((spec) => spec.toJSON());
  }

  /**
   * 카테고리별 특기 수 반환
   */
  getCounts(): Record<SpecialityCategory, number> {
    return {
      [SpecialityCategory.BATTLE]: this.battleSpecialities.length,
      [SpecialityCategory.TACTICS]: this.tacticsSpecialities.length,
      [SpecialityCategory.POLITICS]: this.politicsSpecialities.length,
      [SpecialityCategory.UNIT]: this.unitSpecialities.length,
      [SpecialityCategory.SPECIAL]: 0, // 아직 미구현
    };
  }

  /**
   * 디버그 정보 출력
   */
  debug(): void {
    console.log('=== SpecialityRegistry Debug ===');
    console.log('Total specialities:', this.instanceCache.size);
    console.log('Counts by category:', this.getCounts());
    console.log('All specialities:');
    for (const spec of this.getAll()) {
      console.log(`  [${spec.id}] ${spec.name} (${spec.category}): ${spec.info}`);
    }
  }
}

// 편의를 위한 싱글톤 export
export const specialityRegistry = SpecialityRegistry.getInstance();


