// @ts-nocheck - Type issues need investigation
/**
 * 보급선 확인 및 전방 설정
 * PHP: checkSupply, SetNationFront
 */

import { Diplomacy } from '../models/diplomacy.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';

function toPlain<T>(doc: T | null | undefined): any | null {
  if (!doc) return null;
  return typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : doc;
}

/**
 * 보급선 확인
 * PHP: checkSupply
 * 수도에서 연결된 도시들을 보급 가능으로 설정
 */
export async function checkSupply(sessionId: string): Promise<void> {
  const rawCities = (await cityRepository.findBySession(sessionId)) || [];
  const cities = rawCities.map(toPlain).filter(Boolean) as any[];

  const cityMap: Record<number, { id: number; nation: number; supply: boolean }> = {};
  cities.forEach((city) => {
    const cityNation = city.nation ?? city.data?.nation ?? 0;
    if (cityNation === 0) {
      return;
    }
    cityMap[city.city] = {
      id: city.city,
      nation: cityNation,
      supply: false
    };
  });

  const rawNations = (await nationRepository.findBySession(sessionId)) || [];
  const nations = rawNations.map(toPlain).filter(Boolean) as any[];

  const capitals: Record<number, number> = {};
  const nationCityCount: Record<number, number> = {};
  
  Object.values(cityMap).forEach((city) => {
    nationCityCount[city.nation] = (nationCityCount[city.nation] || 0) + 1;
  });

  for (const nation of nations) {
    const nationId = nation.nation || 0;
    if (nationId === 0) continue;
    
    const capital = nation.capital || nation.data?.capital || 0;
    if (capital && cityMap[capital] && cityMap[capital].nation === nationId) {
      capitals[nationId] = capital;
    } else if (nationCityCount[nationId] === 1) {
      // 도시가 1개인 국가는 그 도시를 수도로 설정
      for (const city of Object.values(cityMap)) {
        if (city.nation === nationId) {
          capitals[nationId] = city.id;
          break;
        }
      }
    }
  }

  // 시나리오 데이터에서 도시 경로 정보 로드
  const { Session } = await import('../models/session.model');
  const session = await Session.findOne({ session_id: sessionId }).lean();
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
        console.log(`[checkSupply] Loaded ${Object.keys(cityNeighborsMap).length} cities with neighbors from ${citiesJsonPath}`);
      }
    } else {
      console.warn(`[checkSupply] Cities JSON not found: ${citiesJsonPath}`);
    }
  } catch (error: any) {
    console.error('Failed to load city neighbors from scenario data:', error);
    // 경로 정보를 로드할 수 없으면 DB의 neighbors 필드 사용
    const citiesWithNeighbors = cities;
    
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
      console.log(`[checkSupply] Nation ${nationId}: Capital ${capitalId} set as supply source`);
    } else {
      console.warn(`[checkSupply] Nation ${nationId}: Capital ${capitalId} not found in cityMap`);
    }
  }

  // BFS로 인접 도시 탐색
  let suppliedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = cityNeighborsMap[current.id] || [];
    
    if (neighbors.length === 0) {
      console.warn(`[checkSupply] City ${current.id} has no neighbors!`);
    }
    
    for (const neighborId of neighbors) {
      const neighbor = cityMap[neighborId];
      if (neighbor && !neighbor.supply && neighbor.nation === current.nation) {
        neighbor.supply = true;
        queue.push({ id: neighborId, nation: current.nation });
        suppliedCount++;
      }
    }
  }
  console.log(`[checkSupply] BFS completed. Supplied ${suppliedCount} cities via BFS`);
  
  // 보급 가능 도시 업데이트
  const supplyCities: number[] = [];
  for (const city of Object.values(cityMap)) {
    if (city.supply) {
      supplyCities.push(city.id);
    }
  }

  const neutralCities = cities
    .filter((city) => (city.nation ?? city.data?.nation ?? 0) === 0)
    .map((city) => city.city);
  supplyCities.push(...neutralCities);

  // DB 업데이트 (올바른 순서로)
  // 1. 먼저 모든 국가 도시를 보급 끊김으로 설정
  const resetResult = await City.updateMany(
    { session_id: sessionId, nation: { $ne: 0 } },
    { $set: { supply: 0 } }
  );
  console.log(`[checkSupply] Reset ${resetResult.modifiedCount} cities to supply=0`);

  // 2. 보급이 연결된 도시(수도에서 연결된 도시 + 공백지)만 supply = 1로 설정
  if (supplyCities.length > 0) {
    const updateResult = await City.updateMany(
      { session_id: sessionId, city: { $in: supplyCities } },
      { $set: { supply: 1 } }
    );
    console.log(`[checkSupply] Set ${updateResult.modifiedCount}/${supplyCities.length} cities to supply=1`, supplyCities);
  } else {
    console.warn(`[checkSupply] No cities with supply! All cities disconnected?`);
  }
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

  const rawCities = (await cityRepository.findBySession(sessionId)) || [];
  const sessionCities = rawCities.map(toPlain).filter(Boolean) as any[];
  const cityByNation = new Map<number, number[]>();
  sessionCities.forEach((city: any) => {
    const cityNation = city.nation ?? city.data?.nation ?? 0;
    if (!cityByNation.has(cityNation)) {
      cityByNation.set(cityNation, []);
    }
    cityByNation.get(cityNation)!.push(city.city);
  });

  const cityIds = cityByNation.get(nationId) || [];

  if (cityIds.length === 0) {
    return;
  }

  // 외교 상태 확인
  const diplomaties = await Diplomacy.find({
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
      const otherCities = cityByNation.get(otherNation) || [];
      otherCities.forEach((cityId) => enemyCities.add(cityId));
    } else if (state === 1 && dip.term <= 5) {
      const otherCities = cityByNation.get(otherNation) || [];
      otherCities.forEach((cityId) => warCities.add(cityId));
    }
  }

  // 시나리오 데이터에서 도시 경로 정보 로드
  const { Session } = await import('../models/session.model');
  const session = await Session.findOne({ session_id: sessionId }).lean();
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
    const citiesWithNeighbors = sessionCities;
    
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
  await City.updateMany(
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
      await City.updateMany(
        { session_id: sessionId, city: { $in: adjacentWarCities } },
        { $set: { front: 1 } }
      );
    }
  }

  // 전방 레벨 2 (공백지 인접)
  const neutralCitySet = new Set((cityByNation.get(0) || []));
  
  if (neutralCitySet.size > 0 && warCities.size === 0 && enemyCities.size === 0) {
    const adjacentNeutralCities = getAdjacentCities(cityIds, neutralCitySet as Set<number>);
    if (adjacentNeutralCities.length > 0) {
      await City.updateMany(
        { session_id: sessionId, city: { $in: adjacentNeutralCities } },
        { $set: { front: 2 } }
      );
    }
  }

  // 전방 레벨 3 (선전포고한 적국 인접)
  if (enemyCities.size > 0) {
    const adjacentEnemyCities = getAdjacentCities(cityIds, enemyCities);
    if (adjacentEnemyCities.length > 0) {
      await City.updateMany(
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
  
  const generalCounts = await General.aggregate([
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

    await Nation.updateOne(
      { session_id: sessionId, nation: nationId },
      { $set: { 'data.gennum': count.count } }
    );
  }
}




