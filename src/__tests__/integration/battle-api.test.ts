/**
 * 전투 API 통합 테스트
 * 
 * 테스트 범위:
 * - 전투 시작
 * - 유닛 배치
 * - 전투 상태 조회
 * - 전투 기록 조회
 * - 자동 전투
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

describe('통합 테스트: 전투 API', () => {
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

    // 테스트 데이터 생성
    const { Session } = await import('../../models/session.model');
    const { Nation } = await import('../../models/nation.model');
    const { City } = await import('../../models/city.model');
    const { General } = await import('../../models/general.model');

    await Session.create(createTestSession());

    // 공격 국가
    await Nation.create(createTestNation({ nation: 1, name: '위나라' }));
    
    // 방어 국가
    await Nation.create(createTestNation({ 
      nation: 2, 
      name: '촉나라',
      data: { nation: 2, name: '촉나라', color: 2, capital: 2 }
    }));

    // 대상 도시 (방어측 소유)
    await City.create(createTestCity({
      city: 5,
      name: '한중',
      data: {
        city: 5,
        name: '한중',
        nation: 2,
        def: 3000,
        wall: 2000,
      },
    }));

    // 공격측 장수들
    for (let i = 0; i < 5; i++) {
      await General.create(createTestGeneral({
        no: 1001 + i,
        name: `공격장수${i + 1}`,
        owner: i === 0 ? userId : null, // 첫 번째만 사용자 소유
        data: {
          no: 1001 + i,
          nation: 1,
          city: 1,
          crew: 5000,
          crewtype: 1,
          train: 80,
          atmos: 80,
          leadership: 80 + i,
          strength: 70 + i,
          intel: 60 + i,
        },
      }));
    }

    // 방어측 장수들
    for (let i = 0; i < 3; i++) {
      await General.create(createTestGeneral({
        no: 2001 + i,
        name: `방어장수${i + 1}`,
        data: {
          no: 2001 + i,
          nation: 2,
          city: 5,
          crew: 3000,
          crewtype: 1,
          train: 70,
          atmos: 70,
          leadership: 75 + i,
          strength: 65 + i,
          intel: 55 + i,
        },
      }));
    }
  });

  describe('POST /api/battle/start - 전투 시작', () => {
    it('전투 생성 성공', async () => {
      const response = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001, 1002, 1003],
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('battleId');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.battleId).toBe('string');
    });

    it('존재하지 않는 도시로 전투 시작 실패', async () => {
      const response = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 9999,
          attackerGeneralIds: [1001],
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('공격 장수 없이 전투 시작 실패', async () => {
      const response = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [],
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('필수 필드 누락 시 전투 시작 실패', async () => {
      const response = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          // attackerNationId 누락
          defenderNationId: 2,
          targetCityId: 5,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/battle/:battleId - 전투 상태 조회', () => {
    it('전투 상태 조회 성공', async () => {
      // 먼저 전투 생성
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001, 1002],
        });

      const battleId = createResponse.body.battleId;

      // 전투 상태 조회
      const response = await request(app)
        .get(`/api/battle/${battleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('battle');
      expect(response.body.battle).toHaveProperty('battleId', battleId);
      expect(response.body.battle).toHaveProperty('status');
    });

    it('존재하지 않는 전투 조회 시 404', async () => {
      const response = await request(app)
        .get('/api/battle/nonexistent-battle-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/battle/deploy - 유닛 배치', () => {
    it('유닛 배치 성공', async () => {
      // 전투 생성
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001, 1002],
        });

      const battleId = createResponse.body.battleId;

      // 유닛 배치
      const response = await request(app)
        .post('/api/battle/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          deployments: [
            { generalId: 1001, position: { x: 0, y: 0 } },
            { generalId: 1002, position: { x: 1, y: 0 } },
          ],
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('잘못된 위치에 유닛 배치 실패', async () => {
      // 전투 생성
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001],
        });

      const battleId = createResponse.body.battleId;

      // 잘못된 위치 (범위 밖)
      const response = await request(app)
        .post('/api/battle/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          deployments: [
            { generalId: 1001, position: { x: 999, y: 999 } },
          ],
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/battle/action - 전투 액션 제출', () => {
    it('이동 액션 제출 성공', async () => {
      // 전투 생성 및 배치
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001],
        });

      const battleId = createResponse.body.battleId;

      // 유닛 배치
      await request(app)
        .post('/api/battle/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          deployments: [
            { generalId: 1001, position: { x: 0, y: 0 } },
          ],
        });

      // 이동 액션 제출
      const response = await request(app)
        .post('/api/battle/action')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          generalId: 1001,
          action: {
            type: 'move',
            target: { x: 1, y: 1 },
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/battle/ready - 준비 완료', () => {
    it('준비 완료 표시 성공', async () => {
      // 전투 생성
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001],
        });

      const battleId = createResponse.body.battleId;

      // 배치
      await request(app)
        .post('/api/battle/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          deployments: [
            { generalId: 1001, position: { x: 0, y: 0 } },
          ],
        });

      // 준비 완료
      const response = await request(app)
        .post('/api/battle/ready')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          playerId: 1,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/battle/history/:battleId - 전투 기록 조회', () => {
    it('전투 기록 조회 성공', async () => {
      // 전투 생성
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001],
        });

      const battleId = createResponse.body.battleId;

      // 전투 기록 조회
      const response = await request(app)
        .get(`/api/battle/history/${battleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('history');
    });
  });

  describe('POST /api/battle/auto-resolve - 자동 전투', () => {
    it('자동 전투 실행 성공', async () => {
      // 전투 생성
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001, 1002, 1003],
        });

      const battleId = createResponse.body.battleId;

      // 자동 전투
      const response = await request(app)
        .post('/api/battle/auto-resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
    });
  });

  describe('POST /api/battle/simulate - 전투 시뮬레이션', () => {
    it('전투 시뮬레이션 실행 성공', async () => {
      const response = await request(app)
        .post('/api/battle/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001, 1002],
          defenderGeneralIds: [2001],
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('simulation');
    });
  });

  describe('GET /api/battle/center - 전투 센터 조회', () => {
    it('활성 전투 목록 조회 성공', async () => {
      // 전투 생성
      await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001],
        });

      // 전투 센터 조회
      const response = await request(app)
        .get('/api/battle/center')
        .query({ session_id: 'test_session' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('battles');
      expect(Array.isArray(response.body.battles)).toBe(true);
    });
  });

  describe('전투 흐름 통합 테스트', () => {
    it('전체 전투 흐름: 생성 → 배치 → 준비 → 진행', async () => {
      // 1. 전투 생성
      const createResponse = await request(app)
        .post('/api/battle/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: 'test_session',
          attackerNationId: 1,
          defenderNationId: 2,
          targetCityId: 5,
          attackerGeneralIds: [1001, 1002],
        });

      expect(createResponse.status).toBe(200);
      const battleId = createResponse.body.battleId;

      // 2. 상태 확인 (DEPLOYING)
      let stateResponse = await request(app)
        .get(`/api/battle/${battleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(stateResponse.body.battle.status).toBe('DEPLOYING');

      // 3. 유닛 배치
      const deployResponse = await request(app)
        .post('/api/battle/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          deployments: [
            { generalId: 1001, position: { x: 0, y: 0 } },
            { generalId: 1002, position: { x: 1, y: 0 } },
          ],
        });

      expect(deployResponse.status).toBe(200);

      // 4. 준비 완료
      const readyResponse = await request(app)
        .post('/api/battle/ready')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          battleId,
          playerId: 1,
        });

      expect(readyResponse.status).toBe(200);

      // 5. 전투 기록 확인
      const historyResponse = await request(app)
        .get(`/api/battle/history/${battleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body).toHaveProperty('history');
    });
  });
});

