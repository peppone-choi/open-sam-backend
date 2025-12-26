/**
 * 아이템 레지스트리
 * PHP 대응: func_converter.php buildGeneralItemClass()
 */

import { BaseItem } from './BaseItem';

// 무기, 명마, 서적, 인장, 장신구 아이템
import { WEAPONS } from './impl/weapons';
import { HORSES } from './impl/horses';
import { BOOKS } from './impl/books';
import { SEALS } from './impl/seals';
import { ACCESSORIES } from './impl/accessories';

// 특수 아이템
import {
  CheGyeryakSamryakItem,
  CheGyeryakYukdoItem,
  CheGyeryakIchuItem,
  CheGyeryakHyangnangItem,
  CheBangyeBaekuseonItem,
  CheBangyePachoseonItem,
  CheUisulSanghanItem,
  CheUisulCheongnangseoItem,
  CheUisulTaepyeongItem,
  CheTiryoJeongryeokItem,
  CheTiryoDosoItem,
  CheJeogyeokMaehwaItem,
  CheJeogyeokBidoItem,
  CheJeogyeokSugeukItem,
  CheSagiDugangItem,
  CheSagiBoryeongItem,
  CheSagiTakjuItem,
  CheSagiUijeokItem,
  CheHunryeonCheolbyeokItem,
  CheHunryeonCheongjuItem,
} from './impl/special';

/** None 아이템 (빈 슬롯) */
class NoneItem extends BaseItem {
  get id(): string { return 'None'; }
  constructor() {
    super();
    this.rawName = '-';
    this.name = '-';
    this.info = '아이템 없음';
  }
}

// 레지스트리: 아이템 ID → 팩토리 함수
const registry: Record<string, () => BaseItem> = {
  None: () => new NoneItem(),
};

// 무기 아이템 등록
for (const [id, item] of Object.entries(WEAPONS)) {
  registry[id] = () => item;
}

// 명마 아이템 등록
for (const [id, item] of Object.entries(HORSES)) {
  registry[id] = () => item;
}

// 서적 아이템 등록
for (const [id, item] of Object.entries(BOOKS)) {
  registry[id] = () => item;
}

// 인장 아이템 등록
for (const [id, item] of Object.entries(SEALS)) {
  registry[id] = () => item;
}

// 장신구 아이템 등록
for (const [id, item] of Object.entries(ACCESSORIES)) {
  registry[id] = () => item;
}

// 특수 아이템 등록
const specialItems: Array<new () => BaseItem> = [
  CheGyeryakSamryakItem,
  CheGyeryakYukdoItem,
  CheGyeryakIchuItem,
  CheGyeryakHyangnangItem,
  CheBangyeBaekuseonItem,
  CheBangyePachoseonItem,
  CheUisulSanghanItem,
  CheUisulCheongnangseoItem,
  CheUisulTaepyeongItem,
  CheTiryoJeongryeokItem,
  CheTiryoDosoItem,
  CheJeogyeokMaehwaItem,
  CheJeogyeokBidoItem,
  CheJeogyeokSugeukItem,
  CheSagiDugangItem,
  CheSagiBoryeongItem,
  CheSagiTakjuItem,
  CheSagiUijeokItem,
  CheHunryeonCheolbyeokItem,
  CheHunryeonCheongjuItem,
];

for (const ItemClass of specialItems) {
  const instance = new ItemClass();
  registry[instance.id] = () => new ItemClass();
}

// 캐시
const cache = new Map<string, BaseItem>();

/**
 * 아이템 Action 조회
 * @param key 아이템 키 (예: 'che_무기_15_의천검', 'None')
 * @returns BaseItem 인스턴스
 */
export function getActionItemAction(key?: string | null): BaseItem {
  const normalized = key && registry[key] ? key : 'None';
  if (!cache.has(normalized)) {
    cache.set(normalized, registry[normalized]());
  }
  return cache.get(normalized)!;
}

/**
 * 등록된 모든 아이템 목록 조회
 */
export function getAvailableActionItems(): string[] {
  return Object.keys(registry).filter(k => k !== 'None');
}

/**
 * 아이템 이름으로 ID 조회
 */
export function getActionItemIdByName(name: string): string | null {
  for (const [id, factory] of Object.entries(registry)) {
    const instance = factory();
    if (instance.getName() === name || instance.getRawName() === name) {
      return id;
    }
  }
  return null;
}

/**
 * 구매 가능한 아이템 목록 조회
 */
export function getBuyableActionItems(): BaseItem[] {
  return Object.values(registry)
    .map(factory => factory())
    .filter(item => item.isBuyable());
}

/**
 * 카테고리별 아이템 조회
 */
export function getActionItemsByCategory(category: 'weapon' | 'horse' | 'book' | 'seal' | 'accessory' | 'special'): BaseItem[] {
  const prefix = {
    weapon: 'che_무기_',
    horse: 'che_명마_',
    book: 'che_서적_',
    seal: 'che_인장_',
    accessory: 'che_장신구_',
    special: '', // 특수 아이템은 다양한 prefix
  }[category];

  if (category === 'special') {
    // 스탯 아이템이 아닌 모든 아이템
    return Object.entries(registry)
      .filter(([id]) =>
        id !== 'None' &&
        !id.startsWith('che_무기_') &&
        !id.startsWith('che_명마_') &&
        !id.startsWith('che_서적_') &&
        !id.startsWith('che_인장_') &&
        !id.startsWith('che_장신구_')
      )
      .map(([, factory]) => factory());
  }

  return Object.entries(registry)
    .filter(([id]) => id.startsWith(prefix))
    .map(([, factory]) => factory());
}

/**
 * 스탯 타입별 아이템 조회
 */
export function getActionItemsByStat(stat: 'leadership' | 'strength' | 'intel' | 'politics' | 'charm'): BaseItem[] {
  const categoryMap = {
    leadership: 'horse',
    strength: 'weapon',
    intel: 'book',
    politics: 'seal',
    charm: 'accessory',
  } as const;
  return getActionItemsByCategory(categoryMap[stat]);
}
