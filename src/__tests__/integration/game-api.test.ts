/**
 * 게임 API 통합 테스트
 * 
 * 테스트 범위:
 * - 세션 설정 조회
 * - 턴 정보 조회
 * - 도시 목록/상세 조회
 * - 랭킹 조회
 * - 장수/국가 정보 조회
 */

/// <reference types="jest" />

import request from 'supertest';
import mongoose from 'mongoose';
import { Express } from 'express';
import {
  setupTestDatabase,
  connectTestDatabase,
  cleanupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  createTestSession,
  createTestGeneral,
  createTestNation,
  createTestCity,
  TEST_TIMEOUT,
} from './setup';

let createApp: () => Promise<Express>;

describe('통합 테스트: 게임 API', () => {
  let app: Express;
  let mongoUri: string;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    mongoUri = await setupTestDatabase();
    await connectTestDatabase(mongoUri);
    
    const serverModule = await import('../../server');
    createApp = serverModule.createApp;
    app = await createApp();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await teardownTestDatabase();
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    await cleanupTestDatabase();

    // 테스트 사용자 생성 및 로그인
    const userData = createTestUser();
    await request(app)
      .post('/api/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: userData.username,
        password: userData.password,
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.userId;

    // 테스트 세션 생성
    const { Session } = await import('../../models/session.model');
    await Session.create(createTestSession());

    // 테스트 국가 생성
    const { Nation } = await import('../../models/nation.model');
    await Nation.create(createTestNation());

    // 테스트 도시 생성
    const { City } = await import('../../models/city.model');
    await City.create(createTestCity());
  });

  describe('GET /api/game/session/:sessionId/config - 세션 설정 조회', () => {
    it('세션 설정 조회 성공', async () => {
      const response = await request(app)
        .get('/api/game/session/test_session/config')
        .expect(200);

      expect(response.body).toHaveProperty('session_id', 'test_session');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('game_mode');
      expect(response.body).toHaveProperty('resources');
      expect(response.body).toHaveProperty('attributes');
    });

    it('존재하지 않는 세션 조회 시 404', async () => {
      const response = await request(app)
        .get('/api/game/session/nonexistent_session/config')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/game/const - 게임 상수 조회', () => {
    it('게임 상수 조회 성공', async () => {
      const response = await request(app)
        .get('/api/game/const')
        .query({ sessionId: 'test_session' })
        .expect(200);

      expect(typeof response.body).toBe('object');
    });

    it('기본 세션으로 게임 상수 조회', async () => {
      // 기본 세션 생성
      const { Session } = await import('../../models/session.model');
      await Session.create(createTestSession({ session_id: 'sangokushi_default' }));

      const response = await request(app)
        .get('/api/game/const')
        .expect(200);

      expect(typeof response.body).toBe('object');
    });
  });

  describe('GET /api/game/turn - 턴 정보 조회', () => {
    it('현재 턴 정보 조회 성공', async () => {
      const response = await request(app)
        .get('/api/game/turn')
        .query({ session_id: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('turn');
      expect(response.body).toHaveProperty('year');
      expect(response.body).toHaveProperty('month');
      expect(typeof response.body.turn).toBe('number');
      expect(typeof response.body.year).toBe('number');
      expect(typeof response.body.month).toBe('number');
    });

    it('존재하지 않는 세션 턴 조회 시 404', async () => {
      const response = await request(app)
        .get('/api/game/turn')
        .query({ session_id: 'nonexistent' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/game/ranking - 랭킹 조회', () => {
    it('장수 랭킹 조회 성공', async () => {
      // 테스트 장수들 생성
      const { General } = await import('../../models/general.model');
      await General.create([
        createTestGeneral({ 
          no: 1, 
          name: '장수1',
          data: { experience: 1000, explevel: 10, leadership: 90, strength: 80, intel: 70 }
        }),
        createTestGeneral({ 
          no: 2, 
          name: '장수2',
          data: { experience: 2000, explevel: 20, leadership: 85, strength: 95, intel: 75 }
        }),
      ]);

      const response = await request(app)
        .get('/api/game/ranking')
        .query({ session_id: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('ranking');
      expect(Array.isArray(response.body.ranking)).toBe(true);
    });
  });

  describe('GET /api/game/cities - 도시 목록 조회', () => {
    it('도시 목록 조회 성공', async () => {
      const response = await request(app)
        .get('/api/game/cities')
        .query({ session: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('cities');
      expect(Array.isArray(response.body.cities)).toBe(true);
      expect(response.body.cities.length).toBeGreaterThan(0);
    });

    it('도시 목록에 필수 필드 포함 확인', async () => {
      const response = await request(app)
        .get('/api/game/cities')
        .query({ session: 'test_session' })
        .expect(200);

      const city = response.body.cities[0];
      expect(city).toHaveProperty('city');
      expect(city).toHaveProperty('name');
      expect(city).toHaveProperty('data');
    });
  });

  describe('GET /api/game/cities/:id - 도시 상세 조회', () => {
    it('도시 상세 정보 조회 성공', async () => {
      const response = await request(app)
        .get('/api/game/cities/1')
        .query({ session: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('city', 1);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('data');
    });

    it('존재하지 않는 도시 조회 시 404', async () => {
      const response = await request(app)
        .get('/api/game/cities/9999')
        .query({ session: 'test_session' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('잘못된 도시 ID 형식으로 조회 시 400', async () => {
      const response = await request(app)
        .get('/api/game/cities/invalid')
        .query({ session: 'test_session' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/game/basic-info - 기본 정보 조회', () => {
    it('인증된 사용자의 기본 정보 조회', async () => {
      // 테스트 장수 생성 (사용자 연결)
      const { General } = await import('../../models/general.model');
      await General.create(createTestGeneral({
        owner: userId,
        data: {
          no: 100,
          nation: 1,
          officer_level: 5,
        },
      }));

      const response = await request(app)
        .post('/api/game/basic-info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('generalID');
      expect(response.body).toHaveProperty('myNationID');
    });

    it('장수가 없는 사용자의 기본 정보 조회', async () => {
      const response = await request(app)
        .post('/api/game/basic-info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('result', false);
      expect(response.body.generalID).toBe(0);
    });

    it('인증 없이 기본 정보 조회 실패', async () => {
      const response = await request(app)
        .post('/api/game/basic-info')
        .send({ session_id: 'test_session' })
        .expect(401);
    });
  });

  describe('POST /api/game/general-list - 장수 목록 조회', () => {
    it('같은 국가 장수 목록 조회 성공', async () => {
      // 테스트 장수들 생성
      const { General } = await import('../../models/general.model');
      
      // 사용자 장수
      await General.create(createTestGeneral({
        no: 100,
        name: '내 장수',
        owner: userId,
        data: { nation: 1, city: 1 },
      }));

      // 같은 국가 장수
      await General.create(createTestGeneral({
        no: 101,
        name: '동료 장수',
        data: { nation: 1, city: 1 },
      }));

      const response = await request(app)
        .post('/api/game/general-list')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('generals');
      expect(Array.isArray(response.body.generals)).toBe(true);
    });

    it('국가 미소속 사용자의 장수 목록 조회 실패', async () => {
      // 국가 미소속 장수 생성
      const { General } = await import('../../models/general.model');
      await General.create(createTestGeneral({
        owner: userId,
        data: { nation: 0 }, // 국가 없음
      }));

      const response = await request(app)
        .post('/api/game/general-list')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: 'test_session' })
        .expect(403);

      expect(response.body).toHaveProperty('result', false);
    });
  });

  describe('POST /api/game/city-list - 도시 목록 조회 (인증)', () => {
    it('자국 도시 목록 조회 성공', async () => {
      // 사용자 장수 생성
      const { General } = await import('../../models/general.model');
      await General.create(createTestGeneral({
        owner: userId,
        data: { nation: 1 },
      }));

      const response = await request(app)
        .post('/api/game/city-list')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: 'test_session' })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('cities');
      expect(response.body).toHaveProperty('nations');
    });
  });

  describe('GET /api/game/logs/general - 장수 동향 조회', () => {
    it('장수 동향 로그 조회 성공', async () => {
      const response = await request(app)
        .get('/api/game/logs/general')
        .query({
          sessionId: 'test_session',
          generalId: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('필수 파라미터 누락 시 400', async () => {
      const response = await request(app)
        .get('/api/game/logs/general')
        .expect(400);

      expect(response.body).toHaveProperty('result', false);
    });
  });

  describe('GET /api/game/logs/global - 중원 정세 조회', () => {
    it('중원 정세 로그 조회 성공', async () => {
      const response = await request(app)
        .get('/api/game/logs/global')
        .query({
          sessionId: 'test_session',
          limit: 10,
        })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('세션 ID 누락 시 400', async () => {
      const response = await request(app)
        .get('/api/game/logs/global')
        .expect(400);

      expect(response.body).toHaveProperty('result', false);
    });
  });

  describe('데이터 일관성 테스트', () => {
    it('세션-국가-도시-장수 관계 일관성', async () => {
      const { General } = await import('../../models/general.model');
      
      // 사용자 장수 생성
      await General.create(createTestGeneral({
        owner: userId,
        data: { nation: 1, city: 1 },
      }));

      // 도시 조회
      const cityResponse = await request(app)
        .get('/api/game/cities/1')
        .query({ session: 'test_session' });

      // 세션 조회
      const sessionResponse = await request(app)
        .get('/api/game/session/test_session/config');

      // 장수 정보와 도시 정보가 일관성 있는지 확인
      expect(cityResponse.body.data.nation).toBe(1);
      expect(sessionResponse.body.session_id).toBe('test_session');
    });
  });
});

