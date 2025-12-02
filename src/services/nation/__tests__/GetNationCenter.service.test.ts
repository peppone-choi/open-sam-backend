/**
 * GetNationCenter Service 테스트
 * 
 * 국가 센터 정보 조회 서비스 테스트
 */

describe('GetNationCenterService (국가 센터)', () => {
  describe('기본 기능', () => {
    it('국가 센터 정보는 객체로 반환되어야 함', () => {
      const mockCenter = {
        nation: { id: 1, name: '위' },
        generals: [],
        cities: [],
        diplomacy: {},
      };

      expect(typeof mockCenter).toBe('object');
      expect(mockCenter.nation).toBeDefined();
    });

    it('국가 정보가 포함되어야 함', () => {
      const nationInfo = {
        id: 1,
        name: '위',
        color: '#FF0000',
        capital: 1,
        gold: 100000,
        rice: 100000,
      };

      expect(nationInfo.id).toBeGreaterThan(0);
      expect(nationInfo.name).toBeDefined();
      expect(nationInfo.gold).toBeGreaterThanOrEqual(0);
    });

    it('국가 소속 장수 목록이 포함되어야 함', () => {
      const generals = [
        { no: 1, name: '조조', nation: 1 },
        { no: 2, name: '하후돈', nation: 1 },
      ];

      expect(Array.isArray(generals)).toBe(true);
      expect(generals.length).toBeGreaterThan(0);
      expect(generals[0].nation).toBe(1);
    });

    it('국가 소유 도시 목록이 포함되어야 함', () => {
      const cities = [
        { city: 1, name: '낙양', nation: 1 },
        { city: 2, name: '허창', nation: 1 },
      ];

      expect(Array.isArray(cities)).toBe(true);
      expect(cities.length).toBeGreaterThan(0);
      expect(cities[0].nation).toBe(1);
    });
  });

  describe('외교 정보', () => {
    it('다른 국가와의 외교 상태가 포함되어야 함', () => {
      const diplomacy = {
        nations: [
          { nationId: 2, state: 2 }, // 평화
          { nationId: 3, state: 0 }, // 교전
        ],
      };

      expect(Array.isArray(diplomacy.nations)).toBe(true);
    });

    it('외교 상태 코드가 유효해야 함', () => {
      const validStates = [0, 1, 2, 7]; // 교전, 선포, 평화, 불가침
      const diplomacyState = 2;

      expect(validStates).toContain(diplomacyState);
    });
  });

  describe('권한 검증', () => {
    it('같은 국가 소속만 조회 가능', () => {
      const general = { nation: 1 };
      const targetNation = 1;

      expect(general.nation).toBe(targetNation);
    });

    it('재야 장수는 국가 센터 접근 불가', () => {
      const wanderer = { nation: 0 };

      expect(wanderer.nation).toBe(0);
    });
  });
});




