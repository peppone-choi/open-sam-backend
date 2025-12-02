/**
 * Test Fixtures - 국가 (Nation)
 * 
 * 테스트용 국가 객체 생성 유틸리티
 */

export interface ITestNationOptions {
  nation?: number;
  name?: string;
  color?: string;
  level?: number;
  gold?: number;
  rice?: number;
  tech?: number;
  capital?: number;
  gennum?: number;
  power?: number;
  war?: number;
  type?: number;
  aux?: Record<string, any>;
  // 외교 관련
  scout?: number;
  // 기타
  [key: string]: any;
}

export class TestNation {
  nation: number;
  name: string;
  color: string;
  level: number;
  gold: number;
  rice: number;
  tech: number;
  capital: number;
  gennum: number;
  power: number;
  war: number;
  type: number;
  aux: Record<string, any>;
  scout: number;
  [key: string]: any;

  constructor(options: ITestNationOptions = {}) {
    this.nation = options.nation ?? 1;
    this.name = options.name ?? 'TestNation';
    this.color = options.color ?? '#FF0000';
    this.level = options.level ?? 1;
    this.gold = options.gold ?? 100000;
    this.rice = options.rice ?? 50000;
    this.tech = options.tech ?? 100;
    this.capital = options.capital ?? 1;
    this.gennum = options.gennum ?? 10;
    this.power = options.power ?? 1000;
    this.war = options.war ?? 1;
    this.type = options.type ?? 0;
    this.aux = options.aux ?? {};
    this.scout = options.scout ?? 0;

    // 추가 옵션 적용
    Object.keys(options).forEach(key => {
      if (!(key in this)) {
        this[key] = options[key];
      }
    });
  }

  // PHP Nation 호환 메서드들

  getID(): number {
    return this.nation;
  }

  getCapitalID(): number {
    return this.capital;
  }

  getVar(key: string): any {
    return (this as any)[key] ?? 0;
  }

  setVar(key: string, value: any): void {
    (this as any)[key] = value;
  }

  increaseVar(key: string, amount: number): void {
    const current = (this as any)[key] ?? 0;
    (this as any)[key] = current + amount;
  }

  getAuxVar(key: string): any {
    return this.aux[key] ?? null;
  }

  setAuxVar(key: string, value: any): void {
    this.aux[key] = value;
  }

  save(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * 테스트용 국가 객체 생성
 */
export function createTestNation(overrides: Partial<ITestNationOptions> = {}): TestNation {
  return new TestNation(overrides);
}

/**
 * 다양한 preset 국가 생성
 */
export const NationPresets = {
  /** 기본 국가 */
  basic: () => createTestNation({}),

  /** 강대국 */
  powerful: () => createTestNation({
    gold: 500000,
    rice: 300000,
    tech: 200,
    gennum: 50,
    power: 10000,
    level: 3,
  }),

  /** 약소국 */
  weak: () => createTestNation({
    gold: 10000,
    rice: 5000,
    tech: 50,
    gennum: 5,
    power: 100,
    level: 1,
  }),

  /** 빈곤 국가 */
  poor: () => createTestNation({
    gold: 0,
    rice: 0,
    tech: 100,
  }),

  /** 전쟁 중 국가 */
  atWar: () => createTestNation({
    war: 1,
    gold: 100000,
    rice: 50000,
  }),

  /** 평화 국가 */
  peaceful: () => createTestNation({
    war: 0,
    gold: 200000,
    rice: 100000,
    tech: 150,
  }),

  /** 기술 선진국 */
  advanced: () => createTestNation({
    tech: 300,
    gold: 150000,
    rice: 80000,
  }),
};

/**
 * 외교 관계 테스트 헬퍼
 */
export interface ITestDiplomacy {
  nation1: number;
  nation2: number;
  relation: number;
  isAllied: boolean;
  isAtWar: boolean;
  nonAggression: boolean;
}

export function createTestDiplomacy(
  nation1: number,
  nation2: number,
  options: Partial<ITestDiplomacy> = {}
): ITestDiplomacy {
  return {
    nation1,
    nation2,
    relation: options.relation ?? 50,
    isAllied: options.isAllied ?? false,
    isAtWar: options.isAtWar ?? false,
    nonAggression: options.nonAggression ?? false,
  };
}

export const DiplomacyPresets = {
  /** 적대 관계 */
  hostile: (n1: number, n2: number) => createTestDiplomacy(n1, n2, {
    relation: 0,
    isAtWar: true,
  }),

  /** 동맹 관계 */
  allied: (n1: number, n2: number) => createTestDiplomacy(n1, n2, {
    relation: 100,
    isAllied: true,
  }),

  /** 불가침 조약 */
  nonAggression: (n1: number, n2: number) => createTestDiplomacy(n1, n2, {
    relation: 70,
    nonAggression: true,
  }),

  /** 중립 */
  neutral: (n1: number, n2: number) => createTestDiplomacy(n1, n2, {
    relation: 50,
  }),
};




