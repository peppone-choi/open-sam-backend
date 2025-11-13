/**
 * 커맨드 테스트 헬퍼 유틸리티
 * 
 * 모든 커맨드 테스트에서 공통으로 사용하는 Mock 객체와 헬퍼 함수
 */

export interface MockGeneralOptions {
  no?: number;
  nation?: number;
  city?: number;
  gold?: number;
  rice?: number;
  crew?: number;
  leadership?: number;
  strength?: number;
  intel?: number;
  politics?: number;
  charm?: number;
  crewtype?: number;
  train?: number;
  atmos?: number;
  officer_level?: number;
  npc?: number;
  injury?: number;
  experience?: number;
  dedication?: number;
}

export interface MockCityOptions {
  city?: number;
  name?: string;
  nation?: number;
  supply?: number;
  pop?: number;
  trust?: number;
  agri?: number;
  comm?: number;
  secu?: number;
  wall?: number;
  def?: number;
  agri_max?: number;
  comm_max?: number;
  secu_max?: number;
  wall_max?: number;
  def_max?: number;
  pop_max?: number;
  level?: number;
  front?: number;
}

export interface MockNationOptions {
  nation?: number;
  name?: string;
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
}

export class MockObjects {
  /**
   * Mock 장수 객체 생성
   */
  static createMockGeneral(options: MockGeneralOptions = {}): any {
    const defaults = {
      no: 1,
      nation: 1,
      city: 1,
      gold: 10000,
      rice: 5000,
      crew: 5000,
      leadership: 80,
      strength: 75,
      intel: 70,
      politics: 65,
      charm: 60,
      crewtype: 0,
      train: 80,
      atmos: 80,
      officer_level: 5,
      npc: 0,
      injury: 0,
      experience: 1000,
      dedication: 500,
      ...options
    };

    const vars = new Map<string, any>(Object.entries(defaults));

    return {
      no: defaults.no,
      nation: defaults.nation,
      city: defaults.city,
      data: { ...defaults },
      
      getVar: jest.fn((key: string) => vars.get(key) ?? 0),
      setVar: jest.fn((key: string, value: any) => vars.set(key, value)),
      increaseVar: jest.fn((key: string, amount: number) => {
        const current = vars.get(key) ?? 0;
        vars.set(key, current + amount);
      }),
      increaseVarWithLimit: jest.fn((key: string, amount: number, limit: number) => {
        const current = vars.get(key) ?? 0;
        const newValue = Math.max(limit, current + amount);
        vars.set(key, newValue);
      }),
      
      getNationID: jest.fn(() => defaults.nation),
      getCityID: jest.fn(() => defaults.city),
      
      getLeadership: jest.fn(() => defaults.leadership),
      getStrength: jest.fn(() => defaults.strength),
      getIntel: jest.fn(() => defaults.intel),
      getPolitics: jest.fn(() => defaults.politics),
      getCharm: jest.fn(() => defaults.charm),
      
      getCrewTypeObj: jest.fn(() => ({ 
        id: defaults.crewtype, 
        name: '보병', 
        armType: 0,
        cost: 1 
      })),
      
      onCalcDomestic: jest.fn((action, key, value) => value),
      addExperience: jest.fn(),
      addDedication: jest.fn(),
      checkStatChange: jest.fn(),
      setAuxVar: jest.fn(),
      addDex: jest.fn(),
      updateMaxDomesticCritical: jest.fn(),
      
      getLogger: jest.fn(() => ({
        pushGeneralActionLog: jest.fn(),
        pushNationalHistoryLog: jest.fn(),
        pushGlobalHistoryLog: jest.fn(),
        flush: jest.fn()
      })),
      
      getTurnTime: jest.fn(() => '184년 1월'),
      getSessionID: jest.fn(() => 'test_session'),
      genGenericUniqueRNG: jest.fn(() => ({
        nextRange: jest.fn(() => 1.0),
        choiceUsingWeight: jest.fn(() => 'normal'),
        choiceUsingWeightPair: jest.fn(() => [['normal', 2], 0.33])
      })),
      
      _cached_city: null,
      _cached_nation: null,
      _vars: vars // 테스트용 직접 접근
    };
  }

  /**
   * Mock 도시 객체 생성
   */
  static createMockCity(options: MockCityOptions = {}): any {
    return {
      city: options.city ?? 1,
      name: options.name ?? '낙양',
      nation: options.nation ?? 1,
      supply: options.supply ?? 1,
      pop: options.pop ?? 100000,
      trust: options.trust ?? 80,
      agri: options.agri ?? 50000,
      comm: options.comm ?? 50000,
      secu: options.secu ?? 50000,
      wall: options.wall ?? 50000,
      def: options.def ?? 50000,
      agri_max: options.agri_max ?? 100000,
      comm_max: options.comm_max ?? 100000,
      secu_max: options.secu_max ?? 100000,
      wall_max: options.wall_max ?? 100000,
      def_max: options.def_max ?? 100000,
      pop_max: options.pop_max ?? 200000,
      level: options.level ?? 5,
      front: options.front ?? 0,
    };
  }

