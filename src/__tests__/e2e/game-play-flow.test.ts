/**
 * E2E 통합 테스트 - 게임 플레이 플로우
 * 
 * 테스트 시나리오:
 * 1. 로그인
 * 2. 기본 정보 조회
 * 3. 맵 조회
 * 4. 장수 정보 조회
 * 5. 명령 예약
 * 6. 경매 조회
 * 7. 외교 서한 조회
 * 8. 전투 센터 조회
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../server';

// supertest 타입 정의
declare module 'supertest' {
  interface Test {
    expect(status: number): this;
  }
}

describe('E2E: 게임 플레이 플로우', () => {
  let app: Express;
  let authToken: string;
  let sessionId: string = 'sangokushi_default';

  beforeAll(async () => {
    app = await createApp();
    
    // 테스트 사용자 생성 및 로그인
    const username = `testuser_${Date.now()}`;
    await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'test1234', name: 'Test User' });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test1234' });
    
    authToken = loginResponse.body.token;
  });

  describe('게임 기본 정보 조회', () => {
    it('POST /api/game/basic-info - 기본 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/game/basic-info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('gameInfo');
    });

    it('GET /api/global/get-map - 맵 데이터 조회 성공', async () => {
      const response = await request(app)
        .get('/api/global/get-map')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('cityList');
      expect(response.body).toHaveProperty('nationList');
    });

    it('GET /api/global/get-nation-list - 국가 목록 조회 성공', async () => {
      const response = await request(app)
        .get('/api/global/get-nation-list')
        .query({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('nationList');
    });
  });

  describe('장수 정보 조회', () => {
    it('POST /api/general/get-front-info - 장수 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/general/get-front-info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('globalInfo');
      expect(response.body).toHaveProperty('nationInfo');
      expect(response.body).toHaveProperty('generalInfo');
    });

    it('POST /api/info/general - 장수 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/info/general')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
    });

    it('POST /api/info/officer - 장수 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/info/officer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
    });
  });

  describe('명령 시스템', () => {
    it('POST /api/command/reserve-command - 명령 예약 성공', async () => {
      const response = await request(app)
        .post('/api/command/reserve-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          action: 'rest',
          turnIdx: 0,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('GET /api/command/list - 명령 목록 조회 성공', async () => {
      const response = await request(app)
        .get('/api/command/list')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('commands');
      expect(Array.isArray(response.body.commands)).toBe(true);
    });
  });

  describe('경매 시스템', () => {
    it('POST /api/auction/get-unique-list - 유니크 아이템 경매 목록 조회 성공', async () => {
      const response = await request(app)
        .post('/api/auction/get-unique-list')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('auctions');
      expect(Array.isArray(response.body.auctions)).toBe(true);
    });

    it('POST /api/auction/get-active-resource-list - 자원 경매 목록 조회 성공', async () => {
      const response = await request(app)
        .post('/api/auction/get-active-resource-list')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('auctions');
      expect(Array.isArray(response.body.auctions)).toBe(true);
    });
  });

  describe('외교 시스템', () => {
    it('GET /api/diplomacy/get-letter - 외교 서한 목록 조회 성공', async () => {
      const response = await request(app)
        .get('/api/diplomacy/get-letter')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('letters');
      expect(Array.isArray(response.body.letters)).toBe(true);
    });
  });

  describe('전투 시스템', () => {
    it('POST /api/battle/center - 전투 센터 조회 성공', async () => {
      const response = await request(app)
        .post('/api/battle/center')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('battles');
      expect(Array.isArray(response.body.battles)).toBe(true);
    });

    it('POST /api/battle/detail - 전투 상세 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/battle/detail')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          battleID: 'test-battle-id',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('정보 조회 API', () => {
    it('POST /api/world/info - 세계 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/world/info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
    });

    it('POST /api/info/tournament - 토너먼트 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/info/tournament')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
    });

    it('POST /api/info/betting - 배팅 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/info/betting')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
    });
  });

  describe('국가 관리 API', () => {
    it('POST /api/nation/generals - 국가 장수 목록 조회 성공', async () => {
      const response = await request(app)
        .post('/api/nation/generals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('generals');
      expect(Array.isArray(response.body.generals)).toBe(true);
    });

    it('POST /api/nation/stratfinan - 전략/재정 정보 조회 성공', async () => {
      const response = await request(app)
        .post('/api/nation/stratfinan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ session_id: sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('stratFinan');
    });
  });
});

