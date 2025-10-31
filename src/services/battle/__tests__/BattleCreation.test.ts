import { BattleCreationService } from '../BattleCreation.service';
import { BattleInstance } from '../../../models/battle-instance.model';
import { BattleMapTemplate } from '../../../models/battle-map-template.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { Nation } from '../../../models/nation.model';

describe('BattleCreationService', () => {
  describe('createBattle', () => {
    it('전투 인스턴스를 생성해야 함', async () => {
      const params = {
        sessionId: 'test_session',
        attackerNationId: 1,
        defenderNationId: 2,
        cityId: 10,
        attackerGenerals: [1, 2],
        defenderGenerals: [3, 4],
        entryDirection: 'north' as const
      };

      const result = await BattleCreationService.createBattle(params);

      expect(result.success).toBe(true);
      expect(result.battleId).toBeDefined();
      expect(result.battle).toBeDefined();
    });
  });

  describe('getAvailableEntryDirections', () => {
    it('맵 템플릿이 없으면 기본 방향을 반환해야 함', async () => {
      const directions = await BattleCreationService.getAvailableEntryDirections(
        'test_session',
        999
      );

      expect(directions).toEqual(['north', 'east', 'south', 'west']);
    });
  });

  describe('calculateParticipatingForces', () => {
    it('참전 병력을 계산해야 함', async () => {
      const forces = await BattleCreationService.calculateParticipatingForces(
        'test_session',
        10,
        1
      );

      expect(forces.generals).toBeDefined();
      expect(forces.totalCrew).toBeGreaterThanOrEqual(0);
      expect(forces.generalCount).toBeGreaterThanOrEqual(0);
    });
  });
});
