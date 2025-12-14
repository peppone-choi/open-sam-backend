/**
 * 삼국지13 아이템 데이터 로더 서비스
 * 
 * items-sam13.json 파일에서 명품(아이템) 데이터를 로드하고 관리합니다.
 * 이 데이터는 참조용으로, 실제 게임 아이템은 기존 시스템(allItems)과 통합되어야 합니다.
 */

import * as fs from 'fs';
import * as path from 'path';

// 아이템 인터페이스
export interface ISam13Item {
  id: string;
  name: string;
  nameKo?: string;
  category: string;
  effect?: string;
  skill?: string | null;
  value: number;
  price: number;
  
  // 능력치 보너스
  strengthBonus?: number;
  leadershipBonus?: number;
  intelBonus?: number;
  politicsBonus?: number;
  charmBonus?: number;
  lifespanBonus?: number;
  
  // 소유자/위치
  owner?: string;
  location?: string;
}

export interface ISam13ItemData {
  version: string;
  lastUpdated: string;
  categories: Record<string, string>;
  items: {
    horses: ISam13Item[];
    swords: ISam13Item[];
    blades: ISam13Item[];
    greatBlades: ISam13Item[];
    spears: ISam13Item[];
    halberds: ISam13Item[];
    axes: ISam13Item[];
    whips: ISam13Item[];
    clubs: ISam13Item[];
    hiddenWeapons: ISam13Item[];
    bows: ISam13Item[];
    militaryBooks: ISam13Item[];
    politicalBooks: ISam13Item[];
    historyBooks: ISam13Item[];
    classicBooks: ISam13Item[];
    essays: ISam13Item[];
    mysteryBooks: ISam13Item[];
    maps: ISam13Item[];
    medicalBooks: ISam13Item[];
    accessories: ISam13Item[];
    treasures: ISam13Item[];
    medicines: ISam13Item[];
    special: ISam13Item[];
  };
}

// 캐시된 데이터
let cachedItemData: ISam13ItemData | null = null;

/**
 * 삼국지13 아이템 데이터 로드
 */
export function loadSam13Items(): ISam13ItemData {
  if (cachedItemData) {
    return cachedItemData;
  }

  try {
    const itemsPath = path.join(__dirname, '../../../config/data/items-sam13.json');
    const data = fs.readFileSync(itemsPath, 'utf-8');
    cachedItemData = JSON.parse(data);
    return cachedItemData!;
  } catch (error) {
    console.error('Failed to load Sam13 items data:', error);
    throw error;
  }
}

/**
 * 모든 무기 아이템 조회
 */
export function getAllWeapons(): ISam13Item[] {
  const data = loadSam13Items();
  return [
    ...data.items.swords,
    ...data.items.blades,
    ...data.items.greatBlades,
    ...data.items.spears,
    ...data.items.halberds,
    ...data.items.axes,
    ...data.items.whips,
    ...data.items.clubs,
    ...data.items.hiddenWeapons,
    ...data.items.bows,
  ];
}

/**
 * 모든 서적 아이템 조회
 */
export function getAllBooks(): ISam13Item[] {
  const data = loadSam13Items();
  return [
    ...data.items.militaryBooks,
    ...data.items.politicalBooks,
    ...data.items.historyBooks,
    ...data.items.classicBooks,
    ...data.items.essays,
    ...data.items.mysteryBooks,
    ...data.items.maps,
    ...data.items.medicalBooks,
  ];
}

/**
 * 모든 명마 조회
 */
export function getAllHorses(): ISam13Item[] {
  const data = loadSam13Items();
  return data.items.horses;
}

/**
 * 모든 보물 조회
 */
export function getAllTreasures(): ISam13Item[] {
  const data = loadSam13Items();
  return [
    ...data.items.accessories,
    ...data.items.treasures,
    ...data.items.medicines,
    ...data.items.special,
  ];
}

/**
 * ID로 아이템 조회
 */
