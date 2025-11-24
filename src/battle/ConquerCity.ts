/**
 * ConquerCity.ts - 도시 점령 처리
 * PHP ConquerCity() 직접 변환
 * 
 * 참고: core/hwe/process_war.php ConquerCity()
 */

import { RandUtil } from '../utils/RandUtil';
import { LiteHashDRBG } from '../utils/LiteHashDRBG';
import { Util } from '../utils/Util';
import { JosaUtil } from '../utils/JosaUtil';
import { GameConst } from '../constants/GameConst';
import { cityRepository } from '../repositories/city.repository';
import { generalRepository } from '../repositories/general.repository';
import { nationRepository } from '../repositories/nation.repository';

interface AdminEnv {
  startyear: number;
  year: number;
  month: number;
  join_mode?: string;
}

interface CityData {
  city: number;
  name: string;
  nation: number;
  level: number;
  agri?: number;
  comm?: number;
  secu?: number;
  def?: number;
  wall?: number;
  def_max?: number;
  wall_max?: number;
  supply?: number;
  pop?: number;
  pop_max?: number;
  trust?: number;
  conflict?: any;
}

interface GeneralData {
  no?: number;
  getID?: () => number;
  getNationID?: () => number;
  getName?: () => string;
  getLogger?: () => any;
  getStaticNation?: () => any;
  getSessionID?: () => string;
  applyDB?: (db: any) => Promise<void>;
  save?: () => Promise<void>;
  onArbitraryAction?: (general: any, rng: RandUtil, action: string, arg: any, extra: any) => void;
  data?: any;
}

interface NationData {
  nation: number;
  name: string;
  capital?: number;
  gold?: number;
  rice?: number;
  level?: number;
  type?: string;
  tech?: number;
  gennum?: number;
}

/**
 * getConquerNation - 점령할 국가 결정 (분쟁 해결)
 * 
 * @param city - 도시 정보
 * @returns 점령할 국가 ID
 */
export function getConquerNation(city: CityData): number {
  const conflict = city.conflict || {};
  
  // 분쟁이 있으면 가장 높은 포인트를 가진 국가
  if (typeof conflict === 'object' && Object.keys(conflict).length > 0) {
    let maxNation = 0;
    let maxPoint = 0;
    
    for (const [nationIdStr, point] of Object.entries(conflict)) {
      const nationId = parseInt(nationIdStr, 10);
      const pointNum = typeof point === 'number' ? point : 0;
      
      if (pointNum > maxPoint) {
        maxPoint = pointNum;
        maxNation = nationId;
      }
    }
    
    return maxNation;
  }
  
  return 0;
}

/**
 * findNextCapital - 다음 수도 찾기
 * 
 * @param sessionId - 세션 ID
 * @param capitalID - 현재 수도 ID
 * @param nationID - 국가 ID
 * @returns 다음 수도 ID
 */
export async function findNextCapital(
  sessionId: string,
  capitalID: number,
  nationID: number
): Promise<number> {
  // 간단한 구현: 같은 국가의 첫 번째 도시를 찾음
  // TODO: 거리 기반 검색 구현 (searchDistance)
  const cities = await cityRepository.findByFilter({
    session_id: sessionId,
    'data.nation': nationID,
    'data.city': { $ne: capitalID }
  });
  
  if (cities.length === 0) {
    return 0;
  }
  
  // 인구가 가장 많은 도시 선택
  cities.sort((a, b) => (b.data?.pop || 0) - (a.data?.pop || 0));
  
  return cities[0].data?.city || 0;
}

/**
 * deleteNation - 국가 멸망 처리
 * 
 * @param sessionId - 세션 ID
 * @param admin - 관리 정보
 * @param defenderNationID - 멸망할 국가 ID
 * @param attackerNationID - 공격 국가 ID
 * @param attackerGeneralID - 공격 장수 ID
 * @param rng - 난수 생성기
 * @returns 멸망한 국가의 장수 목록
 */
async function deleteNation(
  sessionId: string,
  admin: AdminEnv,
  defenderNationID: number,
  attackerNationID: number,
  attackerGeneralID: number,
  rng: RandUtil
): Promise<GeneralData[]> {
  const { year, month } = admin;
  
  // 멸망 국가의 모든 장수 조회
  const nationGenerals = await generalRepository.findByFilter({
    session_id: sessionId,
    'data.nation': defenderNationID
  });
  
  const oldNationGenerals: GeneralData[] = [];
  
  for (const general of nationGenerals) {
    // 장수를 재야로
    const oldGold = general.data?.gold || 0;
    const oldRice = general.data?.rice || 0;
    const oldExp = general.data?.experience || 0;
    const oldDed = general.data?.dedication || 0;
    
    // 도주 시 금/쌀 손실
    const loseGold = Math.floor(oldGold * rng.nextRange(0.2, 0.5));
    const loseRice = Math.floor(oldRice * rng.nextRange(0.2, 0.5));
    
    // 경험치/공헌도 감소
    const loseExp = Math.floor(oldExp * 0.1);
    const loseDed = Math.floor(oldDed * 0.5);
    
    await generalRepository.updateById(general._id, {
      'data.nation': 0,
      'data.officer_level': 1,
      'data.officer_city': 0,
      'data.gold': Math.max(0, oldGold - loseGold),
      'data.rice': Math.max(0, oldRice - loseRice),
      'data.experience': Math.max(0, oldExp - loseExp),
      'data.dedication': Math.max(0, oldDed - loseDed)
    });
    
    oldNationGenerals.push({
      ...general,
      data: {
        ...general.data,
        loseGold,
        loseRice,
        loseExp,
        loseDed
      }
    });
  }
  
  // 국가 삭제
  await nationRepository.deleteByNationNum(sessionId, defenderNationID);
  
  return oldNationGenerals;
}

