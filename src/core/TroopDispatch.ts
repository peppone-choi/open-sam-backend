/**
 * TroopDispatch - 부대 발령 로직 (수뇌/군주 국가 커맨드)
 * 
 * PHP GeneralAI.php의 다음 메서드 포팅:
 * - do부대전방발령() (lines 294-397) - 전투 부대를 전방으로 발령
 * - do부대후방발령() (lines 399-486) - 지원 부대를 후방으로 발령
 * - do부대구출발령() (lines 488-539) - 고립 부대를 구출
 * 
 * 출력 형식: { command: 'che_발령', args: { destGeneralID, destCityID }, reason: string }
 */

import { AICommandDecision } from './SimpleAI';
import { AutorunNationPolicy, NationPolicyValues } from './AutorunNationPolicy';
import { CityConst } from '../const/CityConst';
import { Util } from '../utils/Util';

/**
 * 도시 정보 인터페이스
 */
export interface CityInfo {
  city: number;
  name: string;
  nation: number;
  pop: number;
  pop_max: number;
  supply: number;
  front: number;
  level: number;
}

/**
 * 장수 정보 인터페이스
 */
export interface GeneralInfo {
  no: number;
  name: string;
  nation: number;
  city: number;
  npc: number;
  officer_level: number;
  troop: number;
  crew: number;
  train: number;
  atmos: number;
  leadership: number;
  aux?: {
    last발령?: number;
  };
  turnTime?: string;
}

/**
 * 부대 발령 결과
 */
export interface DispatchResult {
  command: 'che_발령';
  args: {
    destGeneralID: number;
    destCityID: number;
  };
  reason: string;
}

/**
 * 랜덤 유틸리티
 */
class RandUtil {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 1000000);
  }

  random(): number {
    this.seed = Math.sin(this.seed) * 10000;
    return this.seed - Math.floor(this.seed);
  }

  choice<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    const index = Math.floor(this.random() * arr.length);
    return arr[index];
  }
}

/**
 * TroopDispatcher - 부대 발령 결정 클래스
 * 
 * PHP GeneralAI의 do부대전방발령, do부대후방발령, do부대구출발령 구현
 */
export class TroopDispatcher {
  private nation: any;
  private env: any;
  private nationPolicy: NationPolicyValues;
  private rng: RandUtil;

  // 도시 분류
  private frontCities: Map<number, CityInfo> = new Map();
  private supplyCities: Map<number, CityInfo> = new Map();
  private backupCities: Map<number, CityInfo> = new Map();

  // 장수 분류
  private troopLeaders: Map<number, GeneralInfo> = new Map();
  private nationGenerals: Map<number, GeneralInfo> = new Map();

  // 전쟁 경로
  private warRoute: Map<number, Map<number, number>> | null = null;
  private warTargetNation: number[] = [];

  constructor(
    nation: any,
    env: any,
    nationPolicy: NationPolicyValues,
    seed?: number
  ) {
    this.nation = nation?.data || nation;
    this.env = env;
    this.nationPolicy = nationPolicy;
    this.rng = new RandUtil(seed);
  }

  /**
   * 도시 목록 설정 및 분류
   * 
   * PHP GeneralAI::categorizeNationCities() 참조
   */
  setCities(cities: CityInfo[]): void {
    this.frontCities.clear();
    this.supplyCities.clear();
    this.backupCities.clear();

    const nationID = this.nation?.nation || 0;

    for (const city of cities) {
      if (city.nation !== nationID) continue;
      if (!city.supply) continue;

      this.supplyCities.set(city.city, city);

      if (city.front) {
        this.frontCities.set(city.city, city);
      } else {
        this.backupCities.set(city.city, city);
      }
    }
  }

  /**
   * 장수 목록 설정 및 분류
   * 
   * PHP GeneralAI::categorizeNationGeneral() 참조
   * - troopLeaders: npc=5 (부대장) 또는 troop=자기ID이고 che_집합 예약 중인 장수
   */
  setGenerals(generals: GeneralInfo[]): void {
    this.troopLeaders.clear();
    this.nationGenerals.clear();

    const nationID = this.nation?.nation || 0;

    for (const gen of generals) {
      if (gen.nation !== nationID) continue;

      this.nationGenerals.set(gen.no, gen);

      // 부대장 판별: npc=5 또는 troop=자기ID (부대를 이끄는 장수)
      if (gen.npc === 5) {
        this.troopLeaders.set(gen.no, gen);
      } else if (gen.troop === gen.no) {
        // 비 NPC 부대장 (troop이 자기 자신인 경우)
        this.troopLeaders.set(gen.no, gen);
      }
    }
  }

