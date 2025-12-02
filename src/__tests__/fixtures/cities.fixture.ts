/**
 * Test Fixtures - 도시 (City)
 * 
 * 테스트용 도시 객체 생성 유틸리티
 */

export interface ITestCityOptions {
  city?: number;
  name?: string;
  nation?: number;
  supply?: number;
  pop?: number;
  pop_max?: number;
  trust?: number;
  agri?: number;
  agri_max?: number;
  comm?: number;
  comm_max?: number;
  secu?: number;
  secu_max?: number;
  wall?: number;
  wall_max?: number;
  def?: number;
  def_max?: number;
  level?: number;
  front?: number;
  state?: number;
  region?: number;
  // 기타
  [key: string]: any;
}

export class TestCity {
  city: number;
  name: string;
  nation: number;
  supply: number;
  pop: number;
  pop_max: number;
  trust: number;
  agri: number;
  agri_max: number;
  comm: number;
  comm_max: number;
  secu: number;
  secu_max: number;
  wall: number;
  wall_max: number;
  def: number;
  def_max: number;
  level: number;
  front: number;
  state: number;
  region: number;
  [key: string]: any;

  constructor(options: ITestCityOptions = {}) {
    this.city = options.city ?? 1;
    this.name = options.name ?? 'TestCity';
    this.nation = options.nation ?? 0;
    this.supply = options.supply ?? 1;
    this.pop = options.pop ?? 10000;
    this.pop_max = options.pop_max ?? 100000;
    this.trust = options.trust ?? 50;
    this.agri = options.agri ?? 500;
    this.agri_max = options.agri_max ?? 1000;
    this.comm = options.comm ?? 500;
    this.comm_max = options.comm_max ?? 1000;
    this.secu = options.secu ?? 500;
    this.secu_max = options.secu_max ?? 1000;
    this.wall = options.wall ?? 500;
    this.wall_max = options.wall_max ?? 1000;
    this.def = options.def ?? 500;
    this.def_max = options.def_max ?? 1000;
    this.level = options.level ?? 5;
    this.front = options.front ?? 0;
    this.state = options.state ?? 0;
    this.region = options.region ?? 1;

    // 추가 옵션 적용
    Object.keys(options).forEach(key => {
      if (!(key in this)) {
        this[key] = options[key];
      }
    });
  }

  // PHP City 호환 메서드들

  getID(): number {
    return this.city;
  }

  getNationID(): number {
    return this.nation;
  }

  isSupplied(): boolean {
    return this.supply === 1;
  }

  isFront(): boolean {
    return this.front === 1;
  }

  getMaxPop(): number {
    return this.pop_max;
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

  save(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * 테스트용 도시 객체 생성
 */
export function createTestCity(overrides: Partial<ITestCityOptions> = {}): TestCity {
  return new TestCity(overrides);
}

/**
 * 다양한 preset 도시 생성
 */
export const CityPresets = {
  /** 중립 도시 */
  neutral: () => createTestCity({
    nation: 0,
    supply: 0,
    pop: 5000,
    trust: 30,
  }),

  /** 점령된 도시 (보급 O) */
  occupied: () => createTestCity({
    nation: 1,
    supply: 1,
    pop: 50000,
    trust: 70,
  }),

  /** 보급 끊긴 도시 */
  cutOff: () => createTestCity({
    nation: 1,
    supply: 0,
    pop: 30000,
    trust: 40,
  }),

  /** 수도 */
  capital: () => createTestCity({
    nation: 1,
    supply: 1,
    level: 7,
    pop: 200000,
    pop_max: 500000,
    trust: 100,
    agri: 900,
    comm: 900,
    secu: 900,
    wall: 900,
    def: 900,
  }),

  /** 최전선 도시 */
  frontline: () => createTestCity({
    nation: 1,
    supply: 1,
    front: 1,
    pop: 30000,
    trust: 50,
    def: 800,
    wall: 800,
  }),

  /** 황폐한 도시 */
  devastated: () => createTestCity({
    nation: 1,
    supply: 1,
    pop: 1000,
    pop_max: 50000,
    trust: 10,
    agri: 50,
    comm: 50,
    secu: 50,
    wall: 50,
    def: 50,
  }),

  /** 풍요로운 도시 */
  prosperous: () => createTestCity({
    nation: 1,
    supply: 1,
    pop: 150000,
    pop_max: 200000,
    trust: 95,
    agri: 950,
    comm: 950,
    secu: 950,
    wall: 700,
    def: 700,
  }),

  /** 성벽 도시 (높은 방어) */
  fortress: () => createTestCity({
    nation: 1,
    supply: 1,
    pop: 80000,
    wall: 1000,
    wall_max: 1000,
    def: 1000,
    def_max: 1000,
  }),
};