export function getItemById(itemId: string): ISam13Item | null {
  const data = loadSam13Items();
  
  for (const category of Object.values(data.items)) {
    const found = category.find(item => item.id === itemId);
    if (found) return found;
  }
  
  return null;
}

/**
 * 이름으로 아이템 조회
 */
export function getItemByName(name: string): ISam13Item | null {
  const data = loadSam13Items();
  
  for (const category of Object.values(data.items)) {
    const found = category.find(item => item.name === name || item.nameKo === name);
    if (found) return found;
  }
  
  return null;
}

/**
 * 카테고리별 아이템 조회
 */
export function getItemsByCategory(category: string): ISam13Item[] {
  const data = loadSam13Items();
  const categoryKey = category as keyof typeof data.items;
  
  if (data.items[categoryKey]) {
    return data.items[categoryKey];
  }
  
  return [];
}

/**
 * 특기를 부여하는 아이템 조회
 */
export function getItemsWithSkill(skillName: string): ISam13Item[] {
  const data = loadSam13Items();
  const results: ISam13Item[] = [];
  
  for (const category of Object.values(data.items)) {
    for (const item of category) {
      if (item.skill === skillName) {
        results.push(item);
      }
    }
  }
  
  return results;
}

/**
 * 능력치 보너스가 있는 아이템 조회
 */
export function getItemsWithStatBonus(statName: 'strength' | 'leadership' | 'intel' | 'politics' | 'charm' | 'lifespan'): ISam13Item[] {
  const data = loadSam13Items();
  const results: ISam13Item[] = [];
  
  const bonusKey = `${statName}Bonus` as keyof ISam13Item;
  
  for (const category of Object.values(data.items)) {
    for (const item of category) {
      const bonus = item[bonusKey];
      if (typeof bonus === 'number' && bonus > 0) {
        results.push(item);
      }
    }
  }
  
  // 보너스가 높은 순으로 정렬
  results.sort((a, b) => {
    const aBonus = (a[bonusKey] as number) || 0;
    const bBonus = (b[bonusKey] as number) || 0;
    return bBonus - aBonus;
  });
  
  return results;
}

/**
 * 가격 범위로 아이템 조회
 */
export function getItemsByPriceRange(minPrice: number, maxPrice: number): ISam13Item[] {
  const data = loadSam13Items();
  const results: ISam13Item[] = [];
  
  for (const category of Object.values(data.items)) {
    for (const item of category) {
      if (item.price >= minPrice && item.price <= maxPrice) {
        results.push(item);
      }
    }
  }
  
  // 가격순 정렬
  results.sort((a, b) => a.price - b.price);
  
  return results;
}

/**
 * 위치(도시)로 아이템 조회
 */
export function getItemsByLocation(locationName: string): ISam13Item[] {
  const data = loadSam13Items();
  const results: ISam13Item[] = [];
  
  for (const category of Object.values(data.items)) {
    for (const item of category) {
      if (item.location && item.location.includes(locationName)) {
        results.push(item);
      }
    }
  }
  
  return results;
}

/**
 * 소유자로 아이템 조회
 */
export function getItemsByOwner(ownerName: string): ISam13Item[] {
  const data = loadSam13Items();
  const results: ISam13Item[] = [];
  
  for (const category of Object.values(data.items)) {
    for (const item of category) {
      if (item.owner && item.owner.includes(ownerName)) {
        results.push(item);
      }
    }
  }
  
  return results;
}

/**
 * 아이템 카테고리 한글명 조회
 */
export function getCategoryName(categoryKey: string): string {
  const data = loadSam13Items();
  return data.categories[categoryKey] || categoryKey;
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCache(): void {
  cachedItemData = null;
}

// 기본 내보내기
export default {
  loadSam13Items,
  getAllWeapons,
  getAllBooks,
  getAllHorses,
  getAllTreasures,
  getItemById,
  getItemByName,
  getItemsByCategory,
  getItemsWithSkill,
  getItemsWithStatBonus,
  getItemsByPriceRange,
  getItemsByLocation,
  getItemsByOwner,
  getCategoryName,
  clearCache,
};