  /**
   * 전쟁 대상 국가 설정
   */
  setWarTargets(targetNationIDs: number[]): void {
    this.warTargetNation = targetNationIDs;
  }

  /**
   * 전쟁 경로 계산
   * 
   * PHP GeneralAI::calcWarRoute() 참조
   * warRoute[fromCity][toCity] = distance
   * 
   * @param distances 도시 간 거리 맵 { [fromCity]: { [toCity]: distance } }
   */
  setWarRoute(distances: Record<number, Record<number, number>>): void {
    this.warRoute = new Map();
    for (const [from, toMap] of Object.entries(distances)) {
      const fromID = parseInt(from, 10);
      const innerMap = new Map<number, number>();
      for (const [to, dist] of Object.entries(toMap)) {
        innerMap.set(parseInt(to, 10), dist as number);
      }
      this.warRoute.set(fromID, innerMap);
    }
  }

  /**
   * 부대 전방 발령
   * 
   * PHP do부대전방발령() (lines 294-397) 완전 포팅
   * 
   * CombatForce에 등록된 부대장이 전방 도시에 없으면 전방으로 발령
   * 
   * @param chiefTurnTime 수뇌 턴 시간 (turnterm 기준 cutTurn 값)
   * @returns 발령 결정 또는 null
   */
  doTroopFrontDispatch(chiefTurnTime: number): DispatchResult | null {
    // 조건 체크
    if (!this.nation?.capital) {
      return null;
    }
    if (this.frontCities.size === 0) {
      return null;
    }
    if (!this.warRoute) {
      return null;
    }

    const yearMonth = Util.joinYearMonth(this.env.year, this.env.month);
    const turnterm = this.env.turnterm || 10;
    const troopCandidates: Array<{ destGeneralID: number; destCityID: number }> = [];

    const troopLeaderEntries = Array.from(this.troopLeaders.entries());
    for (const [leaderID, troopLeader] of troopLeaderEntries) {
      // CombatForce에 등록된 부대만 처리
      if (!this.nationPolicy.CombatForce[leaderID]) {
        continue;
      }

      const currentCityID = troopLeader.city;

      // 이미 전방 도시에 있으면 skip
      if (this.frontCities.has(currentCityID)) {
        continue;
      }

      // 발령 쿨다운 체크 (한 턴에 한 번만)
      const last발령 = troopLeader.aux?.last발령;
      if (last발령) {
        const leaderTurn = this.cutTurn(troopLeader.turnTime || '', turnterm);
        let compYearMonth = yearMonth;
        if (chiefTurnTime < leaderTurn) {
          compYearMonth += 1;
        }
        if (last발령 === compYearMonth) {
          continue;
        }
      }

      // CombatForce: [fromCityID, toCityID, ?]
      const [fromCityID, toCityID] = this.nationPolicy.CombatForce[leaderID];

      // 공격 루트 유효성 체크
      const fromRoute = this.warRoute.get(fromCityID);
      const toRoute = this.warRoute.get(toCityID);

      if (!fromRoute && !toRoute) {
        // 공격 루트 상실 - 전방 아무데나
        const randomFrontCity = this.rng.choice(Array.from(this.frontCities.values()));
        troopCandidates.push({
          destGeneralID: leaderID,
          destCityID: randomFrontCity.city,
        });
        continue;
      }

      if (fromRoute && !fromRoute.has(toCityID)) {
        // 공격 루트 상실 - 전방 아무데나
        const randomFrontCity = this.rng.choice(Array.from(this.frontCities.values()));
        troopCandidates.push({
          destGeneralID: leaderID,
          destCityID: randomFrontCity.city,
        });
        continue;
      }

      // 점령 완료 체크
      if (this.supplyCities.has(fromCityID) && this.supplyCities.has(toCityID)) {
        // 점령 완료 - 전방 아무데나
        const randomFrontCity = this.rng.choice(Array.from(this.frontCities.values()));
        troopCandidates.push({
          destGeneralID: leaderID,
          destCityID: randomFrontCity.city,
        });
        continue;
      }

      // 출발지가 아국땅이 아닌 경우: 수도->출발지
      let actualFromCityID = fromCityID;
      let actualToCityID = toCityID;
      if (!this.supplyCities.has(fromCityID)) {
        actualToCityID = fromCityID;
        actualFromCityID = this.nation.capital;
      }

      // 접경에 도달할 때까지 전진 경로 계산
      let targetCityID = actualFromCityID;
      while (!this.frontCities.has(targetCityID)) {
        const currentRoute = this.warRoute.get(targetCityID);
        if (!currentRoute) break;

        const distance = currentRoute.get(actualToCityID);
        if (distance === undefined) break;

        const nextCityCandidates: number[] = [];
        const cityEntry = CityConst.byID(targetCityID);
        const neighbors = cityEntry?.neighbors || [];

        for (const nearCityID of neighbors) {
          const nearRoute = this.warRoute.get(nearCityID);
          if (!nearRoute || !nearRoute.has(actualToCityID)) {
            continue;
          }
          const nearDistance = nearRoute.get(actualToCityID)!;
          if (nearDistance + 1 > distance) {
            continue;
          }
          nextCityCandidates.push(nearCityID);
        }

        if (nextCityCandidates.length === 0) {
          console.warn('[TroopDispatch] 경로 계산 실패 - 다음 도시 후보 없음');
          break;
        }

        if (nextCityCandidates.length === 1) {
          targetCityID = nextCityCandidates[0];
        } else {
          targetCityID = this.rng.choice(nextCityCandidates);
        }
      }

      troopCandidates.push({
        destGeneralID: leaderID,
        destCityID: targetCityID,
      });
    }

    if (troopCandidates.length === 0) {
      return null;
    }

    const selected = this.rng.choice(troopCandidates);
    const targetGeneral = this.troopLeaders.get(selected.destGeneralID);
    const targetCity = CityConst.byID(selected.destCityID);

    return {
      command: 'che_발령',
      args: {
        destGeneralID: selected.destGeneralID,
        destCityID: selected.destCityID,
      },
      reason: `전방 발령: ${targetGeneral?.name || selected.destGeneralID} -> ${targetCity?.name || selected.destCityID}`,
    };
  }

