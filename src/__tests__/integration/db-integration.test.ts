/**
 * DB 통합 테스트
 * 
 * 테스트 범위:
 * - CRUD 작업
 * - 트랜잭션 (MongoDB 세션)
 * - 캐시 통합 (L1/L2)
 * - 데이터 일관성
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import {
  setupTestDatabase,
  connectTestDatabase,
  cleanupTestDatabase,
  teardownTestDatabase,
  createTestSession,
  createTestGeneral,
  createTestNation,
  createTestCity,
  TEST_TIMEOUT,
  wait,
} from './setup';

// 캐시 매니저
import { CacheManager } from '../../cache/CacheManager';

describe('통합 테스트: DB 통합', () => {
  let mongoUri: string;

  beforeAll(async () => {
    mongoUri = await setupTestDatabase();
    await connectTestDatabase(mongoUri);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await teardownTestDatabase();
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  describe('CRUD 테스트', () => {
    describe('Session 모델', () => {
      it('세션 생성 및 조회', async () => {
        const { Session } = await import('../../models/session.model');
        
        const sessionData = createTestSession();
        const created = await Session.create(sessionData);

        expect(created.session_id).toBe(sessionData.session_id);
        expect(created.game_mode).toBe('sangokushi');

        const found = await Session.findOne({ session_id: sessionData.session_id });
        expect(found).not.toBeNull();
        expect(found!.name).toBe(sessionData.name);
      });

      it('세션 업데이트', async () => {
        const { Session } = await import('../../models/session.model');
        
        const sessionData = createTestSession();
        await Session.create(sessionData);

        await Session.updateOne(
          { session_id: sessionData.session_id },
          { $set: { name: '업데이트된 서버' } }
        );

        const updated = await Session.findOne({ session_id: sessionData.session_id });
        expect(updated!.name).toBe('업데이트된 서버');
      });

      it('세션 삭제', async () => {
        const { Session } = await import('../../models/session.model');
        
        const sessionData = createTestSession();
        await Session.create(sessionData);

        await Session.deleteOne({ session_id: sessionData.session_id });

        const deleted = await Session.findOne({ session_id: sessionData.session_id });
        expect(deleted).toBeNull();
      });
    });

    describe('General 모델', () => {
      it('장수 생성 및 조회', async () => {
        const { General } = await import('../../models/general.model');
        
        const generalData = createTestGeneral({ no: 1001, name: '테스트장수' });
        const created = await General.create(generalData);

        expect(created.name).toBe('테스트장수');
        expect(created.no).toBe(1001);

        const found = await General.findOne({ 
          session_id: generalData.session_id,
          no: 1001 
        });
        expect(found).not.toBeNull();
      });

      it('장수 능력치 업데이트', async () => {
        const { General } = await import('../../models/general.model');
        
        const generalData = createTestGeneral({ no: 1002 });
        await General.create(generalData);

        await General.updateOne(
          { session_id: generalData.session_id, no: 1002 },
          { 
            $set: { 
              'data.leadership': 100,
              'data.experience': 5000 
            } 
          }
        );

        const updated = await General.findOne({ 
          session_id: generalData.session_id,
          no: 1002 
        });
        expect(updated!.data?.leadership).toBe(100);
        expect(updated!.data?.experience).toBe(5000);
      });

      it('장수 목록 쿼리 (국가별)', async () => {
        const { General } = await import('../../models/general.model');
        
        // 여러 장수 생성
        await General.create([
          createTestGeneral({ no: 1001, data: { nation: 1 } }),
          createTestGeneral({ no: 1002, data: { nation: 1 } }),
          createTestGeneral({ no: 1003, data: { nation: 2 } }),
        ]);

        const nation1Generals = await General.find({
          session_id: 'test_session',
          'data.nation': 1,
        });

        expect(nation1Generals.length).toBe(2);
      });
    });

    describe('Nation 모델', () => {
      it('국가 생성 및 조회', async () => {
        const { Nation } = await import('../../models/nation.model');
        
        const nationData = createTestNation();
        await Nation.create(nationData);

        const found = await Nation.findOne({
          session_id: nationData.session_id,
          nation: 1,
        });

        expect(found).not.toBeNull();
        expect(found!.name).toBe('테스트 국가');
      });

      it('국가 자원 업데이트', async () => {
        const { Nation } = await import('../../models/nation.model');
        
        const nationData = createTestNation();
        await Nation.create(nationData);

        await Nation.updateOne(
          { session_id: nationData.session_id, nation: 1 },
          { 
            $inc: { 
              'data.gold': 1000,
              'data.rice': 500 
            } 
          }
        );

        const updated = await Nation.findOne({
          session_id: nationData.session_id,
          nation: 1,
        });

        expect(updated!.data?.gold).toBe(11000);
        expect(updated!.data?.rice).toBe(5500);
      });
    });

    describe('City 모델', () => {
      it('도시 생성 및 조회', async () => {
        const { City } = await import('../../models/city.model');
        
        const cityData = createTestCity();
        await City.create(cityData);

        const found = await City.findOne({
          session_id: cityData.session_id,
          city: 1,
        });

        expect(found).not.toBeNull();
        expect(found!.name).toBe('테스트 도시');
      });

      it('도시 개발도 업데이트', async () => {
        const { City } = await import('../../models/city.model');
        
        const cityData = createTestCity();
        await City.create(cityData);

        await City.updateOne(
          { session_id: cityData.session_id, city: 1 },
          { 
            $inc: { 
              'data.agri': 100,
              'data.comm': 50 
            } 
          }
        );

        const updated = await City.findOne({
          session_id: cityData.session_id,
          city: 1,
        });

        expect(updated!.data?.agri).toBe(5100);
        expect(updated!.data?.comm).toBe(5050);
      });
    });
  });

  describe('트랜잭션 테스트', () => {
    it('성공적인 트랜잭션 커밋', async () => {
      const { General } = await import('../../models/general.model');
      const { Nation } = await import('../../models/nation.model');

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // 장수 생성
          await General.create([createTestGeneral({ no: 1001 })], { session });
          
          // 국가 생성
          await Nation.create([createTestNation()], { session });
        });

        // 트랜잭션 성공 후 데이터 확인
        const general = await General.findOne({ no: 1001 });
        const nation = await Nation.findOne({ nation: 1 });

        expect(general).not.toBeNull();
        expect(nation).not.toBeNull();
      } finally {
        await session.endSession();
      }
    });

    it('트랜잭션 롤백 (에러 발생 시)', async () => {
      const { General } = await import('../../models/general.model');

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // 첫 번째 작업 성공
          await General.create([createTestGeneral({ no: 2001 })], { session });

          // 의도적으로 에러 발생
          throw new Error('롤백 테스트');
        });
      } catch (error: any) {
        expect(error.message).toBe('롤백 테스트');
      } finally {
        await session.endSession();
      }

      // 롤백 확인 - 데이터가 없어야 함
      const general = await General.findOne({ no: 2001 });
      expect(general).toBeNull();
    });

    it('복합 트랜잭션 (여러 컬렉션 동시 업데이트)', async () => {
      const { General } = await import('../../models/general.model');
      const { City } = await import('../../models/city.model');

      // 초기 데이터 생성
      await General.create(createTestGeneral({ 
        no: 3001, 
        data: { city: 1, gold: 1000 } 
      }));
      await City.create(createTestCity({ 
        city: 1, 
        data: { pop: 5000 } 
      }));

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // 장수 금 소모
          await General.updateOne(
            { no: 3001 },
            { $inc: { 'data.gold': -500 } },
            { session }
          );

          // 도시 인구 증가
          await City.updateOne(
            { city: 1 },
            { $inc: { 'data.pop': 100 } },
            { session }
          );
        });

        const general = await General.findOne({ no: 3001 });
        const city = await City.findOne({ city: 1 });

        expect(general!.data?.gold).toBe(500);
        expect(city!.data?.pop).toBe(5100);
      } finally {
        await session.endSession();
      }
    });
  });

  describe('캐시 통합 테스트', () => {
    let cache: CacheManager;

    beforeEach(() => {
      cache = CacheManager.getInstance();
    });

    it('L1 캐시 저장 및 조회', async () => {
      const testData = { id: 1, name: '테스트' };
      
      await cache.setL1('test:l1', testData, 10);
      const result = await cache.getL1('test:l1');

      expect(result).toEqual(testData);
    });

    it('L1 캐시 만료', async () => {
      const testData = { id: 2, name: '만료테스트' };
      
      await cache.setL1('test:expire', testData, 1); // 1초 TTL
      
      // 즉시 조회 - 존재해야 함
      let result = await cache.getL1('test:expire');
      expect(result).toEqual(testData);

      // 2초 대기 후 조회 - 만료되어야 함
      await wait(2000);
      result = await cache.getL1('test:expire');
      expect(result).toBeNull();
    }, 10000);

    it('캐시 삭제', async () => {
      const testData = { id: 3, name: '삭제테스트' };
      
      await cache.set('test:delete', testData);
      
      // 삭제 전 확인
      let result = await cache.get('test:delete');
      expect(result).toEqual(testData);

      // 삭제
      await cache.delete('test:delete');

      // 삭제 후 확인
      result = await cache.get('test:delete');
      expect(result).toBeNull();
    });

    it('패턴 매칭 삭제', async () => {
      await cache.setL1('pattern:a', { id: 'a' });
      await cache.setL1('pattern:b', { id: 'b' });
      await cache.setL1('other:c', { id: 'c' });

      await cache.deletePattern('pattern:*');

      const a = await cache.getL1('pattern:a');
      const b = await cache.getL1('pattern:b');
      const c = await cache.getL1('other:c');

      expect(a).toBeNull();
      expect(b).toBeNull();
      expect(c).toEqual({ id: 'c' });
    });

    it('캐시 통계', () => {
      const stats = cache.getStats();

      expect(stats).toHaveProperty('l1');
      expect(stats).toHaveProperty('l2Connected');
      expect(typeof stats.l2Connected).toBe('boolean');
    });
  });

  describe('데이터 일관성 테스트', () => {
    it('병렬 업데이트 시 데이터 일관성', async () => {
      const { General } = await import('../../models/general.model');

      // 초기 데이터
      await General.create(createTestGeneral({ 
        no: 4001, 
        data: { gold: 1000 } 
      }));

      // 병렬 업데이트
      const updates = Array(10).fill(null).map(() =>
        General.updateOne(
          { no: 4001 },
          { $inc: { 'data.gold': 100 } }
        )
      );

      await Promise.all(updates);

      const general = await General.findOne({ no: 4001 });
      expect(general!.data?.gold).toBe(2000); // 1000 + (100 * 10)
    });

    it('외래 키 같은 참조 일관성', async () => {
      const { General } = await import('../../models/general.model');
      const { Nation } = await import('../../models/nation.model');
      const { City } = await import('../../models/city.model');

      // 국가 생성
      await Nation.create(createTestNation({ nation: 1 }));

      // 도시 생성 (국가 소속)
      await City.create(createTestCity({ 
        city: 1, 
        data: { nation: 1 } 
      }));

      // 장수 생성 (국가 및 도시 소속)
      await General.create(createTestGeneral({ 
        no: 5001, 
        data: { nation: 1, city: 1 } 
      }));

      // 참조 무결성 확인
      const general = await General.findOne({ no: 5001 });
      const nationId = general!.data?.nation;
      const cityId = general!.data?.city;

      const nation = await Nation.findOne({ nation: nationId });
      const city = await City.findOne({ city: cityId });

      expect(nation).not.toBeNull();
      expect(city).not.toBeNull();
      expect(city!.data?.nation).toBe(nationId);
    });

    it('인덱스 활용 쿼리 성능', async () => {
      const { General } = await import('../../models/general.model');

      // 다량의 데이터 생성
      const generals = Array(100).fill(null).map((_, i) => 
        createTestGeneral({ 
          no: 6000 + i,
          data: { nation: i % 3 + 1, city: i % 10 + 1 }
        })
      );

      await General.insertMany(generals);

      // 인덱스 쿼리 실행
      const startTime = Date.now();
      
      const result = await General.find({
        session_id: 'test_session',
        'data.nation': 1,
      }).lean();

      const elapsed = Date.now() - startTime;

      // 쿼리 시간이 합리적인지 확인 (인덱스 사용 시 빠름)
      expect(elapsed).toBeLessThan(1000); // 1초 미만
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Repository 패턴 테스트', () => {
    it('generalRepository 사용', async () => {
      const { generalRepository } = await import('../../repositories/general.repository');

      // 장수 저장
      const generalData = createTestGeneral({ no: 7001 });
      await generalRepository.save(generalData);

      // 장수 조회
      const found = await generalRepository.findByNo('test_session', 7001);
      expect(found).not.toBeNull();
      expect(found!.no).toBe(7001);
    });

    it('cityRepository 사용', async () => {
      const { cityRepository } = await import('../../repositories/city.repository');

      // 도시 저장
      const { City } = await import('../../models/city.model');
      await City.create(createTestCity({ city: 8 }));

      // 도시 조회
      const found = await cityRepository.findByCityNum('test_session', 8);
      expect(found).not.toBeNull();
    });

    it('nationRepository 사용', async () => {
      const { nationRepository } = await import('../../repositories/nation.repository');
      const { Nation } = await import('../../models/nation.model');

      // 국가 저장
      await Nation.create(createTestNation({ nation: 9 }));

      // 국가 조회
      const found = await nationRepository.findByNationId('test_session', 9);
      expect(found).not.toBeNull();
    });
  });
});

