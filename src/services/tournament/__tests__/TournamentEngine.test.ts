/**
 * TournamentEngine Service Unit Tests
 */

import { processTournament } from '../TournamentEngine.service';
import { Tournament } from '../../../models/tournament.model';
import { KVStorage } from '../../../utils/KVStorage';

jest.mock('../../../models/tournament.model');
jest.mock('../../../utils/KVStorage');
jest.mock('../../gameEventEmitter');

describe('TournamentEngine Service', () => {
  const sessionId = 'test_session';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processTournament', () => {
    it('should skip processing when tournament_auto is false', async () => {
      const mockGameStor = {
        getValue: jest.fn()
          .mockResolvedValueOnce(2) // tournament
          .mockResolvedValueOnce(0) // phase
          .mockResolvedValueOnce(0) // tnmt_type
          .mockResolvedValueOnce(false), // tnmt_auto = false
        setValue: jest.fn()
      };

      jest.spyOn(KVStorage, 'getStorage').mockReturnValue(mockGameStor as any);

      await processTournament(sessionId);

      expect(mockGameStor.setValue).not.toHaveBeenCalled();
    });

    it('should advance from state 1 (signup closed) to state 2 (qualification)', async () => {
      const mockGameStor = {
        getValue: jest.fn()
          .mockResolvedValueOnce(1) // tournament = 1
          .mockResolvedValueOnce(0) // phase
          .mockResolvedValueOnce(0) // tnmt_type
          .mockResolvedValueOnce(true) // tnmt_auto
          .mockResolvedValueOnce(new Date().toISOString()) // tnmt_time (과거)
          .mockResolvedValueOnce(60), // turnTerm
        setValue: jest.fn(),
        getValuesAsArray: jest.fn()
      };

      jest.spyOn(KVStorage, 'getStorage').mockReturnValue(mockGameStor as any);
      (Tournament.aggregate as jest.Mock).mockResolvedValue([]);
      (Tournament.insertMany as jest.Mock).mockResolvedValue([]);

      await processTournament(sessionId);

      expect(mockGameStor.setValue).toHaveBeenCalledWith('tournament', expect.any(Number));
    });

    it('should not process if scheduled time has not arrived', async () => {
      const futureTime = new Date(Date.now() + 60000); // 1 minute in future

      const mockGameStor = {
        getValue: jest.fn()
          .mockResolvedValueOnce(2) // tournament
          .mockResolvedValueOnce(0) // phase
          .mockResolvedValueOnce(0) // tnmt_type
          .mockResolvedValueOnce(true) // tnmt_auto
          .mockResolvedValueOnce(futureTime.toISOString()), // tnmt_time
        setValue: jest.fn()
      };

      jest.spyOn(KVStorage, 'getStorage').mockReturnValue(mockGameStor as any);

      await processTournament(sessionId);

      expect(mockGameStor.setValue).not.toHaveBeenCalled();
    });
  });
});