  /**
   * 부대 후방 발령
   * 
   * PHP do부대후방발령() (lines 399-486) 완전 포팅
   * 
   * SupportForce에 등록된 부대장이 징병 가능한 후방 도시에 없으면 후방으로 발령
   * 
   * @param chiefTurnTime 수뇌 턴 시간
   * @returns 발령 결정 또는 null
   */
  doTroopRearDispatch(chiefTurnTime: number): DispatchResult | null {
    // 조건 체크
    if (!this.nation?.capital) {
      return null;
    }
    if (this.frontCities.size === 0) {
      return null;
    }

    const yearMonth = Util.joinYearMonth(this.env.year, this.env.month);
    const turnterm = this.env.turnterm || 10;
    const troopCandidates: Map<number, GeneralInfo> = new Map();

    const troopLeaderEntries2 = Array.from(this.troopLeaders.entries());
    for (const [leaderID, troopLeader] of troopLeaderEntries2) {
      // SupportForce에 등록된 부대만 처리
      if (!this.nationPolicy.SupportForce[leaderID]) {
        continue;
      }

      const currentCityID = troopLeader.city;

      // 보급 도시가 아니면 후보로 추가
      if (!this.supplyCities.has(currentCityID)) {
        troopCandidates.set(leaderID, troopLeader);
        continue;
      }

      // 현재 도시의 인구 비율 체크 - 충분히 징병 가능하면 유지
      const city = this.supplyCities.get(currentCityID);
      if (city) {
        const popRatio = city.pop / Math.max(city.pop_max, 1);
        if (popRatio >= this.nationPolicy.safeRecruitCityPopulationRatio) {
          continue;
        }
      }

      // 발령 쿨다운 체크
      const last발령 = troopLeader.aux?.last발령;
      if (last발령) {
        const leaderTurn = this.cutTurn(troopLeader.turnTime || '', turnterm);
        let compYearMonth = yearMonth;
        if (chiefTurnTime < leaderTurn) {
          compYearMonth += 1;
        }
        if (last발령 === compYearMonth) {
          continue;
        }
      }

      troopCandidates.set(leaderID, troopLeader);
    }

    if (troopCandidates.size === 0) {
      return null;
    }

    // 보급 도시가 1개뿐이면 발령 불가
    if (this.supplyCities.size <= 1) {
      return null;
    }

    // 징병 가능한 도시 찾기
    let cityCandidates: CityInfo[] = [];

    // 1차: 후방 도시 중 인구 비율이 충분한 곳
    const backupCityValues = Array.from(this.backupCities.values());
    for (const city of backupCityValues) {
      const popRatio = city.pop / Math.max(city.pop_max, 1);
      if (popRatio >= this.nationPolicy.safeRecruitCityPopulationRatio) {
        cityCandidates.push(city);
      }
    }

    // 2차: 후방이 없으면 보급 도시 전체에서 탐색
    if (cityCandidates.length === 0) {
      const supplyCityValues = Array.from(this.supplyCities.values());
      for (const city of supplyCityValues) {
        const popRatio = city.pop / Math.max(city.pop_max, 1);
        if (popRatio >= this.nationPolicy.safeRecruitCityPopulationRatio) {
          cityCandidates.push(city);
        }
      }
    }

    if (cityCandidates.length === 0) {
      return null;
    }

    const selectedGeneral = this.rng.choice(Array.from(troopCandidates.values()));
    const selectedCity = this.rng.choice(cityCandidates);

    return {
      command: 'che_발령',
      args: {
        destGeneralID: selectedGeneral.no,
        destCityID: selectedCity.city,
      },
      reason: `후방 발령: ${selectedGeneral.name} -> ${selectedCity.name} (징병 위해)`,
    };
  }

