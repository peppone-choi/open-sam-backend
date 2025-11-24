/**
 * ConquerCity.ts - 도시 점령 처리 도메인 서비스
 *
 * PHP core/hwe/process_war.php::ConquerCity() 를 기반으로 한
 * TypeScript 버전. 이 모듈은 **전투 이후의 도시 점령 규칙**만을
 * 순서 있게 계산하고, 실제 DB 반영은 repository 레이어에 위임한다.
 *
 * 런타임 파이프라인과의 결합은 최소화하고, 테스트에서
 * 순수하게 호출할 수 있도록 설계한다.
 */

import { RandUtil } from '../utils/RandUtil';
import { LiteHashDRBG } from '../utils/LiteHashDRBG';
import { Util } from '../utils/Util';
import { JosaUtil } from '../utils/JosaUtil';
import { Json } from '../utils/Json';
import { GameBalance } from '../common/constants/game-balance';
import { GameConst } from '../const/GameConst';
import { UniqueConst } from '../const/UniqueConst';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { generalRepository } from '../repositories/general.repository';
import { searchDistanceAsync } from '../func/searchDistance';

export interface AdminEnv {
  startyear: number;
  year: number;
  month: number;
  join_mode: string;
}

export interface CitySnapshot {
  city: number;
  name: string;
  nation: number;
  level: number;
  agri: number;
  comm: number;
  secu: number;
  def: number;
  wall: number;
  def_max: number;
  wall_max: number;
  supply?: number;
  conflict?: string | Record<string, number>;
}

export interface GeneralLike {
  getID?: () => number;
  getNationID?: () => number;
  getName?: () => string;
  getSessionID?: () => string;
  getStaticNation?: () => { nation: number; name: string } | any;
  getLogger?: () => any;
  onArbitraryAction?: (
    self: any,
    rng: RandUtil,
    action: string,
    arg: unknown,
    extra: Record<string, unknown>,
  ) => void;
}

export interface ConquerCityResult {
  /** 최종 도시 소유 국가 ID (분쟁 포함) */
  conquerNationId: number;
  /** 공격자가 실제로 그 도시에 입성했는지 */
  attackerMoved: boolean;
  /** 수비국이 멸망했는지 여부 */
  nationDestroyed: boolean;
  /** 수도가 변경된 경우 새 수도 ID */
  newCapitalCityId?: number;
}

function buildRngForConquer(
  admin: AdminEnv,
  attackerNationID: number,
  attackerID: number,
  cityID: number,
): RandUtil {
  const seed = Util.simpleSerialize(
    UniqueConst.hiddenSeed,
    'ConquerCity',
    admin.year,
    admin.month,
    attackerNationID,
    attackerID,
    cityID,
  );
  return new RandUtil(new LiteHashDRBG(seed));
}

function decodeConflict(conflict: string | Record<string, number> | undefined):
  | Record<string, number>
  | null {
  if (!conflict) return null;
  if (typeof conflict === 'string') {
    if (!conflict.trim()) return null;
    try {
      const obj = Json.decode(conflict) as Record<string, number> | null;
      if (obj && typeof obj === 'object') return obj;
    } catch {
      return null;
    }
  }
  if (typeof conflict === 'object') {
    return conflict;
  }
  return null;
}

/**
 * PHP getConquerNation() 에 해당.
 * WarUnitCity::addConflict() 가 이미 dead 기준 내림차순으로
 * 정렬된 JSON 을 만들기 때문에, 첫 번째 key 가 곧 점령국이 된다.
 */
export function getConquerNation(city: Pick<CitySnapshot, 'conflict'>, fallbackNationId: number): number {
  const conflict = decodeConflict(city.conflict);
  if (!conflict) return fallbackNationId;

  const keys = Object.keys(conflict);
  if (keys.length === 0) return fallbackNationId;

  const nationId = parseInt(keys[0], 10);
  return Number.isNaN(nationId) ? fallbackNationId : nationId;
}

/**
 * PHP findNextCapital() 에 해당.
 *
 * - 기존 수도에서 BFS 거리 1 → 2 → ... 순으로 탐색
 * - 각 거리에서 해당 국가 도시 중 "인구(pop) 최대" 도시를 선택
 */
