/**
 * E2E 통합 테스트 - 인증 플로우
 * 
 * 테스트 시나리오:
 * 1. 회원가입
 * 2. 로그인
 * 3. 토큰 검증
 * 4. 로그아웃
 * 5. 로그아웃된 토큰 거부
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

describe('E2E: 인증 플로우', () => {
  let app: Express;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('POST /api/auth/register', () => {
    it('새 사용자 회원가입 성공', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: `testuser_${Date.now()}`,
          password: 'test1234',
          name: 'Test User',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      userId = response.body.user.id;
    });

    it('중복된 사용자명으로 회원가입 실패', async () => {
      const username = `testuser_${Date.now()}`;
      
      // 첫 번째 회원가입
      await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'test1234',
          name: 'Test User',
        })
        .expect(200);

      // 두 번째 회원가입 (중복)
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'test1234',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('필수 필드 누락 시 회원가입 실패', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          // password 누락
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('올바른 자격증명으로 로그인 성공', async () => {
      const username = `testuser_${Date.now()}`;
      const password = 'test1234';

      // 회원가입
      await request(app)
        .post('/api/auth/register')
        .send({ username, password, name: 'Test User' });

      // 로그인
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username, password })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      authToken = response.body.token;
    });

    it('잘못된 비밀번호로 로그인 실패', async () => {
      const username = `testuser_${Date.now()}`;

      // 회원가입
      await request(app)
        .post('/api/auth/register')
        .send({ username, password: 'test1234', name: 'Test User' });

      // 잘못된 비밀번호로 로그인
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'wrongpassword' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('존재하지 않는 사용자로 로그인 실패', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'test1234' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('유효한 토큰으로 사용자 정보 조회 성공', async () => {
      if (!authToken) {
        // 로그인부터 수행
        const username = `testuser_${Date.now()}`;
        await request(app)
          .post('/api/auth/register')
          .send({ username, password: 'test1234', name: 'Test User' });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ username, password: 'test1234' });
        authToken = loginResponse.body.token;
      }

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('username');
    });

    it('토큰 없이 사용자 정보 조회 실패', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('유효하지 않은 토큰으로 사용자 정보 조회 실패', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/gateway/logout', () => {
    it('로그아웃 성공', async () => {
      if (!authToken) {
        // 로그인부터 수행
        const username = `testuser_${Date.now()}`;
        await request(app)
          .post('/api/auth/register')
          .send({ username, password: 'test1234', name: 'Test User' });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ username, password: 'test1234' });
        authToken = loginResponse.body.token;
      }

      const response = await request(app)
        .post('/api/gateway/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
    });

    it('로그아웃 후 토큰 무효화 확인', async () => {
      if (!authToken) {
        // 로그인부터 수행
        const username = `testuser_${Date.now()}`;
        await request(app)
          .post('/api/auth/register')
          .send({ username, password: 'test1234', name: 'Test User' });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ username, password: 'test1234' });
        authToken = loginResponse.body.token;
      }

      // 로그아웃
      await request(app)
        .post('/api/gateway/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 로그아웃된 토큰으로 접근 시도
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

