import { GameConst } from '../constants/GameConst';
import type { GameAction } from '../game/actions/Action';
import { getScenarioConstants, getScenarioItems } from './scenario-data';

export type ItemSlot = 'item' | 'weapon' | 'book' | 'horse';

const ITEM_SLOTS: ItemSlot[] = ['item', 'weapon', 'book', 'horse'];

function isItemSlot(value: string | null | undefined): value is ItemSlot {
  return typeof value === 'string' && ITEM_SLOTS.includes(value as ItemSlot);
}

interface ItemDefinition {
  id: string;
  name: string;
  description?: string;
  effects: ItemEffects;
}

interface ItemEffects {
  cost?: number;
  reqSecu?: number;
  consumable?: boolean;
  buyable?: boolean;
  general?: {
    hasPreTurnTrigger?: boolean;
    healing?: boolean;
    maxCharges?: number;
  };
  domestic?: Record<string, number>;
  statBonus?: Record<string, any>;
}

interface ItemBuildOptions {
  slot?: ItemSlot;
  override?: Partial<ItemEffects>;
}

export interface ItemAction extends GameAction {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly effects: ItemEffects;
  readonly type?: string;
  getName(): string;
  getRawName(): string;
  getRawClassName(): string;
  getCost(): number;
  getReqSecu(): number;
  isBuyable(): boolean;
  isConsumable(): boolean;
  setSlot(slot: ItemSlot): void;
  getSlot(): ItemSlot | undefined;
  tryConsumeNow?(general: any, actionType?: string, command?: string): Promise<boolean> | boolean;
}

const itemDefinitionCache: Map<string, ItemDefinition> = new Map();
let itemTypeCache: Map<string, string> | null = null;

function ensureItemDefinitionsLoaded(): void {
  if (itemDefinitionCache.size > 0) {
    return;
  }
  const items = getScenarioItems();
  for (const item of items) {
    if (item?.id) {
      itemDefinitionCache.set(item.id, item);
    }
  }
}

function ensureItemTypeCache(): void {
  if (itemTypeCache) {
    return;
  }
  itemTypeCache = new Map();
  const constants = getScenarioConstants();
  const allItems = (constants && constants.allItems) ? constants.allItems : GameConst.allItems || {};
  for (const [itemType, entries] of Object.entries(allItems)) {
    if (!entries) {
      continue;
    }
    for (const itemCode of Object.keys(entries)) {
      itemTypeCache.set(itemCode, itemType);
    }
  }
}

function getItemDefinition(itemCode: string): ItemDefinition | null {
  ensureItemDefinitionsLoaded();
  return itemDefinitionCache.get(itemCode) || null;
}

function getItemTypeForCode(itemCode: string): string | null {
  ensureItemTypeCache();
  return itemTypeCache?.get(itemCode) || null;
}

function normalizeItemName(name?: string): string {
  if (!name) {
    return '';
  }
  return name.replace(/\s*\(.*\)$/, '').trim() || name;
}

class BaseItem implements ItemAction {
  protected slot?: ItemSlot;

  constructor(protected readonly definition: ItemDefinition) {}

  get id(): string {
    return this.definition.id;
  }

  get code(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get description(): string {
    return this.definition.description || '';
  }

  get effects(): ItemEffects {
    return this.definition.effects || {};
  }

  getName(): string {
    return this.name;
  }

  getRawName(): string {
    return normalizeItemName(this.name);
  }

  getRawClassName(): string {
    return this.definition.id;
  }

  getInfo(): string {
    return this.description;
  }

  getCost(): number {
    return Number(this.effects.cost ?? 0);
  }

  getReqSecu(): number {
    return Number(this.effects.reqSecu ?? 0);
  }

  setSlot(slot: ItemSlot): void {
    this.slot = slot;
  }

  getSlot(): ItemSlot | undefined {
    return this.slot;
  }

  get type(): string | undefined {
    return this.slot || getItemTypeForCode(this.id) || undefined;
  }

  isBuyable(): boolean {
    if (typeof this.effects.buyable === 'boolean') {
      return this.effects.buyable;
    }
    const type = this.slot || getItemTypeForCode(this.id);
    if (type && GameConst.allItems?.[type]) {
      const remainSetting = GameConst.allItems[type][this.id];
      if (typeof remainSetting === 'number') {
        return remainSetting === 0;
      }
    }
    return false;
  }

  isConsumable(): boolean {
    return Boolean(this.effects.consumable);
  }

  async tryConsumeNow(_general?: any, _actionType?: string, _command?: string): Promise<boolean> {
    return this.isConsumable();
  }

  onCalcDomestic(turnType: string, varType: string, value: number): number {
    return value;
  }

  async onPreTurnExecute(_general: any, _context?: Record<string, any>): Promise<boolean | void> {
    return false;
  }
}

class SabotageSuccessItem extends BaseItem {
  constructor(definition: ItemDefinition, private readonly bonus: number) {
    super(definition);
  }

  onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (turnType !== '계략' || varType !== 'success') {
      return value;
    }
    const next = value + this.bonus;
    return Math.max(0, Math.min(1, next));
  }
}

class HealingItem extends BaseItem {
  private readonly maxCharges: number;

  constructor(definition: ItemDefinition, maxCharges: number) {
    super(definition);
    this.maxCharges = Math.max(1, maxCharges);
  }

  private getChargeStore(general: any): Record<string, number> {
    if (!general.data) {
      general.data = {};
    }
    if (!general.data.aux) {
      general.data.aux = {};
    }
    if (!general.data.aux.itemCharges) {
      general.data.aux.itemCharges = {};
    }
    return general.data.aux.itemCharges;
  }

  private getChargeKey(): string {
    return `${this.getSlot() || 'item'}:${this.id}`;
  }

  private getRemainingCharges(general: any): number {
    const store = this.getChargeStore(general);
    const key = this.getChargeKey();
    if (typeof store[key] !== 'number') {
      store[key] = this.maxCharges;
    }
    return store[key];
  }

  private updateCharges(general: any, next: number): void {
    const store = this.getChargeStore(general);
    store[this.getChargeKey()] = next;
    if (typeof general.markModified === 'function') {
      general.markModified('data');
    }
  }

  private resetInjury(general: any): void {
    general.injury = 0;
    if (!general.data) {
      general.data = {};
    }
    general.data.injury = 0;
    if (typeof general.markModified === 'function') {
      general.markModified('data');
    }
  }

  async tryConsumeNow(general: any): Promise<boolean> {
    if (!this.isConsumable()) {
      return false;
    }
    const remain = this.getRemainingCharges(general);
    if (remain <= 1) {
      this.updateCharges(general, 0);
      return true;
    }
    this.updateCharges(general, remain - 1);
    return false;
  }

  async onPreTurnExecute(general: any, context?: Record<string, any>): Promise<boolean | void> {
    const injury = general?.injury ?? general?.data?.injury ?? 0;
    const threshold = general?.aux?.use_treatment ?? general?.data?.aux?.use_treatment ?? 10;
    if (injury < threshold) {
      return false;
    }

    if (typeof general.getLogger === 'function') {
      try {
        const logger = general.getLogger();
        logger?.pushGeneralActionLog?.(`<C>${this.name}</>을(를) 사용하여 부상을 치료합니다.`);
      } catch (error) {
        // noop - logger 실패는 게임 진행에 영향을 주면 안 됨
      }
    }

    this.resetInjury(general);
    const consumed = await this.tryConsumeNow(general);

    if (consumed && context?.logger && typeof context.logger.pushGeneralHistoryLog === 'function') {
      context.logger.pushGeneralHistoryLog?.(`${this.name}의 효능이 다했습니다.`);
    }

    return consumed;
  }
}

const CUSTOM_ITEM_FACTORIES: Record<string, (definition: ItemDefinition) => ItemAction> = {
  'che_계략_향낭': (definition) => new SabotageSuccessItem(definition, 0.5),
  'che_계략_이추': (definition) => new SabotageSuccessItem(definition, 0.2),
  'che_계략_삼략': (definition) => new SabotageSuccessItem(definition, 0.2),
  'che_계략_육도': (definition) => new SabotageSuccessItem(definition, 0.2),
  'che_치료_환약': (definition) => new HealingItem(definition, definition.effects?.general?.maxCharges ?? 3),
};

function createItemInstance(id: string, itemData?: ItemDefinition): ItemDefinition {
  if (itemData) {
    return itemData;
  }
  return {
    id,
    name: id === 'None' ? 'None' : id,
    description: '',
    effects: {}
  };
}

export function buildItemClass(itemId: string | number, options?: ItemBuildOptions): ItemAction {
  const normalizedId = (itemId === undefined || itemId === null || itemId === '') ? 'None' : String(itemId);

  const definition = normalizedId === 'None'
    ? createItemInstance('None')
    : createItemInstance(normalizedId, getItemDefinition(normalizedId) ?? undefined);

  const fallbackSlot = getItemTypeForCode(normalizedId);
  const resolvedSlot = options?.slot || (isItemSlot(fallbackSlot) ? fallbackSlot : undefined);
  const mergedEffects: ItemEffects = {
    ...(definition.effects || {}),
    ...(options?.override || {})
  };

  const finalDefinition: ItemDefinition = {
    ...definition,
    effects: mergedEffects,
  };

  const factory = CUSTOM_ITEM_FACTORIES[normalizedId];
  const item = factory ? factory(finalDefinition) : new BaseItem(finalDefinition);

  if (resolvedSlot) {
    item.setSlot(resolvedSlot);
  }

  return item;
}

const globalAny = global as any;
if (!globalAny.buildItemClass) {
  globalAny.buildItemClass = buildItemClass;
}