export async function findNextCapital(
  sessionId: string,
  currentCapitalID: number,
  nationID: number,
): Promise<number | null> {
  // 거리 맵: cityID -> distance
  const distanceMap = await searchDistanceAsync(sessionId, currentCapitalID, 99, false);
  const distanceEntries = Object.entries(distanceMap).map(([id, dist]) => [
    Number(id),
    dist as number,
  ]) as Array<[number, number]>;

  if (distanceEntries.length === 0) {
    return null;
  }

  // 수비국 도시 목록 (현재 수도 제외)
  const cities = await cityRepository.findByFilter({
    session_id: sessionId,
    nation: nationID,
  });

  const candidate: Record<number, number> = {};
  for (const raw of cities) {
    const cityId = raw.city ?? raw.data?.city;
    if (!cityId || cityId === currentCapitalID) continue;
    const pop = raw.pop ?? raw.data?.pop ?? 0;
    candidate[cityId] = pop;
  }

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  // 거리 → [cityId] 로 다시 그룹핑
  const byDist = new Map<number, number[]>();
  for (const [cityId, dist] of distanceEntries) {
    if (!(cityId in candidate)) continue;
    if (!byDist.has(dist)) byDist.set(dist, []);
    byDist.get(dist)!.push(cityId);
  }

  const dists = Array.from(byDist.keys()).sort((a, b) => a - b);
  for (const dist of dists) {
    const ids = byDist.get(dist)!;
    let bestId = 0;
    let bestPop = -1;
    for (const id of ids) {
      const pop = candidate[id];
      if (pop === undefined) continue;
      if (pop > bestPop) {
        bestPop = pop;
        bestId = id;
      }
    }
    if (bestId) {
      return bestId;
    }
  }

  return null;
}

/**
 * 도시 점령 메인 함수.
 *
 * - 전역 상태에 직접 쓰지 않고, repository 레이어를 통해서만
 *   실제 DB 를 갱신한다.
 * - 반환값은 테스트와 상위 파이프라인에서 후속 처리를
 *   결정하기 위한 최소 정보만 담는다.
 */
