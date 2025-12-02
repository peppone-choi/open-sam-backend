/**
 * 명마 등록 시스템
 * 모든 명마를 등록하고 조회하는 레지스트리
 */

import { MountBase } from './MountBase';
import { MountGrade, MountMetadata, MountFilterOptions, MountSortOptions } from './types';

// 일반 명마
import { Mount01Nogi } from './common/Mount01Nogi';
import { Mount02Jorang } from './common/Mount02Jorang';
import { Mount03Nosae } from './common/Mount03Nosae';
import { Mount04Nagwi } from './common/Mount04Nagwi';
import { Mount05GalsaekMa } from './common/Mount05GalsaekMa';
import { Mount06HeuksaekMa } from './common/Mount06HeuksaekMa';

// 고급 명마
import { Mount07GijuMa } from './advanced/Mount07GijuMa';
import { Mount07BaekMa } from './advanced/Mount07BaekMa';
import { Mount07BaekSang } from './advanced/Mount07BaekSang';
import { Mount07OhwanMa } from './advanced/Mount07OhwanMa';
import { Mount08YangjuMa } from './advanced/Mount08YangjuMa';
import { Mount08HyungnoMa } from './advanced/Mount08HyungnoMa';
import { Mount09GwahaMa } from './advanced/Mount09GwahaMa';
import { Mount09UinamBaekMa } from './advanced/Mount09UinamBaekMa';

// 희귀 명마
import { Mount10DaewanMa } from './rare/Mount10DaewanMa';
import { Mount10OkchuMa } from './rare/Mount10OkchuMa';
import { Mount11SeoryangMa } from './rare/Mount11SeoryangMa';
import { Mount11HwajongMa } from './rare/Mount11HwajongMa';
import { Mount12SaryunGeo } from './rare/Mount12SaryunGeo';
import { Mount12OkranBaekYongGu } from './rare/Mount12OkranBaekYongGu';

// 전설 명마
import { Mount13JeokRo } from './legendary/Mount13JeokRo';
import { Mount13JeolYoung } from './legendary/Mount13JeolYoung';
import { Mount14JeokRanMa } from './legendary/Mount14JeokRanMa';
import { Mount14JohwangBijeon } from './legendary/Mount14JohwangBijeon';
import { Mount15JeokToMa } from './legendary/Mount15JeokToMa';
import { Mount15HanHyulMa } from './legendary/Mount15HanHyulMa';

/**
 * 명마 클래스 생성자 타입
 */
type MountConstructor = new () => MountBase;

/**
 * 명마 레지스트리 클래스
 * 싱글톤 패턴으로 구현
 */
export class MountRegistry {
  private static instance: MountRegistry;
  private mounts: Map<string, MountBase> = new Map();
  private mountClasses: Map<string, MountConstructor> = new Map();

  private constructor() {
    this.registerAll();
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): MountRegistry {
    if (!MountRegistry.instance) {
      MountRegistry.instance = new MountRegistry();
    }
    return MountRegistry.instance;
  }

  /**
   * 모든 명마 등록
   */
  private registerAll(): void {
    // 일반 명마 (등급 1-6)
    this.register(Mount01Nogi);
    this.register(Mount02Jorang);
    this.register(Mount03Nosae);
    this.register(Mount04Nagwi);
    this.register(Mount05GalsaekMa);
    this.register(Mount06HeuksaekMa);

    // 고급 명마 (등급 7-9)
    this.register(Mount07GijuMa);
    this.register(Mount07BaekMa);
    this.register(Mount07BaekSang);
    this.register(Mount07OhwanMa);
    this.register(Mount08YangjuMa);
    this.register(Mount08HyungnoMa);
    this.register(Mount09GwahaMa);
    this.register(Mount09UinamBaekMa);

    // 희귀 명마 (등급 10-12)
    this.register(Mount10DaewanMa);
    this.register(Mount10OkchuMa);
    this.register(Mount11SeoryangMa);
    this.register(Mount11HwajongMa);
    this.register(Mount12SaryunGeo);
    this.register(Mount12OkranBaekYongGu);

    // 전설 명마 (등급 13-15)
    this.register(Mount13JeokRo);
    this.register(Mount13JeolYoung);
    this.register(Mount14JeokRanMa);
    this.register(Mount14JohwangBijeon);
    this.register(Mount15JeokToMa);
    this.register(Mount15HanHyulMa);
  }

  /**
   * 명마 클래스 등록
   */
  private register(MountClass: MountConstructor): void {
    const mount = new MountClass();
    this.mounts.set(mount.code, mount);
    this.mountClasses.set(mount.code, MountClass);
  }

