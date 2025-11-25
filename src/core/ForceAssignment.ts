/**
 * ForceAssignment.ts - CombatForce/SupportForce 자동 할당
 * 
 * PHP GeneralAI.php의 다음 로직 포팅:
 * - calcCombatForce() - 전투 부대 배치 결정
 * - calcSupportForce() - 지원 부대 배치 결정
 * - calcDevelopForce() - 내정 부대 배치 결정
 * 
 * 출력: NationPolicyValues.CombatForce, SupportForce, DevelopForce 업데이트
 */

import { NationPolicyValues, DEFAULT_NATION_POLICY_VALUES } from './AutorunNationPolicy';
import { CityInfo, GeneralInfo } from './TroopDispatch';
import { CityConst } from '../const/CityConst';
import { searchDistanceAsync } from '../func/searchDistance';

/**
 * 전쟁 경로 정보
 */
export interface WarRoute {
  fromCityID: number;
  toCityID: number;
  distance: number;
  priority: number;  // 높을수록 우선
}

/**
 * 부대 배치 결정 결과
 */
export interface ForceAssignmentResult {
  /** 전투 부대: generalID => [troopLeader, fromCity, toCity] */
  CombatForce: Record<number, [number, number, number]>;
  
  /** 지원 부대: generalID => true */
  SupportForce: Record<number, boolean>;
  
  /** 내정 부대: generalID => true */
  DevelopForce: Record<number, boolean>;
  
  /** 배치 사유 로그 */
  logs: string[];
}

/**
 * 장수 전투력 평가
 */
export interface GeneralCombatRating {
  generalID: number;
  name: string;
  rating: number;        // 종합 전투력 점수
  leadership: number;
  strength: number;
  intel: number;
  crew: number;
  train: number;
  atmos: number;
  canFight: boolean;     // 전투 가능 여부
  canRecruit: boolean;   // 징병 가능 여부 (통솔 >= minNPCWarLeadership)
  isTroopLeader: boolean; // 부대장 여부
}

/**
 * ForceAssigner - 부대 배치 자동 결정 클래스
 */
export class ForceAssigner {
  private nationID: number;
  private capital: number;
  private sessionId: string;
  private policy: NationPolicyValues;
  
  private cities: Map<number, CityInfo> = new Map();
  private generals: Map<number, GeneralInfo> = new Map();
  private frontCities: Map<number, CityInfo> = new Map();
  private supplyCities: Map<number, CityInfo> = new Map();
  private backupCities: Map<number, CityInfo> = new Map();
  
  private warRoutes: WarRoute[] = [];
  private warTargetNations: number[] = [];
  
  private logs: string[] = [];

  constructor(
    nationID: number,
    capital: number,
    sessionId: string,
    policy?: Partial<NationPolicyValues>
  ) {
    this.nationID = nationID;
    this.capital = capital;
    this.sessionId = sessionId;
    this.policy = { ...DEFAULT_NATION_POLICY_VALUES, ...policy };
  }

  /**
   * 도시 목록 설정
   */
  setCities(cities: CityInfo[]): void {
    this.cities.clear();
    this.frontCities.clear();
    this.supplyCities.clear();
    this.backupCities.clear();

    for (const city of cities) {
      if (city.nation !== this.nationID) continue;
      
      this.cities.set(city.city, city);
      
      if (city.supply) {
        this.supplyCities.set(city.city, city);
        
        if (city.front > 0) {
          this.frontCities.set(city.city, city);
        } else {
          this.backupCities.set(city.city, city);
        }
      }
    }
    
    this.logs.push(`[ForceAssigner] 도시 설정: 전방 ${this.frontCities.size}, 보급 ${this.supplyCities.size}, 후방 ${this.backupCities.size}`);
  }

  /**
   * 장수 목록 설정
   */
  setGenerals(generals: GeneralInfo[]): void {
    this.generals.clear();

    for (const gen of generals) {
      if (gen.nation !== this.nationID) continue;
      this.generals.set(gen.no, gen);
    }
    
    this.logs.push(`[ForceAssigner] 장수 설정: ${this.generals.size}명`);
  }

  /**
   * 전쟁 대상 국가 설정
   */
  setWarTargets(targetNationIDs: number[]): void {
    this.warTargetNations = targetNationIDs;
    this.logs.push(`[ForceAssigner] 전쟁 대상: ${targetNationIDs.join(', ')}`);
  }

