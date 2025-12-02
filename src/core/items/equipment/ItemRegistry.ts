/**
 * ItemRegistry.ts
 * 아이템 등록 및 관리 시스템
 * 
 * 모든 아이템의 중앙 관리 레지스트리
 */

import { ItemBase, ItemRarity, ItemCategory } from './ItemBase';
import { WeaponBase, AllWeaponCreators } from './WeaponBase';
import { ArmorBase, AllArmorCreators } from './ArmorBase';
import { BookBase, IntelBook, AllBookCreators } from './BookBase';
import { ItemSlot } from './types';

// ============================================
// 타입 정의
// ============================================

export interface ItemSearchOptions {
  category?: ItemCategory;
  slot?: ItemSlot;
  rarity?: ItemRarity;
  minRarity?: ItemRarity;
  maxRarity?: ItemRarity;
  buyable?: boolean;
  minCost?: number;
  maxCost?: number;
  nameContains?: string;
}

export interface ItemRegistryStats {
  totalItems: number;
  byCategory: Record<ItemCategory, number>;
  byRarity: Record<ItemRarity, number>;
  buyableCount: number;
}

// ============================================
// 아이템 레지스트리 클래스
// ============================================

export class ItemRegistry {
  private static instance: ItemRegistry | null = null;
  private items: Map<string, ItemBase> = new Map();
  private initialized = false;

  private constructor() {}

  // 싱글톤 인스턴스 가져오기
  static getInstance(): ItemRegistry {
    if (!ItemRegistry.instance) {
      ItemRegistry.instance = new ItemRegistry();
    }
    return ItemRegistry.instance;
  }

  // 초기화 (모든 기본 아이템 등록)
  initialize(): void {
    if (this.initialized) return;

    // 무기 등록
    this.registerAllWeapons();

    // 방어구 등록
    this.registerAllArmors();

    // 서적 등록
    this.registerAllBooks();

    this.initialized = true;
  }

  // ============================================
  // 아이템 등록 메서드
  // ============================================

  private registerAllWeapons(): void {
    for (const [key, creator] of Object.entries(AllWeaponCreators)) {
      const item = creator();
      this.register(item);
    }
  }

  private registerAllArmors(): void {
    for (const [key, creator] of Object.entries(AllArmorCreators)) {
      const item = creator();
      this.register(item);
    }
  }

  private registerAllBooks(): void {
    for (const [key, creator] of Object.entries(AllBookCreators)) {
      const item = creator();
      this.register(item);
    }
  }

  // 단일 아이템 등록
  register(item: ItemBase): void {
    if (this.items.has(item.id)) {
      console.warn(`Item with id '${item.id}' already registered. Overwriting.`);
    }
    this.items.set(item.id, item);
  }

  // 여러 아이템 등록
  registerMany(items: ItemBase[]): void {
    for (const item of items) {
      this.register(item);
    }
  }

  // 아이템 등록 해제
  unregister(itemId: string): boolean {
    return this.items.delete(itemId);
  }

  // ============================================
  // 아이템 조회 메서드
  // ============================================

  // ID로 아이템 가져오기
  get(itemId: string): ItemBase | undefined {
    return this.items.get(itemId);
  }

