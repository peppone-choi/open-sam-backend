/**
 * NationFinance Service Unit Tests
 */

import { NationFinanceService } from '../NationFinance.service';
import { nationRepository } from '../../../repositories/nation.repository';
import { cityRepository } from '../../../repositories/city.repository';
import { generalRepository } from '../../../repositories/general.repository';

jest.mock('../../../repositories/nation.repository');
jest.mock('../../../repositories/city.repository');
jest.mock('../../../repositories/general.repository');
jest.mock('../../gameEventEmitter');

describe('NationFinance Service', () => {
  const sessionId = 'test_session';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateGoldIncome', () => {
    it('should calculate gold income correctly', async () => {
      const mockNation = {
        data: {
          nation: 1,
          level: 5,
          rate: 10,
          capital: 1,
          type: 'none',
          bill: 100
        }
      };

      const mockCities = [
        {
          data: {
            city: 1,
            nation: 1,
            농업: 1000,
            상업: 1000,
            치안: 1000,
            방어: 1000,
            인구: 10000,
            인구max: 10000
          }
        }
      ];

      const mockGenerals = [
        {
          data: {
            no: 1,
            nation: 1,
            officer_level: 3,
            officer_city: 1,
            city: 1
          }
        }
      ];

      const result = await NationFinanceService.calculateGoldIncome(
        mockNation,
        mockCities,
        mockGenerals
      );

      expect(result).toHaveProperty('income');
      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('net');
      expect(result).toHaveProperty('breakdown');
      expect(typeof result.income).toBe('number');
      expect(typeof result.outcome).toBe('number');
      expect(result.net).toBe(result.income - result.outcome);
    });
  });

  describe('calculateRiceIncome', () => {
    it('should calculate rice income correctly', async () => {
      const mockNation = {
        data: {
          nation: 1,
          level: 5,
          rate: 10,
          capital: 1,
          type: 'none'
        }
      };

      const mockCities = [
        {
          data: {
            city: 1,
            nation: 1,
            농업: 1000,
            상업: 1000,
            치안: 1000,
            방어: 1000,
            인구: 10000,
            인구max: 10000
          }
        }
      ];

      const mockGenerals = [
        {
          data: {
            no: 1,
            nation: 1,
            officer_level: 3,
            officer_city: 1,
            city: 1
          }
        }
      ];

      const result = await NationFinanceService.calculateRiceIncome(
        mockNation,
        mockCities,
        mockGenerals
      );

      expect(result).toHaveProperty('income');
      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('net');
      expect(result).toHaveProperty('breakdown');
      expect(typeof result.income).toBe('number');
      expect(result.outcome).toBe(0); // Rice has no outcome
      expect(result.net).toBe(result.income);
    });
  });

  describe('applyFinanceUpdate', () => {
    it('should apply finance update and broadcast event', async () => {
      const mockNation = {
        data: {
          nation: 1,
          level: 5,
          rate: 10,
          capital: 1,
          type: 'none',
          bill: 100,
          gold: 10000,
          rice: 10000
        }
      };

      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue(mockNation);
      (cityRepository.findByFilter as jest.Mock).mockResolvedValue([]);
      (generalRepository.findByFilter as jest.Mock).mockResolvedValue([]);
      (nationRepository.updateByNationNum as jest.Mock).mockResolvedValue(true);

      await NationFinanceService.applyFinanceUpdate(sessionId, 1, 184, 1);

      expect(nationRepository.updateByNationNum).toHaveBeenCalledWith(
        sessionId,
        1,
        expect.objectContaining({
          $inc: expect.objectContaining({
            'data.gold': expect.any(Number),
            'data.rice': expect.any(Number)
          })
        })
      );
    });
  });
});