  /**
   * 전쟁 경로 계산
   * PHP GeneralAI::calcWarRoute 참조
   * 
   * @param enemyCities 적 도시 목록
   */
  async calculateWarRoutes(enemyCities: CityInfo[]): Promise<void> {
    this.warRoutes = [];
    
    if (this.frontCities.size === 0) {
      this.logs.push('[ForceAssigner] 전방 도시 없음 - 전쟁 경로 계산 스킵');
      return;
    }

    // 각 전방 도시에서 적 도시까지의 경로 계산
    for (const frontCity of this.frontCities.values()) {
      try {
        const distMap = await searchDistanceAsync(this.sessionId, frontCity.city, 10, true);
        
        for (const enemyCity of enemyCities) {
          const distance = distMap[enemyCity.city];
          if (distance === undefined) continue;
          
          // 우선순위: 거리가 가까울수록, 적 도시 레벨이 높을수록 높음
          const priority = (10 - distance) * 10 + (enemyCity.level || 1);
          
          this.warRoutes.push({
            fromCityID: frontCity.city,
            toCityID: enemyCity.city,
            distance,
            priority
          });
        }
      } catch (error) {
        console.warn(`[ForceAssigner] 전쟁 경로 계산 실패 (도시 ${frontCity.city}):`, error);
      }
    }
    
    // 우선순위 순으로 정렬
    this.warRoutes.sort((a, b) => b.priority - a.priority);
    
    this.logs.push(`[ForceAssigner] 전쟁 경로 ${this.warRoutes.length}개 계산 완료`);
  }

  /**
   * 장수 전투력 평가
   */
  private evaluateGeneral(gen: GeneralInfo): GeneralCombatRating {
    const leadership = gen.leadership || 50;
    const strength = gen.npc === 5 ? 0 : 50; // 부대장 NPC는 무력 0으로 계산
    const intel = 50;
    const crew = gen.crew || 0;
    const train = gen.train || 0;
    const atmos = gen.atmos || 0;
    
    // 전투력 점수 계산 (PHP GeneralAI 참조)
    // 병력 * 훈련도/100 * 사기/100 * (통솔 + 무력)/100
    const crewFactor = Math.min(crew / 1000, 10); // 최대 10점
    const trainFactor = train / 100;
    const atmosFactor = atmos / 100;
    const statFactor = (leadership + strength) / 200;
    
    const rating = crewFactor * trainFactor * atmosFactor * statFactor * 100;
    
    // 전투 가능 여부
    const canFight = crew >= this.policy.minWarCrew && 
                     train >= this.policy.properWarTrainAtmos &&
                     atmos >= this.policy.properWarTrainAtmos;
    
    // 징병 가능 여부
    const canRecruit = leadership >= this.policy.minNPCWarLeadership;
    
    // 부대장 여부
    const isTroopLeader = gen.npc === 5 || gen.troop === gen.no;

    return {
      generalID: gen.no,
      name: gen.name,
      rating,
      leadership,
      strength,
      intel,
      crew,
      train,
      atmos,
      canFight,
      canRecruit,
      isTroopLeader
    };
  }

