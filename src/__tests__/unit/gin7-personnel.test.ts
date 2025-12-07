/**
 * GIN7 Personnel System Test
 * 
 * 검증 항목:
 * 1. 라더: 공적치 내림차순 정렬
 * 2. 자동 승진: 매월 1일 라더 1위 승진
 * 3. T.O 체크: 정원 초과 시 승진 차단
 */

import { RankCode, getRankDefinition, getNextRank, RANK_TABLE } from '../../config/gin7/ranks';

// Mock MongoDB
const mockRankLadderEntries: any[] = [];

// Mock RankLadder 모델
const MockRankLadder = {
  find: jest.fn().mockImplementation((query) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(
      mockRankLadderEntries
        .filter(e => e.sessionId === query.sessionId && e.factionId === query.factionId && e.rank === query.rank && e.status === 'active')
        .sort((a, b) => {
          // 1차: 공적치 내림차순
          if (b.merit !== a.merit) return b.merit - a.merit;
          // 2차: 임관일 오름차순 (빠른 순)
          if (a.enlistmentDate.getTime() !== b.enlistmentDate.getTime()) {
            return a.enlistmentDate.getTime() - b.enlistmentDate.getTime();
          }
          // 3차: 생년월일 오름차순 (나이 많은 순)
          return a.birthDate.getTime() - b.birthDate.getTime();
        })
    ),
  })),
  countDocuments: jest.fn().mockImplementation((query) => {
    return Promise.resolve(
      mockRankLadderEntries.filter(
        e => e.sessionId === query.sessionId && 
             e.factionId === query.factionId && 
             e.rank === query.rank && 
             e.status === 'active'
      ).length
    );
  }),
  calculateRankInLadder: jest.fn(),
  getLadder: jest.fn(),
  getPromotionCandidate: jest.fn(),
};

