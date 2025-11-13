/**
 * 권한 체크 헬퍼 테스트
 * PHP func.php의 checkSecretPermission 함수 테스트
 */

import { checkPermission, PermissionResult } from '../permission-helper';

describe('checkPermission', () => {
  describe('재야 장수 (nationId=0)', () => {
    it('should block access for ronin general', () => {
      const general = {
        data: {
          nation: 0,
          officer_level: 0,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(-1);
      expect(result.canAccessBoard).toBe(false);
      expect(result.canAccessSecret).toBe(false);
      expect(result.canAccessNation).toBe(false);
      expect(result.message).toContain('국가에 소속되어있지 않습니다');
    });
  });

  describe('관직이 없는 장수 (officer_level=0)', () => {
    it('should block access for general without officer position', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 0, // 관직 없음
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(-1);
      expect(result.canAccessBoard).toBe(false); // ← 중요: 회의실 차단
      expect(result.canAccessSecret).toBe(false);
      expect(result.canAccessNation).toBe(false);
      expect(result.message).toContain('관직이 없습니다');
    });

    it('should block access even if nation exists', () => {
      const general = {
        data: {
          nation: 5,
          officer_level: 0,
          name: '테스트장수',
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(-1);
      expect(result.canAccessBoard).toBe(false);
    });
  });

  describe('수뇌부 벌칙 (penalty.NoChief)', () => {
    it('should allow board access but block secret access', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 5,
          penalty: {
            NoChief: true,
          }
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(0);
      expect(result.canAccessBoard).toBe(true);  // 회의실은 가능
      expect(result.canAccessSecret).toBe(false); // 기밀실은 차단
      expect(result.canAccessNation).toBe(false);
    });
  });

  describe('일반 관직자 (officer_level=1)', () => {
    it('should allow board access but block secret access', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 1,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(1);
      expect(result.canAccessBoard).toBe(true);  // 회의실 가능
      expect(result.canAccessSecret).toBe(false); // 기밀실 차단
      expect(result.canAccessNation).toBe(false); // 국가 기능 차단
    });
  });

  describe('일반 관직자 (officer_level=2-4)', () => {
    it('should allow board access for officer_level=2', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 2,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(1);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(false);
    });

    it('should allow board access for officer_level=4', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 4,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(1);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(false);
    });
  });

  describe('수뇌부 (officer_level>=5)', () => {
    it('should allow all access for officer_level=5', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 5,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(2);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(true);  // 기밀실 가능
      expect(result.canAccessNation).toBe(true);  // 국가 기능 가능
    });

    it('should allow all access for officer_level=10', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 10,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(2);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(true);
      expect(result.canAccessNation).toBe(true);
    });
  });

  describe('감찰관 (permission=auditor)', () => {
    it('should have level 3 access', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 3,
          permission: 'auditor',
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(3);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(true);
      expect(result.canAccessNation).toBe(true);
    });
  });

  describe('외교관 (permission=ambassador)', () => {
    it('should have level 4 access', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 3,
          permission: 'ambassador',
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(4);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(true);
      expect(result.canAccessNation).toBe(true);
    });
  });

  describe('군주 (officer_level=12)', () => {
    it('should have level 4 access', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 12,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(4);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(true);
      expect(result.canAccessNation).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle general without data object', () => {
      const general = {
        nation: 1,
        officer_level: 5,
      };

      const result = checkPermission(general);

      expect(result.level).toBe(2);
      expect(result.canAccessBoard).toBe(true);
    });

    it('should handle undefined nation as 0', () => {
      const general = {
        data: {
          officer_level: 5,
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(-1);
      expect(result.canAccessBoard).toBe(false);
    });

    it('should handle penalty.no_chief (snake_case)', () => {
      const general = {
        data: {
          nation: 1,
          officer_level: 5,
          penalty: {
            no_chief: true,
          }
        }
      };

      const result = checkPermission(general);

      expect(result.level).toBe(0);
      expect(result.canAccessBoard).toBe(true);
      expect(result.canAccessSecret).toBe(false);
    });
  });
});
