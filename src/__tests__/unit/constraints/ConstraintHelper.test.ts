/**
 * Constraint Helper 테스트
 * 
 * PHP ConstraintHelper 대응 테스트
 * 모든 제약 조건의 동작을 검증합니다.
 */

import { ConstraintHelper } from '../../../constraints/ConstraintHelper';
import {
  createTestGeneral,
  createTestCity,
  createTestNation,
  createTestEnv,
  GeneralPresets,
  CityPresets,
  NationPresets,
} from '../../fixtures';

describe('ConstraintHelper', () => {
  describe('BeLord (군주 검증)', () => {
    const constraint = ConstraintHelper.BeLord();

    it('군주(officer_level=12)는 통과', () => {
      const general = createTestGeneral({ officer_level: 12 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('수뇌부(officer_level=5~11)는 실패', () => {
      for (let level = 5; level <= 11; level++) {
        const general = createTestGeneral({ officer_level: level });
        const result = constraint.test({ general }, {});
        expect(result).toBe('군주만 가능합니다.');
      }
    });

    it('일반 장수(officer_level<5)는 실패', () => {
      const general = createTestGeneral({ officer_level: 1 });
      const result = constraint.test({ general }, {});
      expect(result).toBe('군주만 가능합니다.');
    });

    it('재야 장수(officer_level=0)는 실패', () => {
      const general = createTestGeneral({ officer_level: 0 });
      const result = constraint.test({ general }, {});
      expect(result).toBe('군주만 가능합니다.');
    });
  });

  describe('BeChief (수뇌부 검증)', () => {
    const constraint = ConstraintHelper.BeChief();

    it('군주(officer_level=12)는 통과', () => {
      const general = createTestGeneral({ officer_level: 12 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('수뇌부(officer_level=5~11)는 통과', () => {
      for (let level = 5; level <= 11; level++) {
        const general = createTestGeneral({ officer_level: level });
        const result = constraint.test({ general }, {});
        expect(result).toBeNull();
      }
    });

    it('일반 장수(officer_level<5)는 실패', () => {
      for (let level = 0; level <= 4; level++) {
        const general = createTestGeneral({ officer_level: level });
        const result = constraint.test({ general }, {});
        expect(result).toBe('수뇌부만 가능합니다.');
      }
    });
  });

  describe('NotChief (수뇌부 아님 검증)', () => {
    const constraint = ConstraintHelper.NotChief();

    it('일반 장수(officer_level<=4)는 통과', () => {
      for (let level = 0; level <= 4; level++) {
        const general = createTestGeneral({ officer_level: level });
        const result = constraint.test({ general }, {});
        expect(result).toBeNull();
      }
    });

    it('수뇌부(officer_level>=5)는 실패', () => {
      for (let level = 5; level <= 12; level++) {
        const general = createTestGeneral({ officer_level: level });
        const result = constraint.test({ general }, {});
        expect(result).toBe('수뇌입니다.');
      }
    });
  });

  describe('NotLord (군주 아님 검증)', () => {
    const constraint = ConstraintHelper.NotLord();

    it('일반 장수/수뇌부는 통과', () => {
      for (let level = 0; level <= 11; level++) {
        const general = createTestGeneral({ officer_level: level });
        const result = constraint.test({ general }, {});
        expect(result).toBeNull();
      }
    });

    it('군주(officer_level=12)는 실패', () => {
      const general = createTestGeneral({ officer_level: 12 });
      const result = constraint.test({ general }, {});
      expect(result).toBe('군주입니다.');
    });
  });

  describe('NotBeNeutral (재야 아님 검증)', () => {
    const constraint = ConstraintHelper.NotBeNeutral();

    it('소속 국가가 있으면 통과', () => {
      const general = createTestGeneral({ nation: 1 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('재야(nation=0)는 실패', () => {
      const general = GeneralPresets.wanderer();
      const result = constraint.test({ general }, {});
      expect(result).toBe('재야는 불가능합니다.');
    });
  });

  describe('OccupiedCity (점령 도시 검증)', () => {
    const constraint = ConstraintHelper.OccupiedCity();

    it('아국 도시면 통과', () => {
      const general = createTestGeneral({ nation: 1 });
      const city = createTestCity({ nation: 1 });
      const result = constraint.test({ general, city }, {});
      expect(result).toBeNull();
    });

    it('다른 국가 도시면 실패', () => {
      const general = createTestGeneral({ nation: 1 });
      const city = createTestCity({ nation: 2 });
      const result = constraint.test({ general, city }, {});
      expect(result).toBe('아국 도시가 아닙니다.');
    });

    it('중립 도시면 실패', () => {
      const general = createTestGeneral({ nation: 1 });
      const city = CityPresets.neutral();
      const result = constraint.test({ general, city }, {});
      expect(result).toBe('아국 도시가 아닙니다.');
    });
  });

  describe('SuppliedCity (보급 도시 검증)', () => {
    const constraint = ConstraintHelper.SuppliedCity();

    it('보급 연결된 도시면 통과', () => {
      const city = createTestCity({ supply: 1 });
      const result = constraint.test({ city }, {});
      expect(result).toBeNull();
    });

    it('보급 끊긴 도시면 실패', () => {
      const city = CityPresets.cutOff();
      const result = constraint.test({ city }, {});
      expect(result).toBe('보급이 끊긴 도시입니다.');
    });
  });

  describe('ReqGeneralGold (자금 요구)', () => {
    it('충분한 자금이면 통과', () => {
      const constraint = ConstraintHelper.ReqGeneralGold(1000);
      const general = createTestGeneral({ gold: 5000 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('정확히 필요한 만큼 있으면 통과', () => {
      const constraint = ConstraintHelper.ReqGeneralGold(1000);
      const general = createTestGeneral({ gold: 1000 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('자금 부족이면 실패', () => {
      const constraint = ConstraintHelper.ReqGeneralGold(1000);
      const general = createTestGeneral({ gold: 500 });
      const result = constraint.test({ general }, {});
      expect(result).toContain('자금이 부족합니다');
    });

    it('자금이 0이면 실패', () => {
      const constraint = ConstraintHelper.ReqGeneralGold(100);
      const general = GeneralPresets.poor();
      const result = constraint.test({ general }, {});
      expect(result).toContain('자금이 부족합니다');
    });
  });

  describe('ReqGeneralRice (군량 요구)', () => {
    it('충분한 군량이면 통과', () => {
      const constraint = ConstraintHelper.ReqGeneralRice(1000);
      const general = createTestGeneral({ rice: 5000 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('군량 부족이면 실패', () => {
      const constraint = ConstraintHelper.ReqGeneralRice(1000);
      const general = createTestGeneral({ rice: 500 });
      const result = constraint.test({ general }, {});
      expect(result).toContain('군량이 부족합니다');
    });
  });

  describe('ReqGeneralCrew (병력 요구)', () => {
    const constraint = ConstraintHelper.ReqGeneralCrew();

    it('병력이 있으면 통과', () => {
      const general = createTestGeneral({ crew: 1000 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('병력이 없으면 실패', () => {
      const general = createTestGeneral({ crew: 0 });
      const result = constraint.test({ general }, {});
      expect(result).toBe('병사가 없습니다.');
    });
  });

  describe('ReqGeneralTrainMargin (훈련 여유)', () => {
    it('훈련도가 최대치 미만이면 통과', () => {
      const constraint = ConstraintHelper.ReqGeneralTrainMargin(100);
      const general = createTestGeneral({ train: 80 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('훈련도가 최대치면 실패', () => {
      const constraint = ConstraintHelper.ReqGeneralTrainMargin(100);
      const general = createTestGeneral({ train: 100 });
      const result = constraint.test({ general }, {});
      expect(result).toContain('훈련도가 이미 최대치');
    });
  });

  describe('ReqGeneralAtmosMargin (사기 여유)', () => {
    it('사기가 최대치 미만이면 통과', () => {
      const constraint = ConstraintHelper.ReqGeneralAtmosMargin(100);
      const general = createTestGeneral({ atmos: 80 });
      const result = constraint.test({ general }, {});
      expect(result).toBeNull();
    });

    it('사기가 최대치면 실패', () => {
      const constraint = ConstraintHelper.ReqGeneralAtmosMargin(100);
      const general = createTestGeneral({ atmos: 100 });
      const result = constraint.test({ general }, {});
      expect(result).toContain('사기가 이미 최대치');
    });
  });

  describe('NotCapital (수도 아님 검증)', () => {
    it('수도가 아닌 도시면 통과', () => {
      const constraint = ConstraintHelper.NotCapital();
      const general = createTestGeneral({ city: 2, officer_level: 1 });
      const nation = createTestNation({ capital: 1 });
      const result = constraint.test({ general, nation }, {});
      expect(result).toBeNull();
    });

    it('수도면 실패', () => {
      const constraint = ConstraintHelper.NotCapital();
      const general = createTestGeneral({ city: 1, officer_level: 1 });
      const nation = createTestNation({ capital: 1 });
      const result = constraint.test({ general, nation }, {});
      expect(result).toBe('이미 수도입니다.');
    });

    it('ignoreOfficer=true이고 태수(level 2~4)면 수도여도 통과', () => {
      const constraint = ConstraintHelper.NotCapital(true);
      const general = createTestGeneral({ city: 1, officer_level: 3 });
      const nation = createTestNation({ capital: 1 });
      const result = constraint.test({ general, nation }, {});
      expect(result).toBeNull();
    });
  });

  describe('RemainCityCapacity (도시 용량 여유)', () => {
    it('용량이 남아있으면 통과', () => {
      const constraint = ConstraintHelper.RemainCityCapacity('agri', '농업');
      const city = createTestCity({ agri: 500, agri_max: 1000 });
      const result = constraint.test({ city }, {});
      expect(result).toBeNull();
    });

    it('용량이 가득 차면 실패', () => {
      const constraint = ConstraintHelper.RemainCityCapacity('agri', '농업');
      const city = createTestCity({ agri: 1000, agri_max: 1000 });
      const result = constraint.test({ city }, {});
      expect(result).toContain('농업');
      expect(result).toContain('용량이 가득');
    });
  });

  describe('WanderingNation (유랑 세력 검증)', () => {
    it('유랑 세력(type=1)이면 통과', () => {
      const constraint = ConstraintHelper.WanderingNation();
      const nation = createTestNation({ type: 1 });
      const result = constraint.test({ nation }, {});
      expect(result).toBeNull();
    });

    it('일반 국가면 실패', () => {
      const constraint = ConstraintHelper.WanderingNation();
      const nation = createTestNation({ type: 0 });
      const result = constraint.test({ nation }, {});
      expect(result).toBe('유랑 세력만 가능합니다.');
    });
  });

  describe('NotWanderingNation (유랑 세력 아님 검증)', () => {
    it('일반 국가면 통과', () => {
      const constraint = ConstraintHelper.NotWanderingNation();
      const nation = createTestNation({ type: 0 });
      const result = constraint.test({ nation }, {});
      expect(result).toBeNull();
    });

    it('유랑 세력이면 실패', () => {
      const constraint = ConstraintHelper.NotWanderingNation();
      const nation = createTestNation({ type: 1 });
      const result = constraint.test({ nation }, {});
      expect(result).toBe('유랑 세력은 불가능합니다.');
    });
  });

  describe('Preset 조합 테스트', () => {
    it('일반 장수는 기본 제약 조건 통과', () => {
      const general = GeneralPresets.normal();
      general.setCity(CityPresets.occupied());
      general.setNation(NationPresets.basic());

      // NotBeNeutral 통과
      expect(ConstraintHelper.NotBeNeutral().test({ general }, {})).toBeNull();
      
      // OccupiedCity 통과
      const city = general.getCity();
      expect(ConstraintHelper.OccupiedCity().test({ general, city }, {})).toBeNull();
      
      // SuppliedCity 통과
      expect(ConstraintHelper.SuppliedCity().test({ city }, {})).toBeNull();
    });

    it('빈곤한 장수는 자원 제약에서 실패', () => {
      const general = GeneralPresets.poor();
      
      expect(ConstraintHelper.ReqGeneralGold(100).test({ general }, {}))
        .toContain('자금이 부족합니다');
      expect(ConstraintHelper.ReqGeneralRice(100).test({ general }, {}))
        .toContain('군량이 부족합니다');
      expect(ConstraintHelper.ReqGeneralCrew().test({ general }, {}))
        .toBe('병사가 없습니다.');
    });

    it('군주 preset은 BeLord/BeChief 통과', () => {
      const general = GeneralPresets.lord();
      
      expect(ConstraintHelper.BeLord().test({ general }, {})).toBeNull();
      expect(ConstraintHelper.BeChief().test({ general }, {})).toBeNull();
    });

    it('재야 장수 preset은 NotBeNeutral 실패', () => {
      const general = GeneralPresets.wanderer();
      
      expect(ConstraintHelper.NotBeNeutral().test({ general }, {}))
        .toBe('재야는 불가능합니다.');
    });
  });
});

