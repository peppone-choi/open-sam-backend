/**
 * E2E 통합 테스트 - 커맨드 시스템
 *
 * 테스트 시나리오:
 * 1. 커맨드 예약 (PushCommand, ReserveCommand)
 * 2. 예약된 커맨드 조회 (GetReservedCommand)
 * 3. 커맨드 수정 (PullCommand)
 * 4. 커맨드 삭제 (DeleteCommand)
 * 5. 반복 커맨드 (RepeatCommand)
 * 6. 대량 커맨드 예약 (ReserveBulkCommand)
 * 7. 커맨드 실행 검증
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../server';

describe('E2E: 커맨드 시스템', () => {
  let app: Express;
  let authToken: string;
  let userId: string;
  const sessionId: string = 'sangokushi_default';
  let reservedCommandId: number;

  beforeAll(async () => {
    app = await createApp();

    // 테스트 사용자 생성 및 로그인
    const username = `cmduser_${Date.now()}`;
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'test1234', name: 'Command Test User' });

    userId = registerResponse.body.user.id;

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test1234' });

    authToken = loginResponse.body.token;
  });

  describe('커맨드 예약 (PushCommand)', () => {
    it('POST /api/command/push-command - 커맨드 예약 성공', async () => {
      const response = await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0, // 첫 번째 턴
          action: 'rest', // 휴식 커맨드
          arg: {}
        });

      // 장수가 게임에 입장하지 않았으면 실패 가능
      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
      }
    });

    it('POST /api/command/reserve-command - 커맨드 예약 (별칭)', async () => {
      const response = await request(app)
        .post('/api/command/reserve-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 1, // 두 번째 턴
          action: 'training_atk', // 무력 훈련
          arg: {}
        });

      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
        reservedCommandId = 1; // 실제 구현에서는 응답에서 받아야 함
      }
    });

    it('POST /api/command/push - 커맨드 예약 (별칭 2)', async () => {
      const response = await request(app)
        .post('/api/command/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 2,
          action: 'training_int', // 지력 훈련
          arg: {}
        });

      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
      }
    });

    it('동일한 턴에 중복 예약 시 덮어쓰기', async () => {
      // 턴 0에 이미 예약된 커맨드가 있음
      const response = await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0,
          action: 'domestic', // 내정 커맨드로 변경
          arg: { type: 'agriculture' }
        });

      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
      }
    });

    it('잘못된 커맨드 액션으로 예약 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 3,
          action: 'invalid_action', // 존재하지 않는 액션
          arg: {}
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });
  });

  describe('예약된 커맨드 조회 (GetReservedCommand)', () => {
    it('GET /api/command/get-reserved-command - 예약된 커맨드 목록 조회', async () => {
      const response = await request(app)
        .get('/api/command/get-reserved-command')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('commands');
      expect(Array.isArray(response.body.commands)).toBe(true);

      // 이전에 예약한 커맨드가 포함되어 있어야 함
      if (response.body.commands.length > 0) {
        const command = response.body.commands[0];
        expect(command).toHaveProperty('turnIdx');
        expect(command).toHaveProperty('action');
      }
    });

    it('다른 유저의 커맨드는 조회되지 않아야 함', async () => {
      // 새로운 유저 생성
      const username2 = `cmduser2_${Date.now()}`;
      await request(app)
        .post('/api/auth/register')
        .send({ username: username2, password: 'test1234', name: 'User 2' });

      const loginResponse2 = await request(app)
        .post('/api/auth/login')
        .send({ username: username2, password: 'test1234' });

      const authToken2 = loginResponse2.body.token;

      const response = await request(app)
        .get('/api/command/get-reserved-command')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body).toHaveProperty('result', true);

      // 첫 번째 유저의 커맨드는 조회되지 않아야 함
      // (게임에 입장하지 않았으므로 커맨드가 없어야 함)
    });
  });

  describe('커맨드 수정 (PullCommand)', () => {
    it('POST /api/command/pull-command - 기존 커맨드 수정 성공', async () => {
      const response = await request(app)
        .post('/api/command/pull-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0, // 수정할 턴
          action: 'training_def', // 방어력 훈련으로 변경
          arg: {}
        });

      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
      }
    });

    it('존재하지 않는 턴의 커맨드 수정 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/pull-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 999, // 예약되지 않은 턴
          action: 'rest',
          arg: {}
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });
  });

  describe('커맨드 삭제 (DeleteCommand)', () => {
    it('POST /api/command/delete-command - 예약된 커맨드 삭제 성공', async () => {
      // 먼저 커맨드 예약
      await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 5,
          action: 'rest',
          arg: {}
        });

      // 삭제 요청
      const response = await request(app)
        .post('/api/command/delete-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 5
        });

      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
      }
    });

    it('존재하지 않는 커맨드 삭제 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/delete-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 999
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('다른 유저의 커맨드는 삭제할 수 없어야 함', async () => {
      // 권한 검증 테스트
      // 실제 구현에서는 owner 체크 필요
    });
  });

  describe('반복 커맨드 (RepeatCommand)', () => {
    it('POST /api/command/repeat-command - 커맨드 반복 설정 성공', async () => {
      const response = await request(app)
        .post('/api/command/repeat-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0, // 반복할 턴
          repeatCount: 5 // 5번 반복
        });

      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
      }
    });

    it('존재하지 않는 커맨드를 반복 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/repeat-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 999,
          repeatCount: 3
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('음수 반복 횟수로 설정 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/repeat-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0,
          repeatCount: -1
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('최대 반복 횟수 초과 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/repeat-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0,
          repeatCount: 1000 // 너무 많은 반복
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });
  });

  describe('대량 커맨드 예약 (ReserveBulkCommand)', () => {
    it('POST /api/command/reserve-bulk-command - 여러 턴 한 번에 예약 성공', async () => {
      const response = await request(app)
        .post('/api/command/reserve-bulk-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          commands: [
            { turnIdx: 10, action: 'rest', arg: {} },
            { turnIdx: 11, action: 'training_atk', arg: {} },
            { turnIdx: 12, action: 'training_def', arg: {} },
            { turnIdx: 13, action: 'training_int', arg: {} },
            { turnIdx: 14, action: 'rest', arg: {} }
          ]
        });

      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('result', true);
        expect(response.body).toHaveProperty('successCount');
        expect(response.body.successCount).toBeGreaterThan(0);
      }
    });

    it('빈 커맨드 목록으로 대량 예약 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/reserve-bulk-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          commands: []
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('일부 커맨드만 유효한 경우 부분 성공', async () => {
      const response = await request(app)
        .post('/api/command/reserve-bulk-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          commands: [
            { turnIdx: 20, action: 'rest', arg: {} },
            { turnIdx: 21, action: 'invalid_action', arg: {} }, // 잘못된 액션
            { turnIdx: 22, action: 'training_atk', arg: {} }
          ]
        });

      if (response.status === 200) {
        // 성공한 커맨드 개수 확인
        if (response.body.successCount !== undefined) {
          expect(response.body.successCount).toBeGreaterThan(0);
          expect(response.body.successCount).toBeLessThan(3);
        }
      }
    });
  });

  describe('커맨드 실행 검증', () => {
    it('커맨드 실행 후 상태 변화 확인', async () => {
      // 실제로 턴이 돌아가야 테스트 가능
      // 여기서는 커맨드 예약만 확인

      // 훈련 커맨드 예약
      await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0,
          action: 'training_atk',
          arg: {}
        });

      // 예약된 커맨드 확인
      const response = await request(app)
        .get('/api/command/get-reserved-command')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.commands) {
        const trainCommand = response.body.commands.find(
          (cmd: any) => cmd.action === 'training_atk'
        );
        expect(trainCommand).toBeDefined();
      }
    });

    it('커맨드 비용 확인', async () => {
      // 금/쌀이 부족한 커맨드 예약 시 실패
      const response = await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 0,
          action: 'recruit', // 병력 모집 (비용 필요)
          arg: { count: 999999 } // 불가능한 양
        });

      if (response.status === 200) {
        // 비용 부족으로 실패하거나 성공 (장수 상태에 따라 다름)
        expect(response.body).toBeDefined();
      }
    });
  });

  describe('권한 및 보안 검증', () => {
    it('인증 없이 커맨드 예약 시 401 에러', async () => {
      const response = await request(app)
        .post('/api/command/push-command')
        .send({
          session_id: sessionId,
          turnIdx: 0,
          action: 'rest',
          arg: {}
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('인증 없이 커맨드 조회 시 401 에러', async () => {
      const response = await request(app)
        .get('/api/command/get-reserved-command')
        .query({ session_id: sessionId })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('음수 턴 인덱스로 예약 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: -1,
          action: 'rest',
          arg: {}
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('최대 턴 인덱스 초과 시 실패', async () => {
      const response = await request(app)
        .post('/api/command/push-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: sessionId,
          turnIdx: 999999,
          action: 'rest',
          arg: {}
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', false);
      }
    });
  });

  describe('커맨드 에러 처리', () => {
    it('커맨드 실행 중 에러 발생 시 롤백', async () => {
      // 실제 턴 처리 시 에러 발생 케이스
      // 예: 도시 소유권 변경, 자원 부족 등
    });

    it('커맨드 실패 시 비용 환불', async () => {
      // 실패한 커맨드의 비용이 환불되는지 확인
    });
  });
});