/**
 * ConquerCity - 도시 점령 처리
 * 
 * @param admin - 관리 정보
 * @param general - 공격 장수
 * @param city - 점령할 도시
 * @param defenderCityGeneralList - 수비 장수 목록
 */
export async function ConquerCity(
  admin: AdminEnv,
  general: GeneralData,
  city: CityData,
  defenderCityGeneralList: GeneralData[]
): Promise<void> {
  const { year, month, join_mode } = admin;
  
  // 세션 ID 가져오기
  const sessionId = general.getSessionID?.() || 'sangokushi_default';
  
  // 공격자 정보
  const attackerID = general.getID?.() || general.no || general.data?.no || 0;
  const attackerNationID = general.getNationID?.() || general.data?.nation || 0;
  const attackerGeneralName = general.getName?.() || general.data?.name || '공격자';
  const attackerNation = general.getStaticNation?.() || { name: '공격국' };
  const attackerNationName = attackerNation.name;
  const attackerLogger = general.getLogger?.();
  
  // 도시 정보
  const cityID = city.city;
  const cityName = city.name;
  
  // 수비자 정보
  const defenderNationID = city.nation;
  
  // 랜덤 생성기 (재현 가능하도록 시드 설정)
  const rng = new RandUtil(new LiteHashDRBG(
    Util.simpleSerialize(
      'ConquerCity',
      year,
      month,
      attackerNationID,
      attackerID,
      cityID
    )
  ));
  
  // 수비자 국가 정보 가져오기
  let defenderNation: NationData | null = null;
  let defenderNationName = '재야';
  
  if (defenderNationID !== 0) {
    try {
      const nationDoc = await nationRepository.findByNationNum(sessionId, defenderNationID);
      if (nationDoc) {
        defenderNation = nationDoc.data as NationData;
        defenderNationName = defenderNation.name;
      }
    } catch (error) {
      console.error('Failed to load defender nation:', error);
    }
  }
  
  // 로그 기록
  const josaUl = JosaUtil.pick(cityName, '을');
  const josaYiGen = JosaUtil.pick(attackerGeneralName, '이');
  const josaYiCity = JosaUtil.pick(cityName, '이');
  const josaYiNation = JosaUtil.pick(attackerNationName, '이');
  
  attackerLogger?.pushGeneralActionLog?.(
    `<G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`,
    1
  );
  attackerLogger?.pushGeneralHistoryLog?.(
    `<G><b>${cityName}</b></>${josaUl} <S>점령</>`
  );
  attackerLogger?.pushGlobalActionLog?.(
    `<Y>${attackerGeneralName}</>${josaYiGen} <G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`
  );
  attackerLogger?.pushGlobalHistoryLog?.(
    `<S><b>【지배】</b></><D><b>${attackerNationName}</b></>${josaYiNation} <G><b>${cityName}</b></>${josaUl} 지배했습니다.`
  );
  attackerLogger?.pushNationalHistoryLog?.(
    `<Y>${attackerGeneralName}</>${josaYiGen} <G><b>${cityName}</b></>${josaUl} <S>점령</>`
  );
  
  // 수비자에게 이벤트 호출
  for (const defenderGeneral of defenderCityGeneralList) {
    if (typeof defenderGeneral.onArbitraryAction === 'function') {
      defenderGeneral.onArbitraryAction(
        defenderGeneral,
        rng,
        'ConquerCity',
        null,
        { attacker: general }
      );
    }
  }
  
  // 국가 멸망 체크
  const remainingCities = await cityRepository.findByFilter({
    session_id: sessionId,
    'data.nation': defenderNationID
  });
  
  if (defenderNationID !== 0 && remainingCities.length === 1) {
    // 국가 멸망 처리
    console.log(`[ConquerCity] 국가 멸망: ${defenderNationName}`);
    
    const oldNationGenerals = await deleteNation(
      sessionId,
      admin,
      defenderNationID,
      attackerNationID,
      attackerID,
      rng
    );
    
    // 승전국 보상 (금/쌀 흡수)
    let loseGeneralGold = 0;
    let loseGeneralRice = 0;
    
    for (const oldGeneral of oldNationGenerals) {
      loseGeneralGold += oldGeneral.data?.loseGold || 0;
      loseGeneralRice += oldGeneral.data?.loseRice || 0;
    }
    
    const loseNationGold = Math.max(0, (defenderNation?.gold || 0) - GameConst.defaultGold);
    const loseNationRice = Math.max(0, (defenderNation?.rice || 0) - GameConst.defaultRice);
    
    const totalGold = Math.floor((loseNationGold + loseGeneralGold) / 2);
    const totalRice = Math.floor((loseNationRice + loseGeneralRice) / 2);
    
    // 공격국에 자원 추가
    await nationRepository.updateByNationNum(sessionId, attackerNationID, {
      gold: { $inc: totalGold },
      rice: { $inc: totalRice }
    });
    
    const josaUl2 = JosaUtil.pick(defenderNationName, '을');
    attackerLogger?.pushNationalHistoryLog?.(
      `<D><b>${defenderNationName}</b></>${josaUl2} 정복`
    );
    
  } else if (defenderNationID !== 0) {
    // 국가 멸망이 아닌 경우
    
    // 태수/군사/종사는 일반으로
    await generalRepository.updateByFilter(
      {
        session_id: sessionId,
        'data.officer_city': cityID
      },
      {
        'data.officer_level': 1,
        'data.officer_city': 0
      }
    );
    
    // 수도 함락 체크
    if (defenderNation && defenderNation.capital === cityID) {
      // 긴급 천도
      const nextCapitalID = await findNextCapital(sessionId, cityID, defenderNationID);
      
      if (nextCapitalID > 0) {
        // 천도 처리
        await nationRepository.updateByNationNum(sessionId, defenderNationID, {
          capital: nextCapitalID,
          gold: { $mul: 0.5 },
          rice: { $mul: 0.5 }
        });
        
        // 보급 도시로 설정
        await cityRepository.updateByCityNum(sessionId, nextCapitalID, {
          supply: 1
        });
        
        // 수뇌부 이동
        await generalRepository.updateByFilter(
          {
            session_id: sessionId,
            'data.nation': defenderNationID,
            'data.officer_level': { $gte: 5 }
          },
          {
            'data.city': nextCapitalID
          }
        );
        
        // 장수 사기 감소
        await generalRepository.updateByFilter(
          {
            session_id: sessionId,
            'data.nation': defenderNationID
          },
          {
            'data.atmos': { $mul: 0.8 }
          }
        );
      }
    }
  }
  
  // 점령 국가 결정 (분쟁 해결)
  const conquerNation = getConquerNation(city);
  
  // 도시 소유권 변경
  const updateQuery: any = {
    supply: 1,
    term: 0,
    conflict: {},
    agri: { $mul: 0.7 },
    comm: { $mul: 0.7 },
    secu: { $mul: 0.7 },
    nation: conquerNation === 0 ? attackerNationID : conquerNation,
    officer_set: 0
  };
  
  // 성벽 복구
  if (city.level && city.level > 3) {
    updateQuery.def = GameConst.defaultCityWall || 10000;
    updateQuery.wall = GameConst.defaultCityWall || 10000;
  } else {
    // 중형 도시 이하는 절반 복구
    updateQuery.def = Math.floor((city.def_max || 10000) / 2);
    updateQuery.wall = Math.floor((city.wall_max || 10000) / 2);
  }
  
  await cityRepository.updateByCityNum(sessionId, cityID, updateQuery);
  
  // 분쟁 협상 처리
  if (conquerNation !== attackerNationID) {
    const josaUl3 = JosaUtil.pick(cityName, '을');
    const josaYi2 = JosaUtil.pick(attackerNationName, '이');
    
    try {
      const conquerNationDoc = await nationRepository.findByNationNum(sessionId, conquerNation);
      const conquerNationName = conquerNationDoc?.data?.name || '국가';
      const josaYi3 = JosaUtil.pick(conquerNationName, '이');
      
      attackerLogger?.pushGlobalHistoryLog?.(
        `<Y><b>【분쟁협상】</b></><D><b>${conquerNationName}</b></>${josaYi3} 영토분쟁에서 우위를 점하여 <G><b>${cityName}</b></>${josaUl3} 양도받았습니다.`
      );
      attackerLogger?.pushNationalHistoryLog?.(
        `<G><b>${cityName}</b></>${josaUl3} <D><b>${conquerNationName}</b></>에 <Y>양도</>`
      );
    } catch (error) {
      console.error('Failed to log conflict resolution:', error);
    }
  } else {
    // 공격자 장수를 도시로 이동
    await generalRepository.updateById(attackerID, {
      'data.city': cityID
    });
  }
  
  // 전방 설정 업데이트
  // TODO: SetNationFront 구현
  
  console.log(`[ConquerCity] ${cityName} 점령 완료 - 새 소유: 국가 ${conquerNation === 0 ? attackerNationID : conquerNation}`);
}