  /**
   * 코드로 명마 인스턴스 조회
   */
  get(code: string): MountBase | undefined {
    return this.mounts.get(code);
  }

  /**
   * 코드로 새 명마 인스턴스 생성
   */
  create(code: string): MountBase | undefined {
    const MountClass = this.mountClasses.get(code);
    if (MountClass) {
      return new MountClass();
    }
    return undefined;
  }

  /**
   * 모든 명마 목록 반환
   */
  getAll(): MountBase[] {
    return Array.from(this.mounts.values());
  }

  /**
   * 모든 명마 코드 목록 반환
   */
  getAllCodes(): string[] {
    return Array.from(this.mounts.keys());
  }

  /**
   * 등급별 명마 목록 반환
   */
  getByGrade(grade: MountGrade): MountBase[] {
    return this.getAll().filter(mount => mount.grade === grade);
  }

  /**
   * 구매 가능한 명마 목록 반환
   */
  getBuyable(): MountBase[] {
    return this.getAll().filter(mount => mount.buyable);
  }

  /**
   * 필터 조건으로 명마 목록 반환
   */
  filter(options: MountFilterOptions): MountBase[] {
    let result = this.getAll();

    if (options.grade !== undefined) {
      const grades = Array.isArray(options.grade) ? options.grade : [options.grade];
      result = result.filter(mount => grades.includes(mount.grade));
    }

    if (options.buyable !== undefined) {
      result = result.filter(mount => mount.buyable === options.buyable);
    }

    if (options.minStatValue !== undefined) {
      result = result.filter(mount => mount.statValue >= options.minStatValue!);
    }

    if (options.maxStatValue !== undefined) {
      result = result.filter(mount => mount.statValue <= options.maxStatValue!);
    }

    if (options.hasSpecialEffect !== undefined) {
      result = result.filter(mount => {
        const effect = mount.getEffect();
        const hasSpecial = effect.special !== undefined;
        return hasSpecial === options.hasSpecialEffect;
      });
    }

    return result;
  }

  /**
   * 정렬된 명마 목록 반환
   */
  sort(mounts: MountBase[], options: MountSortOptions): MountBase[] {
    const sorted = [...mounts];
    const multiplier = options.order === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (options.by) {
        case 'grade':
          const gradeOrder: Record<MountGrade, number> = {
            common: 1,
            advanced: 2,
            rare: 3,
            legendary: 4,
          };
          return (gradeOrder[a.grade] - gradeOrder[b.grade]) * multiplier;
        case 'cost':
          return (a.cost - b.cost) * multiplier;
        case 'statValue':
          return (a.statValue - b.statValue) * multiplier;
        case 'name':
          return a.rawName.localeCompare(b.rawName, 'ko') * multiplier;
        default:
          return 0;
      }
    });

    return sorted;
  }

  /**
   * 명마 메타데이터 목록 반환
   */
  getMetadata(): MountMetadata[] {
    return this.getAll().map(mount => ({
      code: mount.code,
      rawName: mount.rawName,
      statValue: mount.statValue,
      grade: mount.grade,
      cost: mount.cost,
      buyable: mount.buyable,
      reqSecu: mount.reqSecu,
      info: mount.info,
      hasSpecialEffect: mount.getEffect().special !== undefined,
    }));
  }

  /**
   * 명마 수 반환
   */
  get count(): number {
    return this.mounts.size;
  }

  /**
   * 등급별 명마 수 반환
   */
  getCountByGrade(): Record<MountGrade, number> {
    const counts: Record<MountGrade, number> = {
      common: 0,
      advanced: 0,
      rare: 0,
      legendary: 0,
    };

    for (const mount of this.mounts.values()) {
      counts[mount.grade]++;
    }

    return counts;
  }

  /**
   * 명마 존재 여부 확인
   */
  has(code: string): boolean {
    return this.mounts.has(code);
  }

  /**
   * 랜덤 명마 반환
   */
  getRandom(options?: MountFilterOptions): MountBase | undefined {
    const pool = options ? this.filter(options) : this.getAll();
    if (pool.length === 0) return undefined;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * 등급별 랜덤 명마 반환
   */
  getRandomByGrade(grade: MountGrade): MountBase | undefined {
    const pool = this.getByGrade(grade);
    if (pool.length === 0) return undefined;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }
}

/**
 * 기본 레지스트리 인스턴스 export
 */
export const mountRegistry = MountRegistry.getInstance();