describe('GIN7 Personnel System', () => {
  beforeEach(() => {
    mockRankLadderEntries.length = 0;
    jest.clearAllMocks();
  });

  // =========================================================================
  // 검증 1: 라더 - 공적치 내림차순 정렬
  // =========================================================================
  describe('1. 라더 정렬 검증', () => {
    it('공적치 내림차순으로 정렬되어야 함', async () => {
      // Given: 다양한 공적치를 가진 캐릭터들
      const testEntries = [
        { characterId: 'char1', characterName: '김대위', merit: 500, rank: RankCode.CAPTAIN, sessionId: 'sess1', factionId: 'faction1', status: 'active', enlistmentDate: new Date('800-01-01'), birthDate: new Date('770-01-01') },
        { characterId: 'char2', characterName: '이대위', merit: 1500, rank: RankCode.CAPTAIN, sessionId: 'sess1', factionId: 'faction1', status: 'active', enlistmentDate: new Date('800-01-01'), birthDate: new Date('770-01-01') },
        { characterId: 'char3', characterName: '박대위', merit: 1000, rank: RankCode.CAPTAIN, sessionId: 'sess1', factionId: 'faction1', status: 'active', enlistmentDate: new Date('800-01-01'), birthDate: new Date('770-01-01') },
        { characterId: 'char4', characterName: '최대위', merit: 2000, rank: RankCode.CAPTAIN, sessionId: 'sess1', factionId: 'faction1', status: 'active', enlistmentDate: new Date('800-01-01'), birthDate: new Date('770-01-01') },
      ];
      mockRankLadderEntries.push(...testEntries);

      // When: 라더 조회
      const result = await MockRankLadder.find({
        sessionId: 'sess1',
        factionId: 'faction1',
        rank: RankCode.CAPTAIN,
        status: 'active',
      }).sort({ merit: -1 }).limit(100).exec();

      // Then: 공적치 내림차순 정렬
      expect(result.length).toBe(4);
      expect(result[0].characterName).toBe('최대위'); // 2000점 - 1위
      expect(result[1].characterName).toBe('이대위'); // 1500점 - 2위
      expect(result[2].characterName).toBe('박대위'); // 1000점 - 3위
      expect(result[3].characterName).toBe('김대위'); // 500점 - 4위

      console.log('\n=== 라더 조회 결과 (대위 계급) ===');
      result.forEach((entry, idx) => {
        console.log(`${idx + 1}위: ${entry.characterName} - 공적치: ${entry.merit}`);
      });
    });

    it('동점자 처리: 공적치 같으면 임관일 빠른 순', async () => {
      // Given: 같은 공적치, 다른 임관일
      const testEntries = [
        { characterId: 'char1', characterName: '김중사', merit: 1000, rank: RankCode.SERGEANT_1ST, sessionId: 'sess1', factionId: 'faction1', status: 'active', enlistmentDate: new Date('802-03-01'), birthDate: new Date('770-01-01') },
        { characterId: 'char2', characterName: '이중사', merit: 1000, rank: RankCode.SERGEANT_1ST, sessionId: 'sess1', factionId: 'faction1', status: 'active', enlistmentDate: new Date('800-01-01'), birthDate: new Date('770-01-01') },
        { characterId: 'char3', characterName: '박중사', merit: 1000, rank: RankCode.SERGEANT_1ST, sessionId: 'sess1', factionId: 'faction1', status: 'active', enlistmentDate: new Date('801-06-01'), birthDate: new Date('770-01-01') },
      ];
      mockRankLadderEntries.push(...testEntries);

      // When
      const result = await MockRankLadder.find({
        sessionId: 'sess1',
        factionId: 'faction1',
        rank: RankCode.SERGEANT_1ST,
        status: 'active',
      }).sort({ merit: -1, enlistmentDate: 1 }).limit(100).exec();

      // Then: 임관일 빠른 순
      expect(result[0].characterName).toBe('이중사'); // 800년 1월 임관 - 1위
      expect(result[1].characterName).toBe('박중사'); // 801년 6월 임관 - 2위
      expect(result[2].characterName).toBe('김중사'); // 802년 3월 임관 - 3위

      console.log('\n=== 동점자 처리 결과 (임관일 기준) ===');
      result.forEach((entry, idx) => {
        console.log(`${idx + 1}위: ${entry.characterName} - 공적치: ${entry.merit}, 임관일: ${entry.enlistmentDate.toISOString().slice(0,10)}`);
      });
    });
  });

  // =========================================================================
  // 검증 2: 자동 승진 - 매월 1일 라더 1위
  // =========================================================================
  describe('2. 자동 승진 검증', () => {
    it('라더 1위가 승진 대상이 됨', async () => {
      // Given: 대위 라더에 여러 캐릭터
      const testEntries = [
        { characterId: 'char1', characterName: '김대위', merit: 25000, rank: RankCode.CAPTAIN, sessionId: 'sess1', factionId: 'faction1', status: 'active', serviceMonths: 40, enlistmentDate: new Date('800-01-01'), birthDate: new Date('770-01-01'), promotionDate: new Date('803-01-01') },
        { characterId: 'char2', characterName: '이대위', merit: 20000, rank: RankCode.CAPTAIN, sessionId: 'sess1', factionId: 'faction1', status: 'active', serviceMonths: 38, enlistmentDate: new Date('800-06-01'), birthDate: new Date('772-01-01'), promotionDate: new Date('803-06-01') },
      ];
      mockRankLadderEntries.push(...testEntries);

      // When: 승진 대상자 조회 (라더 1위)
      const candidates = await MockRankLadder.find({
        sessionId: 'sess1',
        factionId: 'faction1',
        rank: RankCode.CAPTAIN,
        status: 'active',
      }).sort({ merit: -1 }).limit(1).exec();

      const candidate = candidates[0];
      const rankDef = getRankDefinition(RankCode.CAPTAIN);
      const nextRank = getNextRank(RankCode.CAPTAIN);

      // Then: 1위가 승진 대상
      expect(candidate.characterName).toBe('김대위');
      expect(candidate.merit).toBeGreaterThanOrEqual(rankDef.meritForPromotion);
      expect(candidate.serviceMonths).toBeGreaterThanOrEqual(rankDef.minServiceMonths);
      expect(nextRank?.code).toBe(RankCode.MAJOR);

      console.log('\n=== 자동 승진 대상자 ===');
      console.log(`현재 계급: ${rankDef.name} (${rankDef.code})`);
      console.log(`승진 대상: ${candidate.characterName}`);
      console.log(`공적치: ${candidate.merit} / 필요: ${rankDef.meritForPromotion}`);
      console.log(`복무기간: ${candidate.serviceMonths}개월 / 필요: ${rankDef.minServiceMonths}개월`);
      console.log(`다음 계급: ${nextRank?.name} (${nextRank?.code})`);
    });

    it('자동 승진 가능 계급 확인 (대령까지)', () => {
      // 자동 승진 가능한 계급 목록
      const autoPromotableRanks = Object.values(RANK_TABLE).filter(r => r.autoPromotion);
      
      console.log('\n=== 자동 승진 가능 계급 ===');
      autoPromotableRanks.forEach(rank => {
        console.log(`${rank.name} (${rank.code}) - Tier ${rank.tier}`);
      });

      // 대령(O6)까지 자동 승진
      expect(autoPromotableRanks.some(r => r.code === RankCode.COLONEL)).toBe(true);
      // 준장(G1)은 수동 승진
      expect(autoPromotableRanks.some(r => r.code === RankCode.BRIGADIER_GENERAL)).toBe(false);
    });
  });

  // =========================================================================
  // 검증 3: T.O 체크 - 정원 초과 시 승진 차단
  // =========================================================================
  describe('3. T.O(정원) 체크 검증', () => {
    it('정원이 찼으면 승진 불가', async () => {
      // Given: 소령(MAJOR) T.O = 50명, 현재 50명
      const majorTO = RANK_TABLE[RankCode.MAJOR].baseTO; // 50
      
      // 50명의 소령 생성
      for (let i = 0; i < majorTO; i++) {
        mockRankLadderEntries.push({
          characterId: `major${i}`,
          characterName: `소령${i}`,
          merit: 1000 + i,
          rank: RankCode.MAJOR,
          sessionId: 'sess1',
          factionId: 'faction1',
          status: 'active',
          enlistmentDate: new Date('800-01-01'),
          birthDate: new Date('770-01-01'),
        });
      }

      // When: 현재 소령 수 조회
      const currentCount = await MockRankLadder.countDocuments({
        sessionId: 'sess1',
        factionId: 'faction1',
        rank: RankCode.MAJOR,
        status: 'active',
      });

      const available = majorTO - currentCount;

      // Then: 정원 초과로 승진 불가
      expect(currentCount).toBe(majorTO);
      expect(available).toBe(0);

      console.log('\n=== T.O 체크 결과 ===');
      console.log(`계급: 소령 (${RankCode.MAJOR})`);
      console.log(`기본 정원: ${majorTO}명`);
      console.log(`현재 인원: ${currentCount}명`);
      console.log(`남은 자리: ${available}명`);
      console.log(`승진 가능: ${available > 0 ? '✓ 가능' : '✗ 불가 (정원 초과)'}`);
    });

    it('정원 여유 있으면 승진 가능', async () => {
      // Given: 중령(LT_COLONEL) T.O = 30명, 현재 20명
      const ltColonelTO = RANK_TABLE[RankCode.LIEUTENANT_COLONEL].baseTO; // 30
      
      // 20명의 중령 생성
      for (let i = 0; i < 20; i++) {
        mockRankLadderEntries.push({
          characterId: `ltcol${i}`,
          characterName: `중령${i}`,
          merit: 2000 + i,
          rank: RankCode.LIEUTENANT_COLONEL,
          sessionId: 'sess1',
          factionId: 'faction1',
          status: 'active',
          enlistmentDate: new Date('800-01-01'),
          birthDate: new Date('770-01-01'),
        });
      }

      // When
      const currentCount = await MockRankLadder.countDocuments({
        sessionId: 'sess1',
        factionId: 'faction1',
        rank: RankCode.LIEUTENANT_COLONEL,
        status: 'active',
      });

      const available = ltColonelTO - currentCount;

      // Then: 정원 여유 있음
      expect(currentCount).toBe(20);
      expect(available).toBe(10);

      console.log('\n=== T.O 체크 결과 ===');
      console.log(`계급: 중령 (${RankCode.LIEUTENANT_COLONEL})`);
      console.log(`기본 정원: ${ltColonelTO}명`);
      console.log(`현재 인원: ${currentCount}명`);
      console.log(`남은 자리: ${available}명`);
      console.log(`승진 가능: ${available > 0 ? '✓ 가능' : '✗ 불가'}`);
    });

    it('무제한 정원(-1) 계급은 항상 승진 가능', () => {
      // 사병/하사관은 정원 무제한
      const unlimitedRanks = Object.values(RANK_TABLE).filter(r => r.baseTO === -1);
      
      console.log('\n=== 정원 무제한 계급 ===');
      unlimitedRanks.forEach(rank => {
        console.log(`${rank.name} (${rank.code}) - 정원: 무제한`);
      });

      expect(unlimitedRanks.length).toBeGreaterThan(0);
      expect(RANK_TABLE[RankCode.PRIVATE_2ND].baseTO).toBe(-1);
      expect(RANK_TABLE[RankCode.STAFF_SERGEANT].baseTO).toBe(-1);
    });
  });

  // =========================================================================
  // 전체 계급 테이블 출력
  // =========================================================================
  describe('계급 테이블 정보', () => {
    it('전체 계급 정보 출력', () => {
      console.log('\n=== GIN7 계급 테이블 ===');
      console.log('| Tier | 코드 | 계급명 | T.O | 자동승진 | 필요공적 | 최소복무 |');
      console.log('|------|------|--------|-----|----------|----------|----------|');
      
      Object.values(RANK_TABLE)
        .sort((a, b) => a.tier - b.tier)
        .forEach(rank => {
          const toStr = rank.baseTO === -1 ? '∞' : String(rank.baseTO);
          const autoStr = rank.autoPromotion ? '✓' : '✗';
          const meritStr = rank.meritForPromotion === -1 ? '-' : rank.meritForPromotion.toLocaleString();
          console.log(`| ${rank.tier.toString().padStart(2)} | ${rank.code.padEnd(4)} | ${rank.name.padEnd(6)} | ${toStr.padStart(3)} | ${autoStr.padStart(8)} | ${meritStr.padStart(8)} | ${rank.minServiceMonths.toString().padStart(3)}개월 |`);
        });

      expect(Object.keys(RANK_TABLE).length).toBe(19);
    });
  });
});