  /**
   * 부대 배치 자동 결정
   * 
   * 로직:
   * 1. 전투 가능 장수 → CombatForce (전방 배치)
   * 2. 징병 필요 장수 → SupportForce (후방 배치)
   * 3. 나머지 → DevelopForce (내정)
   */
  async assignForces(): Promise<ForceAssignmentResult> {
    const result: ForceAssignmentResult = {
      CombatForce: {},
      SupportForce: {},
      DevelopForce: {},
      logs: []
    };

    // 전방 도시가 없으면 모두 내정
    if (this.frontCities.size === 0) {
      for (const gen of this.generals.values()) {
        if (gen.npc === 5 || gen.troop === gen.no) {
          result.DevelopForce[gen.no] = true;
        }
      }
      result.logs.push('[ForceAssigner] 전방 도시 없음 - 모든 부대 내정 배치');
      return result;
    }

    // 장수 평가
    const ratings: GeneralCombatRating[] = [];
    for (const gen of this.generals.values()) {
      if (gen.npc !== 5 && gen.troop !== gen.no) continue; // 부대장만
      ratings.push(this.evaluateGeneral(gen));
    }
    
    // 전투력 순으로 정렬
    ratings.sort((a, b) => b.rating - a.rating);
    
    // 전쟁 경로별 필요 부대 수 계산
    const routesPerFront = Math.ceil(this.warRoutes.length / Math.max(this.frontCities.size, 1));
    const combatUnitsNeeded = Math.min(ratings.length, this.warRoutes.length);
    
    this.logs.push(`[ForceAssigner] 전투 부대 필요: ${combatUnitsNeeded}, 총 부대: ${ratings.length}`);

    // 1. CombatForce 배치 (전투 가능하고 전투력 높은 순)
    let combatAssigned = 0;
    for (const rating of ratings) {
      if (combatAssigned >= combatUnitsNeeded) break;
      
      if (!rating.canFight) {
        this.logs.push(`[ForceAssigner] ${rating.name}: 전투 불가 (병력:${rating.crew}, 훈련:${rating.train}, 사기:${rating.atmos})`);
        continue;
      }
      
      // 전쟁 경로 할당
      const routeIndex = combatAssigned % this.warRoutes.length;
      const route = this.warRoutes[routeIndex];
      
      if (route) {
        result.CombatForce[rating.generalID] = [rating.generalID, route.fromCityID, route.toCityID];
        this.logs.push(`[ForceAssigner] ${rating.name}: CombatForce 배치 (${route.fromCityID} -> ${route.toCityID})`);
        combatAssigned++;
      }
    }

    // 2. SupportForce 배치 (전투 불가 + 징병 가능)
    const supportNeeded = Math.max(1, Math.floor(ratings.length * 0.3)); // 30%는 지원
    let supportAssigned = 0;
    
    for (const rating of ratings) {
      if (result.CombatForce[rating.generalID]) continue; // 이미 전투 배치됨
      if (supportAssigned >= supportNeeded) break;
      
      if (rating.canRecruit) {
        result.SupportForce[rating.generalID] = true;
        this.logs.push(`[ForceAssigner] ${rating.name}: SupportForce 배치 (징병 가능, 통솔:${rating.leadership})`);
        supportAssigned++;
      }
    }

    // 3. DevelopForce 배치 (나머지)
    for (const rating of ratings) {
      if (result.CombatForce[rating.generalID]) continue;
      if (result.SupportForce[rating.generalID]) continue;
      
      result.DevelopForce[rating.generalID] = true;
      this.logs.push(`[ForceAssigner] ${rating.name}: DevelopForce 배치 (내정)`);
    }

    result.logs = [...this.logs, ...result.logs];
    
    this.logs.push(`[ForceAssigner] 배치 완료: 전투 ${Object.keys(result.CombatForce).length}, 지원 ${Object.keys(result.SupportForce).length}, 내정 ${Object.keys(result.DevelopForce).length}`);
    
    return result;
  }

  /**
   * 기존 정책에 부대 배치 적용
   */
  static async updateNationPolicy(
    sessionId: string,
    nationID: number,
    capital: number,
    cities: CityInfo[],
    generals: GeneralInfo[],
    enemyCities: CityInfo[],
    warTargetNations: number[],
    existingPolicy?: Partial<NationPolicyValues>
  ): Promise<{ policy: NationPolicyValues; logs: string[] }> {
    const assigner = new ForceAssigner(nationID, capital, sessionId, existingPolicy);
    
    assigner.setCities(cities);
    assigner.setGenerals(generals);
    assigner.setWarTargets(warTargetNations);
    await assigner.calculateWarRoutes(enemyCities);
    
    const result = await assigner.assignForces();
    
    const updatedPolicy: NationPolicyValues = {
      ...DEFAULT_NATION_POLICY_VALUES,
      ...existingPolicy,
      CombatForce: result.CombatForce,
      SupportForce: result.SupportForce,
      DevelopForce: result.DevelopForce
    };
    
    return {
      policy: updatedPolicy,
      logs: result.logs
    };
  }
}

/**
 * 간편 함수: 국가의 부대 배치 자동 업데이트
 */
export async function autoAssignForces(
  sessionId: string,
  nationID: number,
  capital: number,
  cities: CityInfo[],
  generals: GeneralInfo[],
  enemyCities: CityInfo[],
  warTargetNations: number[],
  existingPolicy?: Partial<NationPolicyValues>
): Promise<ForceAssignmentResult> {
  const assigner = new ForceAssigner(nationID, capital, sessionId, existingPolicy);
  
  assigner.setCities(cities);
  assigner.setGenerals(generals);
  assigner.setWarTargets(warTargetNations);
  await assigner.calculateWarRoutes(enemyCities);
  
  return assigner.assignForces();
}

export default ForceAssigner;
