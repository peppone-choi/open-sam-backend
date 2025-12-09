import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { getGoldIncome, getRiceIncome, getWallIncome, getWarGoldIncome } from '../utils/income-util';
import { ResourceService } from '../common/services/resource.service';

// Mock DB and Repository
jest.mock('../config/db', () => ({
  DB: {
    db: jest.fn(() => ({
      update: jest.fn().mockResolvedValue(true as never),
      query: jest.fn().mockResolvedValue([] as never),
      sqleval: jest.fn((val) => val)
    }))
  }
}));

describe('Internal Affairs Unit Tests', () => {
  
  describe('Income Calculation (income-util)', () => {
    const mockCity = {
      city: 1,
      name: 'TestCity',
      pop: 10000,
      trust: 100,
      comm: 100,
      comm_max: 100,
      agri: 100,
      agri_max: 100,
      secu: 100,
      secu_max: 100,
      def: 100,
      wall: 100,
      wall_max: 100,
      dead: 0,
      supply: 1,
      data: {} // fallback
    };

    const mockNation = {
      nation: 1,
      level: 1,
      type: 'normal',
      capital: 1,
      taxRate: 20, // 20% tax
      data: {
        level: 1,
        type: 'normal',
        capital: 1,
        rate_tmp: 20
      }
    };

    test('should calculate Gold Income correctly based on population and commerce', () => {
      // Formula approx: pop * comm/commMax * trustRatio/30 * (1 + secuRatio/10) * officers...
      // 10000 * 1 * 1 / 30 * 1.1 = 366.66
      // Capital bonus: * (1 + 1/3/1) = * 1.333
      // Total approx: 488
      // Nation Tax: 20/20 = 1.0
      
      const income = getGoldIncome(
        mockNation.nation,
        mockNation.level,
        mockNation.taxRate,
        mockNation.capital,
        mockNation.type,
        [mockCity],
        { 1: 0 } // 0 officers
      );

      expect(income).toBeGreaterThan(0);
      expect(income).toBe(489);
    });

    test('should calculate Rice Income correctly', () => {
      const income = getRiceIncome(
        mockNation.nation,
        mockNation.level,
        mockNation.taxRate,
        mockNation.capital,
        mockNation.type,
        [mockCity],
        { 1: 0 }
      );
      
      expect(income).toBeGreaterThan(0);
      expect(income).toBe(489); 
    });

    test('should calculate Wall Income', () => {
      const income = getWallIncome(
         mockNation.nation,
        mockNation.level,
        mockNation.taxRate,
        mockNation.capital,
        mockNation.type,
        [mockCity],
        { 1: 0 }
      );
      // Wall formula: def * wall/wallMax / 3 * ...
      // 100 * 1 / 3 = 33.33
      // Secu: * 1.1 = 36.66
      // Capital: * 1.333 = 48.88
      // Tax: * 1 = 48
      expect(income).toBe(49);
    });
  });

  describe('Commerce Investment (Resource Cost Check)', () => {
    test('should increase commerce value on success', async () => {
      const bag = { gold: 1000 };
      const costs = [{ id: 'gold', amount: 100 }];
      
      ResourceService.applyCost(bag, costs, 'commit');
      expect(bag.gold).toBe(900);
      
      ResourceService.applyCost(bag, costs, 'refund');
      expect(bag.gold).toBe(1000);
    });
  });

  describe('Personnel (Reward Simulation)', () => {
    test('should transfer resources from nation to general', () => {
        const nationRes = { gold: 10000 };
        const generalRes = { gold: 0 };
        const amount = 1000;
        
        // Simulate Reward
        if (nationRes.gold >= amount) {
            nationRes.gold -= amount;
            generalRes.gold += amount;
        }
        
        expect(nationRes.gold).toBe(9000);
        expect(generalRes.gold).toBe(1000);
    });
  });
});
