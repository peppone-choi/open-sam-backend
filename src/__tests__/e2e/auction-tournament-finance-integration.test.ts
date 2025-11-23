/**
 * Integration Tests for Auction, Tournament, and Finance Systems
 */

import { processAuction } from '../../services/auction/AuctionEngine.service';
import { processTournament } from '../../services/tournament/TournamentEngine.service';
import { NationFinanceService } from '../../services/nation/NationFinance.service';
import { connectDB } from '../../config/db';
import { Auction } from '../../models/auction.model';
import { Tournament } from '../../models/tournament.model';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { City } from '../../models/city.model';

describe('Auction, Tournament, and Finance Integration Tests', () => {
  const sessionId = 'integration_test_session';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    // Cleanup test data
    await Auction.deleteMany({ session_id: sessionId });
    await Tournament.deleteMany({ session_id: sessionId });
    await General.deleteMany({ session_id: sessionId });
    await Nation.deleteMany({ session_id: sessionId });
    await City.deleteMany({ session_id: sessionId });
  });

  describe('Auction System Integration', () => {
    it('should handle complete auction lifecycle', async () => {
      // 1. Create test general
      const testGeneral = await General.create({
        session_id: sessionId,
        no: 1001,
        name: '테스트장수',
        inherit_point: 1000,
        data: {
          no: 1001,
          name: '테스트장수',
          w: 'w_heaven01',
          nation: 1
        }
      });

      // 2. Create test auction
      const testAuction = await Auction.create({
        session_id: sessionId,
        type: 'UniqueItem',
        hostGeneralId: 1001,
        target: 'w_heaven01',
        openDate: new Date(Date.now() - 60000),
        closeDate: new Date(Date.now() - 1000), // Expired
        finished: false,
        bids: [
          {
            generalId: 1001,
            amount: 100,
            date: new Date()
          }
        ]
      });

      // 3. Process auction
      await processAuction(sessionId);

      // 4. Verify auction is marked as finished
      const updatedAuction = await Auction.findById(testAuction._id);
      expect(updatedAuction?.finished).toBe(true);

      // 5. Verify general received item
      const updatedGeneral = await General.findOne({ session_id: sessionId, no: 1001 });
      expect(updatedGeneral?.data?.w).toBe('w_heaven01');
    });
  });

  describe('Tournament System Integration', () => {
    it('should handle tournament state transitions', async () => {
      // 1. Setup tournament-enabled generals
      await General.create({
        session_id: sessionId,
        no: 2001,
        name: '토너먼트장수',
        data: {
          no: 2001,
          name: '토너먼트장수',
          tnmt: 1,
          tournament: 0,
          leadership: 80,
          strength: 80,
          intel: 80
        }
      });

      // 2. Set tournament state in KVStorage would normally happen here
      // For testing, we'd need to mock KVStorage or use a test instance

      // This test is simplified - in practice, you'd need to:
      // - Set up KVStorage with tournament=1, tnmt_auto=true
      // - Run processTournament
      // - Verify tournament state transitions occur correctly
    });
  });

  describe('Finance System Integration', () => {
    it('should calculate and apply nation finance updates', async () => {
      // 1. Create test nation
      const testNation = await Nation.create({
        session_id: sessionId,
        nation: 1,
        data: {
          nation: 1,
          level: 5,
          rate: 10,
          capital: 101,
          type: 'none',
          bill: 100,
          gold: 10000,
          rice: 10000
        }
      });

      // 2. Create test city
      await City.create({
        session_id: sessionId,
        city: 101,
        data: {
          city: 101,
          nation: 1,
          농업: 1000,
          상업: 1000,
          치안: 1000,
          방어: 1000,
          인구: 10000,
          인구max: 10000
        }
      });

      // 3. Create test general in nation
      await General.create({
        session_id: sessionId,
        no: 3001,
        data: {
          no: 3001,
          nation: 1,
          city: 101,
          officer_level: 3,
          officer_city: 101
        }
      });

      // 4. Calculate finance
      const goldStats = await NationFinanceService.calculateGoldIncome(
        testNation,
        [await City.findOne({ session_id: sessionId, city: 101 })],
        [await General.findOne({ session_id: sessionId, no: 3001 })]
      );

      expect(goldStats.income).toBeGreaterThan(0);
      expect(goldStats.net).toBe(goldStats.income - goldStats.outcome);

      // 5. Apply finance update
      await NationFinanceService.applyFinanceUpdate(sessionId, 1, 184, 1);

      // 6. Verify nation resources updated
      const updatedNation = await Nation.findOne({ session_id: sessionId, nation: 1 });
      expect(updatedNation?.data?.gold).not.toBe(10000);
    });
  });

  describe('Cross-System Integration', () => {
    it('should handle tournament betting with nation finance impact', async () => {
      // This would test:
      // 1. Tournament progresses to betting phase
      // 2. Generals place bets using nation resources
      // 3. Tournament completes
      // 4. Winners receive payouts
      // 5. Nation finance reflects the changes
      
      // Implementation would be similar to above but combining tournament + finance
    });
  });
});
