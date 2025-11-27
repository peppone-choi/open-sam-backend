/**
 * GenType (장수 타입) 분류 테스트
 * 
 * PHP GeneralAI::calcGenType 대응
 * 장수의 능력치를 기반으로 타입을 분류합니다.
 */

import { GenType, DipState, DipStateActionSelector } from '../../../core/DipStateActionSelector';
import {
  createTestGeneral,
  createTestCity,
  createTestNation,
  GeneralPresets,
} from '../../fixtures';

describe('GenType Classification (장수 타입 분류)', () => {
  const defaultPolicy = {
    minWarCrew: 1000,
    properWarTrainAtmos: 80,
    minNPCRecruitCityPopulation: 10000,
    safeRecruitCityPopulationRatio: 0.1,
    minNPCWarLeadership: 60,
    minimumResourceActionAmount: 100,
    cureThreshold: 30,
  };

  const defaultEnv = {
    month: 1,
    year: 185,
    startyear: 184,
    develcost: 100,
    baserice: 100,
  };

  describe('기본 타입 분류', () => {
    it('무력 > 지력이면 t무장 (1)', () => {
      const general = {
        data: {
          leadership: 50,
          strength: 80,  // 무력 높음
          intel: 50,
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        general, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      // 내부 genType 접근 (private이므로 any 캐스팅)
      const genType = (selector as any).genType;
      
      expect(genType & GenType.t무장).toBeTruthy();
      expect(genType & GenType.t지장).toBeFalsy();
    });

    it('지력 > 무력이면 t지장 (2)', () => {
      const general = {
        data: {
          leadership: 50,
          strength: 50,
          intel: 80,  // 지력 높음
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        general, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t지장).toBeTruthy();
      expect(genType & GenType.t무장).toBeFalsy();
    });

    it('통솔 >= minNPCWarLeadership이면 t통솔장 (4) 추가', () => {
      const general = {
        data: {
          leadership: 70,  // minNPCWarLeadership (60) 이상
          strength: 80,
          intel: 50,
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        general, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t통솔장).toBeTruthy();
    });

    it('통솔 < minNPCWarLeadership이면 t통솔장 없음', () => {
      const general = {
        data: {
          leadership: 50,  // minNPCWarLeadership (60) 미만
          strength: 80,
          intel: 50,
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        general, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t통솔장).toBeFalsy();
    });
  });

  describe('복합 타입', () => {
    it('무력과 지력이 비슷하면 복합 타입 가능 (무지장/지무장)', () => {
      // 지력이 무력의 80% 이상이면 확률적으로 복합 타입
      const general = {
        data: {
          leadership: 50,
          strength: 80,
          intel: 75,  // 80 * 0.8 = 64 이상
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      // 여러 seed로 테스트하여 복합 타입이 나오는 경우가 있는지 확인
      let foundComposite = false;
      for (let seed = 1; seed <= 100; seed++) {
        const selector = new DipStateActionSelector(
          general, city, nation, defaultEnv, defaultPolicy, DipState.d평화, seed
        );
        const genType = (selector as any).genType;
        
        if ((genType & GenType.t무장) && (genType & GenType.t지장)) {
          foundComposite = true;
          break;
        }
      }
      
      // 확률적이므로 100번 중 한 번이라도 복합 타입이 나와야 함
      expect(foundComposite).toBe(true);
    });

    it('통솔+무력 조합 (통솔장 무장)', () => {
      const general = {
        data: {
          leadership: 90,  // 높은 통솔
          strength: 85,    // 높은 무력
          intel: 40,       // 낮은 지력
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        general, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t통솔장).toBeTruthy();
      expect(genType & GenType.t무장).toBeTruthy();
      expect(genType & GenType.t지장).toBeFalsy();
    });

    it('통솔+지력 조합 (통솔장 지장)', () => {
      const general = {
        data: {
          leadership: 90,  // 높은 통솔
          strength: 40,    // 낮은 무력
          intel: 85,       // 높은 지력
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        general, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t통솔장).toBeTruthy();
      expect(genType & GenType.t지장).toBeTruthy();
      expect(genType & GenType.t무장).toBeFalsy();
    });
  });

  describe('GenType 상수 값', () => {
    it('GenType.t무장 = 1', () => {
      expect(GenType.t무장).toBe(1);
    });

    it('GenType.t지장 = 2', () => {
      expect(GenType.t지장).toBe(2);
    });

    it('GenType.t통솔장 = 4', () => {
      expect(GenType.t통솔장).toBe(4);
    });

    it('비트 연산으로 복합 타입 표현', () => {
      const warrior = GenType.t무장;  // 1
      const strategist = GenType.t지장;  // 2
      const commander = GenType.t통솔장;  // 4

      // 무장 + 통솔장 = 5
      expect(warrior | commander).toBe(5);
      
      // 지장 + 통솔장 = 6
      expect(strategist | commander).toBe(6);
      
      // 무장 + 지장 = 3
      expect(warrior | strategist).toBe(3);
      
      // 전부 = 7
      expect(warrior | strategist | commander).toBe(7);
    });
  });

  describe('DipState 상수 값', () => {
    it('DipState 열거형 값이 올바르게 정의됨', () => {
      expect(DipState.d평화).toBe(0);
      expect(DipState.d선포).toBe(1);
      expect(DipState.d징병).toBe(2);
      expect(DipState.d직전).toBe(3);
      expect(DipState.d전쟁).toBe(4);
    });
  });

  describe('Preset 장수 타입 분류', () => {
    it('무장 preset은 t무장 타입', () => {
      const general = GeneralPresets.warrior();
      const generalData = {
        data: {
          leadership: general.getVar('leadership'),
          strength: general.getVar('strength'),
          intel: general.getVar('intel'),
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        generalData, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t무장).toBeTruthy();
    });

    it('지장 preset은 t지장 타입', () => {
      const general = GeneralPresets.strategist();
      const generalData = {
        data: {
          leadership: general.getVar('leadership'),
          strength: general.getVar('strength'),
          intel: general.getVar('intel'),
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        generalData, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t지장).toBeTruthy();
    });

    it('통솔장 preset은 t통솔장 타입', () => {
      const general = GeneralPresets.commander();
      const generalData = {
        data: {
          leadership: general.getVar('leadership'),
          strength: general.getVar('strength'),
          intel: general.getVar('intel'),
        },
      };
      const city = { nation: 1, trust: 50, pop: 100000 };
      const nation = { nation: 1, tech: 100 };

      const selector = new DipStateActionSelector(
        generalData, city, nation, defaultEnv, defaultPolicy, DipState.d평화, 12345
      );

      const genType = (selector as any).genType;
      
      expect(genType & GenType.t통솔장).toBeTruthy();
    });
  });
});

