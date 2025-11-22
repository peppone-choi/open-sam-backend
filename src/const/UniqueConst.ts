/**
 * 유니크 아이템 상수
 */

import { logger } from '../common/logger';
import { getServerIdentity, ServerIdentityPayload } from '../common/cache/server-identity.helper';

export interface UniqueItem {
  id: number;
  name: string;
  type: string;
  rarity: number; // 희귀도 (1: 일반, 2: 고급, 3: 희귀, 4: 전설)
  effect: {
    leadership?: number;
    strength?: number;
    intel?: number;
    attack?: number;
    defence?: number;
  };
  description: string;
}

export type ServerIdentity = ServerIdentityPayload;

export class UniqueConst {
  private static context: ServerIdentity = UniqueConst.buildDefaultContext();

  private static items: Map<number, UniqueItem> = new Map();
  private static initialized = false;

  private static buildDefaultContext(sessionId?: string): ServerIdentity {
    const resolvedSessionId = sessionId || process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    return {
      sessionId: resolvedSessionId,
      serverId: process.env.SERVER_ID || resolvedSessionId,
      serverName: process.env.SERVER_NAME || 'OpenSAM',
      hiddenSeed: process.env.SERVER_HIDDEN_SEED || 'opensam_hidden_seed',
      season: Number(process.env.SERVER_SEASON_INDEX ?? 0),
      updatedAt: new Date().toISOString()
    };
  }

  static get serverID(): string {
    return this.context.serverId;
  }

  static get serverName(): string {
    return this.context.serverName;
  }

  static get seasonIdx(): number {
    return this.context.season;
  }

  static get hiddenSeed(): string {
    return this.context.hiddenSeed;
  }

  static getContext(): ServerIdentity {
    return this.context;
  }

  static async refresh(sessionId?: string): Promise<ServerIdentity> {
    const targetSessionId = sessionId || this.context.sessionId || process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    try {
      const identity = await getServerIdentity(targetSessionId);
      this.context = identity;
      return identity;
    } catch (error: any) {
      logger.warn('[세션] 서버 식별자를 불러오지 못해 기본값을 사용합니다.', {
        sessionId: targetSessionId,
        error: error?.message || String(error)
      });
      this.context = this.buildDefaultContext(targetSessionId);
      return this.context;
    }
  }

  static setContext(identity: ServerIdentity): void {
    this.context = identity;
  }

  /**
   * 유니크 아이템 초기화
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    // 전설 무기
    this.addItem({
      id: 1,
      name: '청룡언월도',
      type: 'weapon',
      rarity: 4,
      effect: { strength: 10, attack: 15 },
      description: '관우의 무기. 강력한 공격력을 자랑한다.'
    });

    this.addItem({
      id: 2,
      name: '방천화극',
      type: 'weapon',
      rarity: 4,
      effect: { strength: 12, attack: 18 },
      description: '여포의 무기. 최강의 공격력을 가진다.'
    });

    this.addItem({
      id: 3,
      name: '쌍검',
      type: 'weapon',
      rarity: 3,
      effect: { strength: 8, attack: 12 },
      description: '유비의 쌍검. 균형잡힌 능력치를 제공한다.'
    });

    // 전설 방어구
    this.addItem({
      id: 101,
      name: '적토마',
      type: 'mount',
      rarity: 4,
      effect: { leadership: 5, strength: 8 },
      description: '여포의 명마. 속도와 힘을 동시에 증가시킨다.'
    });

    this.addItem({
      id: 102,
      name: '적로',
      type: 'mount',
      rarity: 4,
      effect: { leadership: 8, intel: 5 },
      description: '관우의 명마. 통솔력을 크게 향상시킨다.'
    });

    // 전략 아이템
    this.addItem({
      id: 201,
      name: '손자병법',
      type: 'book',
      rarity: 4,
      effect: { intel: 15, leadership: 10 },
      description: '손무의 병법서. 지략과 통솔을 대폭 증가시킨다.'
    });

    this.addItem({
      id: 202,
      name: '오자병법',
      type: 'book',
      rarity: 3,
      effect: { intel: 12, leadership: 8 },
      description: '오기의 병법서. 전략적 사고를 향상시킨다.'
    });

    // 방어구
    this.addItem({
      id: 301,
      name: '백은갑',
      type: 'armor',
      rarity: 3,
      effect: { defence: 15 },
      description: '견고한 은빛 갑옷. 방어력을 크게 증가시킨다.'
    });

    this.addItem({
      id: 302,
      name: '투구',
      type: 'helmet',
      rarity: 2,
      effect: { defence: 8, leadership: 3 },
      description: '장군의 투구. 방어력과 통솔력을 증가시킨다.'
    });
  }

  /**
   * 아이템 추가
   */
  private static addItem(item: UniqueItem): void {
    this.items.set(item.id, item);
  }

  /**
   * ID로 아이템 조회
   */
  static getItem(id: number): UniqueItem | undefined {
    if (this.items.size === 0) {
      this.initialize();
    }
    return this.items.get(id);
  }

  /**
   * 모든 아이템 조회
   */
  static getAllItems(): UniqueItem[] {
    if (this.items.size === 0) {
      this.initialize();
    }
    return Array.from(this.items.values());
  }

  /**
   * 희귀도별 아이템 조회
   */
  static getItemsByRarity(rarity: number): UniqueItem[] {
    if (this.items.size === 0) {
      this.initialize();
    }
    return Array.from(this.items.values()).filter(item => item.rarity === rarity);
  }

  /**
   * 타입별 아이템 조회
   */
  static getItemsByType(type: string): UniqueItem[] {
    if (this.items.size === 0) {
      this.initialize();
    }
    return Array.from(this.items.values()).filter(item => item.type === type);
  }

  /**
   * 랜덤 아이템 추첨 (희귀도 가중치 적용)
   */
  static getRandomItem(rng: any): UniqueItem | null {
    if (this.items.size === 0) {
      this.initialize();
    }

    const allItems = this.getAllItems();
    if (allItems.length === 0) {
      return null;
    }

    // 희귀도별 가중치 (높을수록 나올 확률 낮음)
    const rarityWeights = {
      1: 100, // 일반: 100%
      2: 50,  // 고급: 50%
      3: 20,  // 희귀: 20%
      4: 5    // 전설: 5%
    };

    // 가중치 합계 계산
    const totalWeight = allItems.reduce((sum, item) => {
      return sum + (rarityWeights[item.rarity as keyof typeof rarityWeights] || 1);
    }, 0);

    // 랜덤 값 생성
    const randomValue = rng.nextFloat() * totalWeight;

    // 가중치 기반 선택
    let currentWeight = 0;
    for (const item of allItems) {
      currentWeight += rarityWeights[item.rarity as keyof typeof rarityWeights] || 1;
      if (randomValue <= currentWeight) {
        return item;
      }
    }

    // 기본값 (마지막 아이템)
    return allItems[allItems.length - 1];
  }
}

// 초기화
UniqueConst.initialize();