export async function ConquerCity(
  admin: AdminEnv,
  attackerGeneral: GeneralLike,
  city: CitySnapshot,
  defenderCityGenerals: GeneralLike[],
): Promise<ConquerCityResult> {
  const sessionId = attackerGeneral.getSessionID?.() || 'sangokushi_default';
  const attackerID = attackerGeneral.getID?.() ?? 0;
  const attackerNationID = attackerGeneral.getNationID?.() ?? 0;
  const attackerName = attackerGeneral.getName?.() ?? '공격자';
  const attackerNationStatic = attackerGeneral.getStaticNation?.() ?? {
    nation: attackerNationID,
    name: '공격국',
  };
  const attackerNationName: string = attackerNationStatic.name ?? '공격국';

  const cityID = city.city;
  const cityName = city.name;
  const defenderNationID = city.nation;

  const rng = buildRngForConquer(admin, attackerNationID, attackerID, cityID);
  const logger = attackerGeneral.getLogger?.();

  const josaUl = JosaUtil.pick(cityName, '을');
  const josaYiNation = JosaUtil.pick(attackerNationName, '이');
  const josaYiGen = JosaUtil.pick(attackerName, '이');
  const josaYiCity = JosaUtil.pick(cityName, '이');

  logger?.pushGeneralActionLog?.(
    `<G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`,
    1,
  );
  logger?.pushGeneralHistoryLog?.(
    `<G><b>${cityName}</b></>${josaUl} <S>점령</>`,
  );
  logger?.pushGlobalActionLog?.(
    `<Y>${attackerName}</>${josaYiGen} <G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`,
  );
  logger?.pushGlobalHistoryLog?.(
    `<S><b>【지배】</b></><D><b>${attackerNationName}</b></>${josaYiNation} <G><b>${cityName}</b></>${josaUl} 지배했습니다.`,
  );

  // 수비측 장수 임의 액션 트리거 (PHP onArbitraryAction 호환)
  for (const defender of defenderCityGenerals) {
    if (typeof defender.onArbitraryAction === 'function') {
      defender.onArbitraryAction(defender, rng, 'ConquerCity', null, {
        attacker: attackerGeneral,
      });
    }
  }

  // 멸망 여부 판단: "해당 국가 도시 수 == 1" 인 경우
  let nationDestroyed = false;
  let newCapitalCityId: number | undefined;

  if (defenderNationID) {
    const cityCount = await cityRepository.count({
      session_id: sessionId,
      nation: defenderNationID,
    });

    if (cityCount === 1) {
      nationDestroyed = true;
      // 세부 멸망 처리(장수 재야화, 국고 분배 등)는
      // BattleEventHook.onNationDestroyed 에서 담당.
    } else {
      // 수도가 함락되었으면 다음 수도를 찾고, 기본적인 천도 처리만 여기서 수행
      const defenderNationDoc = await nationRepository.findOneByFilter({
        session_id: sessionId,
        nation: defenderNationID,
      });

      const capitalCityId: number | undefined =
        defenderNationDoc?.capital ?? defenderNationDoc?.data?.capital;

      if (capitalCityId && capitalCityId === cityID) {
        const nextCapital = await findNextCapital(sessionId, cityID, defenderNationID);
        if (nextCapital) {
          newCapitalCityId = nextCapital;

          const nationName = defenderNationDoc?.name ?? defenderNationDoc?.data?.name ?? '수비국';
          const josaYi = JosaUtil.pick(nationName, '이');
          const nextCityName =
            (await cityRepository.findOneByFilter({ session_id: sessionId, city: nextCapital }))?.name ||
            '도시';
          const josaRo = JosaUtil.pick(nextCityName, '로');

          logger?.pushGlobalHistoryLog?.(
            `<M><b>【긴급천도】</b></><D><b>${nationName}</b></>${josaYi} 수도가 함락되어 <G><b>${nextCityName}</b></>${josaRo} 긴급천도하였습니다.`,
          );

          // 천도: 자원 50% 유지, 새 수도 보급 도시로 설정 (나머지 세부 처리는 이후 세션에서 확장)
          const gold: number = defenderNationDoc?.gold ?? defenderNationDoc?.data?.gold ?? 0;
          const rice: number = defenderNationDoc?.rice ?? defenderNationDoc?.data?.rice ?? 0;

          await nationRepository.updateByNationNum(sessionId, defenderNationID, {
            capital: nextCapital,
            gold: Math.floor(gold * 0.5),
            rice: Math.floor(rice * 0.5),
          });

          await cityRepository.updateByCityNum(sessionId, nextCapital, {
            supply: 1,
          });
        }
      }
    }
  }

  // 분쟁 결과에 따라 최종 점령 국가 결정
  const conquerNationId = getConquerNation(city, attackerNationID);

  // 도시 상태 업데이트 (PHP ConquerCity 의 마지막 부분과 동일한 규칙)
  const isBigCity = city.level > 3;
  let newDef: number;
  let newWall: number;

  if (isBigCity) {
    newDef = GameBalance.defaultCityWall;
    newWall = GameBalance.defaultCityWall;
  } else {
    newDef = Math.floor(city.def_max / 2);
    newWall = Math.floor(city.wall_max / 2);
  }

  await cityRepository.updateByCityNum(sessionId, cityID, {
    supply: 1,
    term: 0,
    conflict: '{}',
    agri: Math.floor(city.agri * 0.7),
    comm: Math.floor(city.comm * 0.7),
    secu: Math.floor(city.secu * 0.7),
    nation: conquerNationId,
    officer_set: 0,
    def: newDef,
    wall: newWall,
  });

  // 공격자 국가가 최종 점령국이라면 공격자 장수를 해당 도시로 이동
  let attackerMoved = false;
  if (conquerNationId === attackerNationID && attackerID) {
    await generalRepository.updateBySessionAndNo(sessionId, attackerID, {
      data: { city: cityID },
    });
    attackerMoved = true;
  }

  return {
    conquerNationId,
    attackerMoved,
    nationDestroyed,
    newCapitalCityId,
  };
}
