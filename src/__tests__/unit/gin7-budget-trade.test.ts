/**
 * GIN7 Budget Service - Trade Revenue Test
 * 
 * 검증 항목:
 * 1. calculateTradeRevenue: 무역로 기반 세수 계산
 * 2. collectTradeTax: TradeRouteService 연동
 * 3. 페잔 특수 보너스: +20% 세율, 회랑 통행료
 */

import { BudgetService, ITradeRevenueResult } from '../../services/gin7/BudgetService';
import { TradeRoute, ITradeRoute } from '../../models/gin7/TradeRoute';

// Mock TradeRoute 모델
jest.mock('../../models/gin7/TradeRoute', () => ({
  TradeRoute: {
    find: jest.fn(),
  },
}));

const mockedTradeRoute = TradeRoute as jest.Mocked<typeof TradeRoute>;

describe('GIN7 Budget Service - Trade Revenue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 검증 1: calculateTradeRevenue - 무역로 기반 세수 계산
  // =========================================================================
  describe('1. calculateTradeRevenue 기본 동작', () => {
    it('무역로 없으면 세수 0 반환', async () => {
      // Given: 무역로 없음
      mockedTradeRoute.find.mockResolvedValue([]);

      // When
      const result = await BudgetService.calculateTradeRevenue('sess1', 'faction1', 0.05);

      // Then
      expect(result.totalRevenue).toBe(0);
      expect(result.byRoute).toHaveLength(0);
      expect(result.phezzanBonus).toBe(0);
      expect(result.corridorTolls).toBe(0);

      console.log('\n=== 무역로 없는 경우 ===');
      console.log(`총 세수: ${result.totalRevenue} 크레딧`);
    });

    it('활성 무역로의 교역량에 세율 적용', async () => {
      // Given: 활성 무역로 2개
      const mockRoutes = [
        createMockRoute('route1', '무역로A', 'faction1', [
          { itemType: 'minerals', quantity: 100 }, // 100 * 20 = 2000
          { itemType: 'fuel', quantity: 50 },      // 50 * 15 = 750
        ]),
        createMockRoute('route2', '무역로B', 'faction1', [
          { itemType: 'shipParts', quantity: 10 }, // 10 * 100 = 1000
        ]),
      ];
      
      mockedTradeRoute.find.mockResolvedValue(mockRoutes as any);

      // When: 5% 세율 적용
      const result = await BudgetService.calculateTradeRevenue('sess1', 'faction1', 0.05);

      // Then: 총 교역량 3750, 5% 세금 = 187
      expect(result.byRoute).toHaveLength(2);
      expect(result.totalRevenue).toBe(187); // floor(3750 * 0.05)
      
      console.log('\n=== 기본 세수 계산 ===');
      result.byRoute.forEach(route => {
        console.log(`${route.routeName}: 교역량 ${route.tradingVolume} → 세금 ${route.taxCollected}`);
      });
      console.log(`총 세수: ${result.totalRevenue} 크레딧`);
    });

    it('최근 거래 기록이 있으면 실제 거래량 사용', async () => {
      // Given: 거래 기록이 있는 무역로
      const mockRoute = createMockRoute('route1', '활성무역로', 'faction1', [
        { itemType: 'minerals', quantity: 100 },
      ]);
      (mockRoute as any).transactions = [
        { totalAmount: 5000, type: 'SELL' },
        { totalAmount: 4000, type: 'SELL' },
        { totalAmount: 6000, type: 'SELL' },
      ];

      mockedTradeRoute.find.mockResolvedValue([mockRoute] as any);

      // When
      const result = await BudgetService.calculateTradeRevenue('sess1', 'faction1', 0.05);

      // Then: 평균 5000 * 0.05 = 250
      expect(result.byRoute[0].tradingVolume).toBe(5000);
      expect(result.byRoute[0].taxCollected).toBe(250);

      console.log('\n=== 실제 거래량 기반 계산 ===');
      console.log(`평균 거래량: ${result.byRoute[0].tradingVolume}`);
      console.log(`세금: ${result.byRoute[0].taxCollected}`);
    });
  });

  // =========================================================================
  // 검증 2: 페잔 특수 보너스 - +20% 세율
  // =========================================================================
  describe('2. 페잔 특수 보너스 (+20% 세율)', () => {
    it('페잔 무역로는 세율 +20% 보너스', async () => {
      // Given: 페잔이 통제하는 페잔 경유 무역로
      const mockRoute = createMockRoute('route1', '페잔-제국 무역로', 'PHEZZAN', [
        { itemType: 'rareMetals', quantity: 50 }, // 50 * 200 = 10000
      ]);
      (mockRoute as any).sourceId = 'PHEZZAN'; // 페잔 경유

      mockedTradeRoute.find.mockResolvedValue([mockRoute] as any);

      // When: 페잔 세력
      const result = await BudgetService.calculateTradeRevenue('sess1', 'PHEZZAN', 0.05);

      // Then: 기본 500 + 보너스 100 (+20%) = 600
      const baseTax = Math.floor(10000 * 0.05); // 500
      const bonus = Math.floor(10000 * 0.05 * 0.20); // 100
      
      expect(result.byRoute[0].taxCollected).toBe(baseTax + bonus);
      expect(result.byRoute[0].isPhezzanControlled).toBe(true);
      expect(result.phezzanBonus).toBe(bonus);

      console.log('\n=== 페잔 세율 보너스 ===');
      console.log(`교역량: 10000`);
      console.log(`기본 세금 (5%): ${baseTax}`);
      console.log(`페잔 보너스 (+20%): ${bonus}`);
      console.log(`총 세금: ${result.byRoute[0].taxCollected}`);
    });

    it('페잔 외 세력은 보너스 없음', async () => {
      // Given: 제국 세력의 무역로
      const mockRoute = createMockRoute('route1', '제국 내 무역로', 'EMPIRE', [
        { itemType: 'fuel', quantity: 100 }, // 100 * 15 = 1500
      ]);

      mockedTradeRoute.find.mockResolvedValue([mockRoute] as any);

      // When: 제국 세력
      const result = await BudgetService.calculateTradeRevenue('sess1', 'EMPIRE', 0.05);

      // Then: 보너스 없음
      expect(result.byRoute[0].taxCollected).toBe(75); // floor(1500 * 0.05)
      expect(result.byRoute[0].isPhezzanControlled).toBe(false);
      expect(result.phezzanBonus).toBe(0);

      console.log('\n=== 일반 세력 (보너스 없음) ===');
      console.log(`교역량: 1500`);
      console.log(`세금 (5%): ${result.byRoute[0].taxCollected}`);
      console.log(`페잔 보너스: 0`);
    });
  });

  // =========================================================================
  // 검증 3: 페잔 회랑 통행료
  // =========================================================================
  describe('3. 페잔 회랑 통행료', () => {
    it('페잔은 타 세력 무역로에서 통행료 징수', async () => {
      // Given: 페잔 자신의 무역로
      const phezzanRoute = createMockRoute('route1', '페잔 자체 무역로', 'PHEZZAN', [
        { itemType: 'credits', quantity: 1000 }, // 1000 * 1 = 1000
      ]);

      // 타 세력의 페잔 경유 무역로 (통행료 대상)
      const transitRoute = createMockRoute('route2', '제국-동맹 무역로', 'EMPIRE', [
        { itemType: 'minerals', quantity: 500 }, // 500 * 20 = 10000
      ]);
      (transitRoute as any).sourceId = 'PHEZZAN-PRIME'; // 페잔 경유

      // find 호출 순서: 1. 페잔 자체 무역로, 2. 타 세력 경유 무역로
      mockedTradeRoute.find
        .mockResolvedValueOnce([phezzanRoute] as any) // 페잔 자체
        .mockResolvedValueOnce([transitRoute] as any); // 타 세력 경유

      // When
      const result = await BudgetService.calculateTradeRevenue('sess1', 'PHEZZAN', 0.05);

      // Then: 자체 무역로 세금 + 통행료
      const transitToll = Math.floor(10000 * 0.03); // 3% 통행료 = 300
      expect(result.corridorTolls).toBe(transitToll);

      console.log('\n=== 페잔 회랑 통행료 ===');
      console.log(`자체 무역로 세수: ${result.byRoute[0]?.taxCollected || 0}`);
      console.log(`타 세력 경유 교역량: 10000`);
      console.log(`통행료 (3%): ${result.corridorTolls}`);
      console.log(`총 세수: ${result.totalRevenue}`);
    });

    it('페잔 외 세력은 통행료 징수 불가', async () => {
      // Given: 제국 세력
      const mockRoute = createMockRoute('route1', '제국 무역로', 'EMPIRE', [
        { itemType: 'ammo', quantity: 100 }, // 100 * 25 = 2500
      ]);

      mockedTradeRoute.find.mockResolvedValue([mockRoute] as any);

      // When
      const result = await BudgetService.calculateTradeRevenue('sess1', 'EMPIRE', 0.05);

      // Then: 통행료 없음
      expect(result.corridorTolls).toBe(0);

      console.log('\n=== 일반 세력 (통행료 없음) ===');
      console.log(`통행료: ${result.corridorTolls}`);
    });
  });

  // =========================================================================
  // 검증 4: 통합 시나리오
  // =========================================================================
  describe('4. 통합 시나리오', () => {
    it('페잔 전체 세수 계산 (자체 + 보너스 + 통행료)', async () => {
      // Given: 페잔의 복합 상황
      // 1. 페잔 경유 자체 무역로 (보너스 적용)
      const phezzanLocalRoute = createMockRoute('route1', '페잔 내부 무역', 'PHEZZAN', [
        { itemType: 'credits', quantity: 5000 }, // 5000
      ]);
      (phezzanLocalRoute as any).sourceId = 'PHEZZAN';

      // 2. 페잔 비경유 자체 무역로 (보너스 미적용)
      const phezzanExternalRoute = createMockRoute('route2', '페잔 외부 무역', 'PHEZZAN', [
        { itemType: 'food', quantity: 200 }, // 200 * 10 = 2000
      ]);
      (phezzanExternalRoute as any).sourceId = 'ODIN';
      (phezzanExternalRoute as any).targetId = 'HEINESSEN';

      // 3. 제국의 페잔 경유 무역로 (통행료 대상)
      const empireTransitRoute = createMockRoute('route3', '제국 중계 무역', 'EMPIRE', [
        { itemType: 'shipParts', quantity: 100 }, // 100 * 100 = 10000
      ]);
      (empireTransitRoute as any).sourceId = 'PHEZZAN-CORRIDOR';

      mockedTradeRoute.find
        .mockResolvedValueOnce([phezzanLocalRoute, phezzanExternalRoute] as any)
        .mockResolvedValueOnce([empireTransitRoute] as any);

      // When
      const result = await BudgetService.calculateTradeRevenue('sess1', 'PHEZZAN', 0.05);

      // Then: 계산
      // route1: 5000 * 0.05 = 250 + 50 (보너스) = 300
      // route2: 2000 * 0.05 = 100 (보너스 없음)
      // 통행료: 10000 * 0.03 = 300
      // 총: 300 + 100 + 300 = 700

      console.log('\n=== 페잔 전체 세수 계산 ===');
      result.byRoute.forEach(route => {
        console.log(`${route.routeName}: 교역량 ${route.tradingVolume} → 세금 ${route.taxCollected} (페잔 보너스: ${route.isPhezzanControlled})`);
      });
      console.log(`페잔 보너스 합계: ${result.phezzanBonus}`);
      console.log(`회랑 통행료: ${result.corridorTolls}`);
      console.log(`총 세수: ${result.totalRevenue}`);

      expect(result.totalRevenue).toBe(700);
      expect(result.phezzanBonus).toBe(50);
      expect(result.corridorTolls).toBe(300);
    });
  });

  // =========================================================================
  // 아이템 가격표 확인
  // =========================================================================
  describe('아이템 기본 가격표', () => {
    it('교역 아이템 기본 가격 출력', () => {
      const baseItemPrices: Record<string, number> = {
        food: 10,
        fuel: 15,
        ammo: 25,
        minerals: 20,
        credits: 1,
        shipParts: 100,
        energy: 12,
        rareMetals: 200,
        components: 80
      };

      console.log('\n=== 교역 아이템 기본 가격표 ===');
      console.log('| 아이템 | 기본 가격 |');
      console.log('|--------|----------|');
      Object.entries(baseItemPrices)
        .sort((a, b) => b[1] - a[1])
        .forEach(([item, price]) => {
          console.log(`| ${item.padEnd(10)} | ${price.toString().padStart(8)} |`);
        });

      expect(baseItemPrices.rareMetals).toBe(200);
      expect(baseItemPrices.food).toBe(10);
    });
  });
});

// =========================================================================
// Helper Functions
// =========================================================================

function createMockRoute(
  routeId: string,
  name: string,
  factionId: string,
  items: Array<{ itemType: string; quantity: number }>
): Partial<ITradeRoute> {
  return {
    routeId,
    name,
    factionId,
    sessionId: 'sess1',
    ownerId: 'owner1',
    sourceId: 'source1',
    sourceType: 'PLANET',
    sourceName: 'Source Planet',
    targetId: 'target1',
    targetType: 'PLANET',
    targetName: 'Target Planet',
    status: 'ACTIVE',
    items: items.map(i => ({
      itemType: i.itemType as any,
      quantity: i.quantity,
      autoPurchase: true,
      autoSell: true,
      minBuyPrice: 0,
      maxSellPrice: Infinity
    })),
    transactions: [],
    distance: 10,
    travelTime: 1,
    frequency: 1,
    escortRequired: false,
    piracyRisk: 5,
    interceptRisk: 0,
    operatingCost: 100,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    averageProfitPerTrip: 0,
    sourceTariff: 0.05,
    targetTariff: 0.05,
    transitFees: 0,
    totalTrips: 0,
    successfulTrips: 0,
    failedTrips: 0,
    cargoLost: 0,
  };
}










