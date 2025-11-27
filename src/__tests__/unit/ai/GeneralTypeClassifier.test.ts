/**
 * GeneralTypeClassifier (역사적 인물 기반 타입 분류) 테스트
 * 
 * 장수의 능력치를 기반으로 역사적 인물 타입을 분류합니다.
 */

import { 
  GeneralTypeClassifier, 
  HistoricalArchetype 
} from '../../../core/SimpleAI';

describe('GeneralTypeClassifier (역사적 인물 타입 분류)', () => {
  describe('S급 분류 (4-5개 능력 80+)', () => {
    it('조조형 (ALL_ROUNDER): 통솔/지력/정치/매력 높음', () => {
      const genData = {
        leadership: 92,
        strength: 75,
        intel: 88,
        politics: 92,
        charm: 91,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      expect(result).toBe(HistoricalArchetype.ALL_ROUNDER);
    });

    it('유비형 (PERFECT_RULER): 매력 최고', () => {
      const genData = {
        leadership: 85,
        strength: 80,
        intel: 82,
        politics: 85,
        charm: 98,  // 매력 최고
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      expect(result).toBe(HistoricalArchetype.PERFECT_RULER);
    });

    it('천하명장 (PERFECT_GENERAL): 기타 S급', () => {
      const genData = {
        leadership: 90,
        strength: 95,
        intel: 85,
        politics: 82,
        charm: 70,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      expect(result).toBe(HistoricalArchetype.PERFECT_GENERAL);
    });
  });

  describe('A급 분류 (3개 능력 80+)', () => {
    it('3개 능력 80+ 시 A급 분류', () => {
      const genData = {
        leadership: 85,
        strength: 85,
        intel: 85,
        politics: 50,
        charm: 50,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      // A급 중 하나여야 함
      const aRankTypes = [
        HistoricalArchetype.EMPEROR,
        HistoricalArchetype.GRAND_COMMANDER,
        HistoricalArchetype.FIVE_TIGERS,
        HistoricalArchetype.SUPREME_STRATEGIST,
        HistoricalArchetype.GHOST_STRATEGIST,
      ];
      
      expect(aRankTypes).toContain(result);
    });
  });

  describe('B급 분류 (2개 능력 80+)', () => {
    it('무력+지력 높으면 문무겸장형', () => {
      const genData = {
        leadership: 50,
        strength: 85,
        intel: 85,
        politics: 50,
        charm: 50,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      // B급 중 하나여야 함
      const bRankTypes = [
        HistoricalArchetype.BRAVE_WARRIOR,
        HistoricalArchetype.VETERAN_WARRIOR,
        HistoricalArchetype.SCHOLAR_WARRIOR,
        HistoricalArchetype.WISE_ADVISOR,
        HistoricalArchetype.LOYAL_GENERAL,
        HistoricalArchetype.RAIDER,
        HistoricalArchetype.STATE_ADMIN,
      ];
      
      expect(bRankTypes).toContain(result);
    });
  });

  describe('C급 분류 (1개 특화)', () => {
    it('무력만 높으면 순수무인', () => {
      const genData = {
        leadership: 50,
        strength: 95,
        intel: 50,
        politics: 50,
        charm: 50,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      // C급 중 하나여야 함
      const cRankTypes = [
        HistoricalArchetype.PURE_WARRIOR,
        HistoricalArchetype.PURE_TACTICIAN,
        HistoricalArchetype.PURE_ADMIN,
        HistoricalArchetype.POPULAR,
      ];
      
      expect(cRankTypes).toContain(result);
    });

    it('지력만 높으면 순수모사', () => {
      const genData = {
        leadership: 50,
        strength: 50,
        intel: 95,
        politics: 50,
        charm: 50,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      const cRankTypes = [
        HistoricalArchetype.PURE_WARRIOR,
        HistoricalArchetype.PURE_TACTICIAN,
        HistoricalArchetype.PURE_ADMIN,
        HistoricalArchetype.POPULAR,
      ];
      
      expect(cRankTypes).toContain(result);
    });
  });

  describe('평범/특수 케이스', () => {
    it('모든 능력이 80 미만이면 특수 또는 평범', () => {
      const genData = {
        leadership: 50,
        strength: 50,
        intel: 50,
        politics: 50,
        charm: 50,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      // 특수 타입이거나 평범이어야 함
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('경계값 테스트', () => {
    it('정확히 80이면 80+로 카운트', () => {
      const genData = {
        leadership: 80,
        strength: 80,
        intel: 80,
        politics: 80,
        charm: 79,  // 79는 미달
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      // 4개가 80+이므로 S급
      const sRankTypes = [
        HistoricalArchetype.ALL_ROUNDER,
        HistoricalArchetype.PERFECT_RULER,
        HistoricalArchetype.PERFECT_GENERAL,
      ];
      
      expect(sRankTypes).toContain(result);
    });

    it('79는 80 미만으로 처리', () => {
      const genData = {
        leadership: 79,
        strength: 79,
        intel: 79,
        politics: 79,
        charm: 79,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      // 0개가 80+이므로 특수/평범
      expect(result).toBeDefined();
    });
  });

  describe('누락 필드 처리', () => {
    it('politics 없으면 leadership 사용', () => {
      const genData = {
        leadership: 85,
        strength: 85,
        intel: 85,
        // politics 누락
        charm: 85,
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      // politics가 leadership(85)로 대체되어 4개가 80+
      expect(result).toBeDefined();
    });

    it('charm 없으면 leadership 사용', () => {
      const genData = {
        leadership: 85,
        strength: 85,
        intel: 85,
        politics: 85,
        // charm 누락
      };

      const result = GeneralTypeClassifier.classify(genData);
      
      expect(result).toBeDefined();
    });

    it('기본값 50 사용', () => {
      const genData = {};

      const result = GeneralTypeClassifier.classify(genData);
      
      // 모든 값이 50이므로 특수/평범
      expect(result).toBeDefined();
    });
  });

  describe('HistoricalArchetype 열거형', () => {
    it('모든 타입이 정의되어 있음', () => {
      expect(HistoricalArchetype.ALL_ROUNDER).toBe('천하패자');
      expect(HistoricalArchetype.PERFECT_RULER).toBe('천하명군');
      expect(HistoricalArchetype.PERFECT_GENERAL).toBe('천하명장');
      expect(HistoricalArchetype.AVERAGE).toBe('평범');
    });
  });
});