  /**
   * Mock 국가 객체 생성
   */
  static createMockNation(options: MockNationOptions = {}): any {
    return {
      nation: options.nation ?? 1,
      name: options.name ?? '촉',
      level: options.level ?? 1,
      gold: options.gold ?? 100000,
      rice: options.rice ?? 50000,
      tech: options.tech ?? 100,
      capital: options.capital ?? 1,
      gennum: options.gennum ?? 10,
      power: options.power ?? 1000,
      war: options.war ?? 1,
      type: options.type ?? 0,
      aux: options.aux ?? {},
    };
  }

  /**
   * Mock 환경 객체 생성
   */
  static createMockEnv(options: any = {}): any {
    return {
      year: options.year ?? 184,
      month: options.month ?? 1,
      session_id: options.session_id ?? 'test_session',
      scenario_id: options.scenario_id ?? 'sangokushi',
      turnterm: options.turnterm ?? 60,
      develcost: options.develcost ?? 100,
      startyear: options.startyear ?? 184,
      ownedCities: options.ownedCities ?? [
        { city: 1, name: '낙양', nation: 1, level: 5 }
      ],
      ...options
    };
  }

  /**
   * Mock RNG 객체 생성
   */
  static createMockRNG(options: any = {}): any {
    return {
      nextRange: jest.fn((min: number, max: number) => 
        options.nextRange ?? (min + max) / 2
      ),
      choiceUsingWeight: jest.fn((weights: Record<string, number>) => 
        options.choice ?? Object.keys(weights)[0]
      ),
      choiceUsingWeightPair: jest.fn((pairs: any[]) => 
        options.choicePair ?? pairs[0]
      ),
      nextBool: jest.fn(() => options.nextBool ?? true),
      nextInt: jest.fn((max: number) => options.nextInt ?? 0),
    };
  }
}

/**
 * 제약 조건 테스트 헬퍼
 */
export class ConstraintTestHelper {
  /**
   * 특정 제약이 존재하는지 확인
   */
  static hasConstraint(constraints: any[], searchText: string): boolean {
    return constraints.some(c => 
      c.test?.toString().includes(searchText) ||
      c.reason?.includes(searchText) ||
      c.message?.includes(searchText)
    );
  }

  /**
   * 제약 조건 테스트 실행
   */
  static testConstraint(
    constraints: any[], 
    searchText: string, 
    input: any, 
    env: any
  ): string | null {
    const constraint = constraints.find(c => 
      c.test?.toString().includes(searchText)
    );
    
    if (!constraint) {
      throw new Error(`Constraint not found: ${searchText}`);
    }
    
    return constraint.test(input, env);
  }

  /**
   * 모든 제약 조건 통과 확인
   */
  static allConstraintsPassed(
    constraints: any[], 
    input: any, 
    env: any
  ): boolean {
    return constraints.every(c => c.test(input, env) === null);
  }

  /**
   * 실패한 제약 조건 찾기
   */
  static findFailedConstraints(
    constraints: any[], 
    input: any, 
    env: any
  ): Array<{ constraint: any; reason: string }> {
    return constraints
      .map(c => ({ constraint: c, reason: c.test(input, env) }))
      .filter(r => r.reason !== null);
  }
}

/**
 * 커맨드 테스트 유틸리티
 */
export class CommandTestHelper {
  /**
   * 커맨드 초기화 및 실행 준비
   */
  static prepareCommand(
    CommandClass: any,
    generalOptions: MockGeneralOptions = {},
    cityOptions: MockCityOptions = {},
    nationOptions: MockNationOptions = {},
    envOptions: any = {},
    arg: any = null
  ): { command: any; general: any; city: any; nation: any; env: any } {
    const general = MockObjects.createMockGeneral(generalOptions);
    const city = MockObjects.createMockCity(cityOptions);
    const nation = MockObjects.createMockNation(nationOptions);
    const env = MockObjects.createMockEnv(envOptions);

    general._cached_city = city;
    general._cached_nation = nation;

    const command = new CommandClass(general, env, arg);

    return { command, general, city, nation, env };
  }

  /**
   * 커맨드 비용 검증
   */
  static validateCost(
    cost: [number, number],
    expectedGold?: number,
    expectedRice?: number
  ): void {
    const [gold, rice] = cost;
    
    if (expectedGold !== undefined) {
      expect(gold).toBe(expectedGold);
    } else {
      expect(gold).toBeGreaterThanOrEqual(0);
    }
    
    if (expectedRice !== undefined) {
      expect(rice).toBe(expectedRice);
    } else {
      expect(rice).toBeGreaterThanOrEqual(0);
    }
  }

  /**
   * 커맨드 실행 및 결과 검증
   */
  static async executeAndValidate(
    command: any,
    rng: any = MockObjects.createMockRNG()
  ): Promise<boolean> {
    const result = await command.run(rng);
    expect(typeof result).toBe('boolean');
    return result;
  }
}
