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

  // 시나리오 데이터에서 도시 경로 정보 로드
  const { Session } = await import('../models/session.model');
  const session = await (Session as any).findOne({ session_id: sessionId }).lean();
  const scenarioId = session?.scenario_id || 'sangokushi';
  
  // City neighbors 정보 로드 (시나리오 데이터에서)
  let cityNeighborsMap: Record<number, number[]> = {};
  try {
    const fs = require('fs');
    const path = require('path');
    const citiesJsonPath = path.join(
      __dirname,
      '../../config/scenarios',
      scenarioId,
      'data/cities.json'
    );
    
    if (fs.existsSync(citiesJsonPath)) {
      const citiesData = JSON.parse(fs.readFileSync(citiesJsonPath, 'utf-8'));
      if (citiesData.cities && Array.isArray(citiesData.cities)) {
        for (const cityData of citiesData.cities) {
          if (cityData.id && cityData.neighbors && Array.isArray(cityData.neighbors)) {
            cityNeighborsMap[cityData.id] = cityData.neighbors;
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Failed to load city neighbors from scenario data:', error);
    // 경로 정보를 로드할 수 없으면 DB의 neighbors 필드 사용
    const citiesWithNeighbors = await (City as any).find({ 
      session_id: sessionId 
    }).select('city neighbors data.neighbors').lean();
    
    for (const city of citiesWithNeighbors) {
      const neighbors = city.neighbors || city.data?.neighbors || [];
      if (Array.isArray(neighbors) && neighbors.length > 0) {
        cityNeighborsMap[city.city] = neighbors.map((n: any) => 
          typeof n === 'number' ? n : (typeof n === 'string' ? parseInt(n) : 0)
        ).filter((n: number) => n > 0);
      }
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

  // BFS로 인접 도시 탐색
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = cityNeighborsMap[current.id] || [];
    
    for (const neighborId of neighbors) {
      const neighbor = cityMap[neighborId];
      if (neighbor && !neighbor.supply && neighbor.nation === current.nation) {
        neighbor.supply = true;
        queue.push({ id: neighborId, nation: current.nation });
      }
    }
  }
  
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

  // 시나리오 데이터에서 도시 경로 정보 로드
  const { Session } = await import('../models/session.model');
  const session = await (Session as any).findOne({ session_id: sessionId }).lean();
  const scenarioId = session?.scenario_id || 'sangokushi';
  
  // City neighbors 정보 로드
  let cityNeighborsMap: Record<number, number[]> = {};
  try {
    const fs = require('fs');
    const path = require('path');
    const citiesJsonPath = path.join(
      __dirname,
      '../../config/scenarios',
      scenarioId,
      'data/cities.json'
    );
    
    if (fs.existsSync(citiesJsonPath)) {
      const citiesData = JSON.parse(fs.readFileSync(citiesJsonPath, 'utf-8'));
      if (citiesData.cities && Array.isArray(citiesData.cities)) {
        for (const cityData of citiesData.cities) {
          if (cityData.id && cityData.neighbors && Array.isArray(cityData.neighbors)) {
            cityNeighborsMap[cityData.id] = cityData.neighbors;
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Failed to load city neighbors from scenario data:', error);
    // 경로 정보를 로드할 수 없으면 DB의 neighbors 필드 사용
    const citiesWithNeighbors = await (City as any).find({ 
      session_id: sessionId 
    }).select('city neighbors data.neighbors').lean();
    
    for (const city of citiesWithNeighbors) {
      const neighbors = city.neighbors || city.data?.neighbors || [];
      if (Array.isArray(neighbors) && neighbors.length > 0) {
        cityNeighborsMap[city.city] = neighbors.map((n: any) => 
          typeof n === 'number' ? n : (typeof n === 'string' ? parseInt(n) : 0)
        ).filter((n: number) => n > 0);
      }
    }
  }

  // 모든 도시를 기본 전방 레벨로 설정
  await (City as any).updateMany(
    { session_id: sessionId, city: { $in: cityIds } },
    { $set: { front: 0 } }
  );

  // 인접 도시 계산 헬퍼 함수
  const getAdjacentCities = (cityIds: number[], targetCities: Set<number>): number[] => {
    const adjacentCities: number[] = [];
    for (const cityId of cityIds) {
      const neighbors = cityNeighborsMap[cityId] || [];
      for (const neighborId of neighbors) {
        if (targetCities.has(neighborId)) {
          adjacentCities.push(cityId);
          break; // 한 번만 추가
        }
      }
    }
    return adjacentCities;
  };

  // 전방 레벨 1 (교전 중인 적국 인접)
  if (warCities.size > 0) {
    const adjacentWarCities = getAdjacentCities(cityIds, warCities);
    if (adjacentWarCities.length > 0) {
      await (City as any).updateMany(
        { session_id: sessionId, city: { $in: adjacentWarCities } },
        { $set: { front: 1 } }
      );
    }
  }

  // 전방 레벨 2 (공백지 인접)
  const neutralCities = await (City as any).find({
    session_id: sessionId,
    nation: 0
  }).select('city').lean();
  
  const neutralCitySet = new Set(neutralCities.map((c: any) => c.city));
  
  if (neutralCitySet.size > 0 && warCities.size === 0 && enemyCities.size === 0) {
    const adjacentNeutralCities = getAdjacentCities(cityIds, neutralCitySet);
    if (adjacentNeutralCities.length > 0) {
      await (City as any).updateMany(
        { session_id: sessionId, city: { $in: adjacentNeutralCities } },
        { $set: { front: 2 } }
      );
    }
  }

  // 전방 레벨 3 (선전포고한 적국 인접)
  if (enemyCities.size > 0) {
    const adjacentEnemyCities = getAdjacentCities(cityIds, enemyCities);
    if (adjacentEnemyCities.length > 0) {
      await (City as any).updateMany(
        { session_id: sessionId, city: { $in: adjacentEnemyCities } },
        { $set: { front: 3 } }
      );
    }
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




