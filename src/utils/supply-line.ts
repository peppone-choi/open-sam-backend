/**
 * 보급선 확인 및 전방 설정
 * PHP: checkSupply, SetNationFront
 */

import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import { Diplomacy } from '../models/diplomacy.model';

/**
 * 보급선 확인
 * PHP: checkSupply
 * 수도에서 연결된 도시들을 보급 가능으로 설정
 */
export async function checkSupply(sessionId: string): Promise<void> {
  // 모든 국가별 도시 정보 수집
  const cities = await (City as any).find({ session_id: sessionId })
    .select('city nation')
    .lean();

  const cityMap: Record<number, { id: number; nation: number; supply: boolean }> = {};
  for (const city of cities) {
    if (city.nation === 0) {
      continue;
    }
    cityMap[city.city] = {
      id: city.city,
      nation: city.nation || 0,
      supply: false
    };
  }

  // 국가별 수도 조회
  const nations = await (Nation as any).find({ session_id: sessionId })
    .select('nation data')
    .lean();

  const capitals: Record<number, number> = {};
  for (const nation of nations) {
    const nationId = nation.nation || 0;
    if (nationId === 0) continue;
    const capital = nation.data?.capital || 0;
    if (capital && cityMap[capital] && cityMap[capital].nation === nationId) {
      capitals[nationId] = capital;
    }
  }

  // BFS로 보급선 계산
  const queue: Array<{ id: number; nation: number }> = [];
  for (const [nationId, capitalId] of Object.entries(capitals)) {
    const capital = cityMap[capitalId];
    if (capital) {
      capital.supply = true;
      queue.push({ id: capitalId, nation: parseInt(nationId) });
    }
  }

  // TODO: CityConst 경로 정보 필요
  // 현재는 기본 구현만 제공
  // 실제로는 CityConst의 path 정보를 사용하여 인접 도시 탐색
  
  // 보급 가능 도시 업데이트
  const supplyCities: number[] = [];
  for (const city of Object.values(cityMap)) {
    if (city.supply) {
      supplyCities.push(city.id);
    }
  }

  // 공백지 도시는 항상 보급 가능
  const neutralCities = await (City as any).find({ 
    session_id: sessionId, 
    nation: 0 
  }).select('city').lean();
  
  for (const city of neutralCities) {
    supplyCities.push(city.city);
  }

  // DB 업데이트
  if (supplyCities.length > 0) {
    await (City as any).updateMany(
      { session_id: sessionId, city: { $in: supplyCities } },
      { $set: { supply: 1 } }
    );
  }

  await (City as any).updateMany(
    { session_id: sessionId, nation: { $ne: 0 }, supply: { $ne: 1 } },
    { $set: { supply: 0 } }
  );
}

/**
 * 국가 전방 설정
 * PHP: SetNationFront
 * 외교 상태에 따라 도시의 전방 상태 설정
 */
export async function SetNationFront(sessionId: string, nationId: number): Promise<void> {
  if (!nationId) {
    return;
  }

  // 해당 국가의 도시들
  const nationCities = await (City as any).find({ 
    session_id: sessionId, 
    nation: nationId 
  }).select('city').lean();

  const cityIds = nationCities.map(c => c.city);

  if (cityIds.length === 0) {
    return;
  }

  // 외교 상태 확인
  const diplomaties = await (Diplomacy as any).find({
    session_id: sessionId,
    $or: [
      { me: nationId },
      { you: nationId }
    ]
  }).lean();

  // 적국 도시 (선전포고, 교전)
  const enemyCities: Set<number> = new Set();
  const warCities: Set<number> = new Set();

  for (const dip of diplomaties) {
    const otherNation = dip.me === nationId ? dip.you : dip.me;
    const state = dip.state || 0;
    
    if (state === 0) {
      // 선전포고
      const otherCities = await (City as any).find({
        session_id: sessionId,
        nation: otherNation
      }).select('city').lean();
      for (const city of otherCities) {
        enemyCities.add(city.city);
      }
    } else if (state === 1 && dip.term <= 5) {
      // 교전 중 (5턴 이내)
      const otherCities = await (City as any).find({
        session_id: sessionId,
        nation: otherNation
      }).select('city').lean();
      for (const city of otherCities) {
        warCities.add(city.city);
      }
    }
  }

  // 전방 레벨 계산
  // TODO: CityConst의 path 정보를 사용하여 인접 도시 계산
  // 현재는 기본 구조만 제공

  // 모든 도시를 기본 전방 레벨로 설정
  await (City as any).updateMany(
    { session_id: sessionId, city: { $in: cityIds } },
    { $set: { front: 0 } }
  );

  // 전방 레벨 1 (교전 중인 적국 인접)
  if (warCities.size > 0) {
    // TODO: 인접 도시 계산
    // await (City as any).updateMany(
    //   { session_id: sessionId, nation: nationId, city: { $in: adjacentCities } },
    //   { $set: { front: 1 } }
    // );
  }

  // 전방 레벨 2 (공백지 인접)
  const neutralCities = await (City as any).find({
    session_id: sessionId,
    nation: 0
  }).select('city').lean();
  
  if (neutralCities.length > 0 && warCities.size === 0 && enemyCities.size === 0) {
    // TODO: 인접 도시 계산
    // await (City as any).updateMany(
    //   { session_id: sessionId, nation: nationId, city: { $in: adjacentNeutralCities } },
    //   { $set: { front: 2 } }
    // );
  }

  // 전방 레벨 3 (선전포고한 적국 인접)
  if (enemyCities.size > 0) {
    // TODO: 인접 도시 계산
    // await (City as any).updateMany(
    //   { session_id: sessionId, nation: nationId, city: { $in: adjacentEnemyCities } },
    //   { $set: { front: 3 } }
    // );
  }
}

/**
 * 장수 수 업데이트
 * PHP: updateGeneralNumber
 */
export async function updateGeneralNumber(sessionId: string): Promise<void> {
  const General = require('../models/general.model').General;
  
  const generalCounts = await (General as any).aggregate([
    {
      $match: {
        session_id: sessionId,
        'data.npc': { $ne: 5 }
      }
    },
    {
      $group: {
        _id: '$data.nation',
        count: { $sum: 1 }
      }
    }
  ]);

  for (const count of generalCounts) {
    const nationId = count._id || 0;
    if (nationId === 0) continue;

    await (Nation as any).updateOne(
      { session_id: sessionId, nation: nationId },
      { $set: { 'data.gennum': count.count } }
    );
  }
}