  /**
   * 부대 구출 발령
   * 
   * PHP do부대구출발령() (lines 488-539) 완전 포팅
   * 
   * CombatForce/SupportForce 어디에도 속하지 않은 고립 부대를 전방으로 구출
   * 
   * @returns 발령 결정 또는 null
   */
  doTroopRescue(): DispatchResult | null {
    // 조건 체크
    if (!this.nation?.capital) {
      return null;
    }
    if (this.frontCities.size === 0) {
      return null;
    }

    const troopCandidates: Map<number, GeneralInfo> = new Map();

    const troopLeaderEntries3 = Array.from(this.troopLeaders.entries());
    for (const [leaderID, troopLeader] of troopLeaderEntries3) {
      // SupportForce 소속이면 skip
      if (this.nationPolicy.SupportForce[leaderID]) {
        continue;
      }
      // CombatForce 소속이면 skip
      if (this.nationPolicy.CombatForce[leaderID]) {
        continue;
      }

      // 보급 도시에 있으면 고립 아님
      const currentCityID = troopLeader.city;
      if (this.supplyCities.has(currentCityID)) {
        continue;
      }

      // 고립된 부대 발견
      troopCandidates.set(leaderID, troopLeader);
    }

    if (troopCandidates.size === 0) {
      return null;
    }

    // 전방 도시로 구출
    const cityCandidates = Array.from(this.frontCities.values());
    if (cityCandidates.length === 0) {
      return null;
    }

    const selectedGeneral = this.rng.choice(Array.from(troopCandidates.values()));
    const selectedCity = this.rng.choice(cityCandidates);

    return {
      command: 'che_발령',
      args: {
        destGeneralID: selectedGeneral.no,
        destCityID: selectedCity.city,
      },
      reason: `구출 발령: ${selectedGeneral.name} (고립) -> ${selectedCity.name} (전방)`,
    };
  }

