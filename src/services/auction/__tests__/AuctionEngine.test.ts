/**
 * AuctionEngine Service Unit Tests
 */

import { processAuction, registerAuction } from '../AuctionEngine.service';
import { auctionRepository } from '../../../repositories/auction.repository';
import { generalRepository } from '../../../repositories/general.repository';

jest.mock('../../../repositories/auction.repository');
jest.mock('../../../repositories/general.repository');
jest.mock('../../gameEventEmitter');

describe('AuctionEngine Service', () => {
  const sessionId = 'test_session';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processAuction', () => {
    it('should process expired auction with winner', async () => {
      const mockAuction = {
        _id: 'auction123',
        session_id: sessionId,
        type: 'UniqueItem',
        closeDate: new Date(Date.now() - 1000),
        finished: false,
        hostGeneralId: 1,
        target: 'w_heaven01',
        bids: [
          {
            generalId: 2,
            amount: 100,
            date: new Date()
          }
        ],
        save: jest.fn()
      };

      const mockHostGeneral = {
        no: 1,
        name: '호스트',
        inherit_point: 0,
        data: { w: 'w_heaven01' }
      };

      const mockWinnerGeneral = {
        no: 2,
        name: '낙찰자',
        inherit_point: 100,
        data: { w: 'None' }
      };

      (auctionRepository.findByFilter as jest.Mock).mockResolvedValue([mockAuction]);
      (generalRepository.findBySessionAndNo as jest.Mock)
        .mockResolvedValueOnce(mockHostGeneral)
        .mockResolvedValueOnce(mockWinnerGeneral);
      (generalRepository.updateBySessionAndNo as jest.Mock).mockResolvedValue(true);

      await processAuction(sessionId);

      expect(auctionRepository.findByFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: sessionId,
          finished: false
        })
      );
      expect(generalRepository.updateBySessionAndNo).toHaveBeenCalledTimes(2);
    });

    it('should handle auction without bidders', async () => {
      const mockAuction = {
        _id: 'auction123',
        session_id: sessionId,
        type: 'UniqueItem',
        closeDate: new Date(Date.now() - 1000),
        finished: false,
        hostGeneralId: 1,
        target: 'w_heaven01',
        bids: [],
        save: jest.fn()
      };

      (auctionRepository.findByFilter as jest.Mock).mockResolvedValue([mockAuction]);

      await processAuction(sessionId);

      expect(mockAuction.save).toHaveBeenCalled();
      expect(mockAuction.finished).toBe(true);
    });

    it('should skip non-expired auctions', async () => {
      (auctionRepository.findByFilter as jest.Mock).mockResolvedValue([]);

      await processAuction(sessionId);

      expect(auctionRepository.findByFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          closeDate: expect.any(Object)
        })
      );
    });
  });

  describe('registerAuction', () => {
    it('should register neutral auctions when conditions met', async () => {
      const mockGenerals = [
        { no: 1, gold: 10000, rice: 10000, data: { gold: 10000, rice: 10000 }, npc: 0 },
        { no: 2, gold: 15000, rice: 15000, data: { gold: 15000, rice: 15000 }, npc: 0 }
      ];

      (generalRepository.findByFilter as jest.Mock).mockResolvedValue(mockGenerals);

      const mockRng = {
        nextBool: jest.fn().mockReturnValue(true),
        nextRangeInt: jest.fn().mockReturnValue(3)
      };

      // Mock KVStorage
      const { KVStorage } = await import('../../../utils/KVStorage');
      jest.spyOn(KVStorage, 'getStorage').mockReturnValue({
        getValue: jest.fn().mockResolvedValue(null),
        setValue: jest.fn().mockResolvedValue(true),
        acquireLock: jest.fn(),
        releaseLock: jest.fn()
      } as any);

      await registerAuction(sessionId, mockRng);

      expect(generalRepository.findByFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: sessionId,
          npc: { $lt: 2 }
        })
      );
    });

    it('should skip registration if last register was recent', async () => {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      const { KVStorage } = await import('../../../utils/KVStorage');
      jest.spyOn(KVStorage, 'getStorage').mockReturnValue({
        getValue: jest.fn().mockResolvedValue(recentTime.toISOString()),
        setValue: jest.fn(),
        acquireLock: jest.fn(),
        releaseLock: jest.fn()
      } as any);

      await registerAuction(sessionId);

      expect(generalRepository.findByFilter).not.toHaveBeenCalled();
    });
  });
});