  // ID로 아이템 가져오기 (없으면 에러)
  getOrThrow(itemId: string): ItemBase {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }
    return item;
  }

  // 아이템 존재 여부 확인
  has(itemId: string): boolean {
    return this.items.has(itemId);
  }

  // 모든 아이템 가져오기
  getAll(): ItemBase[] {
    return Array.from(this.items.values());
  }

  // 모든 아이템 ID 가져오기
  getAllIds(): string[] {
    return Array.from(this.items.keys());
  }

  // 조건에 맞는 아이템 검색
  search(options: ItemSearchOptions): ItemBase[] {
    let results = this.getAll();

    if (options.category !== undefined) {
      results = results.filter(item => item.category === options.category);
    }

    if (options.slot !== undefined) {
      results = results.filter(item => item.slot === options.slot);
    }

    if (options.rarity !== undefined) {
      results = results.filter(item => item.rarity === options.rarity);
    }

    if (options.minRarity !== undefined) {
      results = results.filter(item => item.rarity >= options.minRarity!);
    }

    if (options.maxRarity !== undefined) {
      results = results.filter(item => item.rarity <= options.maxRarity!);
    }

    if (options.buyable !== undefined) {
      results = results.filter(item => item.buyable === options.buyable);
    }

    if (options.minCost !== undefined) {
      results = results.filter(item => item.cost >= options.minCost!);
    }

    if (options.maxCost !== undefined) {
      results = results.filter(item => item.cost <= options.maxCost!);
    }

    if (options.nameContains !== undefined) {
      const searchLower = options.nameContains.toLowerCase();
      results = results.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.rawName.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  // 카테고리별 아이템 가져오기
  getByCategory(category: ItemCategory): ItemBase[] {
    return this.search({ category });
  }

  // 슬롯별 아이템 가져오기
  getBySlot(slot: ItemSlot): ItemBase[] {
    return this.search({ slot });
  }

  // 희귀도별 아이템 가져오기
  getByRarity(rarity: ItemRarity): ItemBase[] {
    return this.search({ rarity });
  }

  // 구매 가능한 아이템만 가져오기
  getBuyable(): ItemBase[] {
    return this.search({ buyable: true });
  }

  // 전설 아이템 가져오기
  getLegendary(): ItemBase[] {
    return this.search({ rarity: ItemRarity.LEGENDARY });
  }

  // ============================================
  // 무기 관련 메서드
  // ============================================

  getWeapons(): WeaponBase[] {
    return this.getByCategory(ItemCategory.WEAPON) as WeaponBase[];
  }

  getLegendaryWeapons(): WeaponBase[] {
    return this.search({
      category: ItemCategory.WEAPON,
      rarity: ItemRarity.LEGENDARY
    }) as WeaponBase[];
  }

  // ============================================
  // 방어구 관련 메서드
  // ============================================

  getArmors(): ArmorBase[] {
    return this.getByCategory(ItemCategory.ARMOR) as ArmorBase[];
  }

  // ============================================
  // 서적 관련 메서드
  // ============================================

  getBooks(): (BookBase | IntelBook)[] {
    return this.getByCategory(ItemCategory.BOOK) as (BookBase | IntelBook)[];
  }

  // ============================================
  // 통계 메서드
  // ============================================

  getStats(): ItemRegistryStats {
    const items = this.getAll();
    
    const byCategory: Record<ItemCategory, number> = {
      [ItemCategory.WEAPON]: 0,
      [ItemCategory.ARMOR]: 0,
      [ItemCategory.BOOK]: 0,
      [ItemCategory.MOUNT]: 0,
      [ItemCategory.ACCESSORY]: 0,
      [ItemCategory.CONSUMABLE]: 0
    };

    const byRarity: Record<ItemRarity, number> = {
      [ItemRarity.COMMON]: 0,
      [ItemRarity.UNCOMMON]: 0,
      [ItemRarity.RARE]: 0,
      [ItemRarity.EPIC]: 0,
      [ItemRarity.LEGENDARY]: 0
    };

    let buyableCount = 0;

    for (const item of items) {
      byCategory[item.category]++;
      byRarity[item.rarity]++;
      if (item.buyable) buyableCount++;
    }

    return {
      totalItems: items.length,
      byCategory,
      byRarity,
      buyableCount
    };
  }

  // ============================================
  // 유틸리티 메서드
  // ============================================

  // 랜덤 아이템 가져오기
  getRandom(options?: ItemSearchOptions): ItemBase | undefined {
    const pool = options ? this.search(options) : this.getAll();
    if (pool.length === 0) return undefined;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  // 랜덤 아이템 여러 개 가져오기
  getRandomMany(count: number, options?: ItemSearchOptions): ItemBase[] {
    const pool = options ? this.search(options) : this.getAll();
    if (pool.length === 0) return [];
    
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // 레지스트리 초기화
  clear(): void {
    this.items.clear();
    this.initialized = false;
  }

  // 디버그: 모든 아이템 정보 출력
  debug(): void {
    const stats = this.getStats();
    console.log('=== ItemRegistry Stats ===');
    console.log(`Total Items: ${stats.totalItems}`);
    console.log('By Category:', stats.byCategory);
    console.log('By Rarity:', stats.byRarity);
    console.log(`Buyable: ${stats.buyableCount}`);
    console.log('========================');
  }
}

// ============================================
// 편의 함수
// ============================================

// 전역 레지스트리 인스턴스 가져오기
export function getItemRegistry(): ItemRegistry {
  const registry = ItemRegistry.getInstance();
  registry.initialize();
  return registry;
}

// ID로 아이템 가져오기 (편의 함수)
export function getItem(itemId: string): ItemBase | undefined {
  return getItemRegistry().get(itemId);
}

// ID로 아이템 가져오기 (없으면 에러)
export function getItemOrThrow(itemId: string): ItemBase {
  return getItemRegistry().getOrThrow(itemId);
}

// 아이템 팩토리 함수
export function createItem(itemId: string): ItemBase | undefined {
  // 먼저 등록된 아이템에서 찾기
  const registered = getItem(itemId);
  if (registered) return registered;

  // 무기 생성자에서 찾기
  const weaponKey = Object.keys(AllWeaponCreators).find(
    key => AllWeaponCreators[key as keyof typeof AllWeaponCreators]().id === itemId
  );
  if (weaponKey) {
    return AllWeaponCreators[weaponKey as keyof typeof AllWeaponCreators]();
  }

  // 방어구 생성자에서 찾기
  const armorKey = Object.keys(AllArmorCreators).find(
    key => AllArmorCreators[key as keyof typeof AllArmorCreators]().id === itemId
  );
  if (armorKey) {
    return AllArmorCreators[armorKey as keyof typeof AllArmorCreators]();
  }

  // 서적 생성자에서 찾기
  const bookKey = Object.keys(AllBookCreators).find(
    key => AllBookCreators[key as keyof typeof AllBookCreators]().id === itemId
  );
  if (bookKey) {
    return AllBookCreators[bookKey as keyof typeof AllBookCreators]();
  }

  return undefined;
}

// ============================================
// None 아이템 (빈 슬롯)
// ============================================

export class NoneItem extends ItemBase {
  constructor() {
    super({
      id: 'none',
      rawName: '-',
      name: '-',
      description: '',
      slot: ItemSlot.ACCESSORY,
      category: ItemCategory.ACCESSORY,
      rarity: ItemRarity.COMMON,
      cost: 0,
      consumable: false,
      buyable: true,
      effect: {}
    });
  }
}

export const NONE_ITEM = new NoneItem();