  /**
   * 모든 발령 로직을 우선순위에 따라 실행
   * 
   * 우선순위:
   * 1. 부대구출발령 (고립 부대 구출이 최우선)
   * 2. 부대전방발령 (전투 준비)
   * 3. 부대후방발령 (징병/보급)
   * 
   * @param chiefTurnTime 수뇌 턴 시간
   * @returns 발령 결정 또는 null
   */
  decideDispatch(chiefTurnTime: number): DispatchResult | null {
    // 1. 구출 발령 (고립 부대 구출이 최우선)
    const rescue = this.doTroopRescue();
    if (rescue) return rescue;

    // 2. 전방 발령
    const frontDispatch = this.doTroopFrontDispatch(chiefTurnTime);
    if (frontDispatch) return frontDispatch;

    // 3. 후방 발령
    const rearDispatch = this.doTroopRearDispatch(chiefTurnTime);
    if (rearDispatch) return rearDispatch;

    return null;
  }

  /**
   * 턴 시간을 turnterm 기준 정수로 변환
   * 
   * PHP cutTurn() 함수와 동일
   */
  private cutTurn(turnTimeStr: string, turnterm: number): number {
    if (!turnTimeStr) return 0;
    const d = new Date(turnTimeStr);
    return Math.floor(d.getTime() / (turnterm * 60 * 1000));
  }
}

/**
 * SimpleAI에서 사용할 수 있는 간편 래퍼 함수들
 */

/**
 * 부대 전방 발령 결정
 */
export function doTroopFrontDispatch(
  nation: any,
  env: any,
  nationPolicy: NationPolicyValues,
  cities: CityInfo[],
  generals: GeneralInfo[],
  warRoute: Record<number, Record<number, number>>,
  chiefTurnTime: number,
  seed?: number
): AICommandDecision | null {
  const dispatcher = new TroopDispatcher(nation, env, nationPolicy, seed);
  dispatcher.setCities(cities);
  dispatcher.setGenerals(generals);
  dispatcher.setWarRoute(warRoute);

  const result = dispatcher.doTroopFrontDispatch(chiefTurnTime);
  if (!result) return null;

  return {
    command: result.command,
    args: result.args,
    weight: 80,
    reason: result.reason,
  };
}

/**
 * 부대 후방 발령 결정
 */
export function doTroopRearDispatch(
  nation: any,
  env: any,
  nationPolicy: NationPolicyValues,
  cities: CityInfo[],
  generals: GeneralInfo[],
  chiefTurnTime: number,
  seed?: number
): AICommandDecision | null {
  const dispatcher = new TroopDispatcher(nation, env, nationPolicy, seed);
  dispatcher.setCities(cities);
  dispatcher.setGenerals(generals);

  const result = dispatcher.doTroopRearDispatch(chiefTurnTime);
  if (!result) return null;

  return {
    command: result.command,
    args: result.args,
    weight: 60,
    reason: result.reason,
  };
}

/**
 * 부대 구출 발령 결정
 */
export function doTroopRescue(
  nation: any,
  env: any,
  nationPolicy: NationPolicyValues,
  cities: CityInfo[],
  generals: GeneralInfo[],
  seed?: number
): AICommandDecision | null {
  const dispatcher = new TroopDispatcher(nation, env, nationPolicy, seed);
  dispatcher.setCities(cities);
  dispatcher.setGenerals(generals);

  const result = dispatcher.doTroopRescue();
  if (!result) return null;

  return {
    command: result.command,
    args: result.args,
    weight: 90, // 구출은 높은 우선순위
    reason: result.reason,
  };
}

/**
 * 통합 부대 발령 결정
 */
export function decideDispatch(
  nation: any,
  env: any,
  nationPolicy: NationPolicyValues,
  cities: CityInfo[],
  generals: GeneralInfo[],
  warRoute: Record<number, Record<number, number>>,
  chiefTurnTime: number,
  seed?: number
): AICommandDecision | null {
  const dispatcher = new TroopDispatcher(nation, env, nationPolicy, seed);
  dispatcher.setCities(cities);
  dispatcher.setGenerals(generals);
  dispatcher.setWarRoute(warRoute);

  const result = dispatcher.decideDispatch(chiefTurnTime);
  if (!result) return null;

  // 발령 종류에 따라 가중치 조정
  let weight = 70;
  if (result.reason.includes('구출')) {
    weight = 90;
  } else if (result.reason.includes('전방')) {
    weight = 80;
  } else if (result.reason.includes('후방')) {
    weight = 60;
  }

  return {
    command: result.command,
    args: result.args,
    weight,
    reason: result.reason,
  };
}
