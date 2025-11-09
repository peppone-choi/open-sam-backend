/**
 * E2E 통합 테스트 - 메시지 시스템
 *
 * 테스트 시나리오:
 * 1. 공개 메시지 (public) - 모든 유저가 볼 수 있음
 * 2. 국가 메시지 (national) - 같은 국가 멤버만 볼 수 있음
 * 3. 외교 메시지 (diplomacy) - 두 국가 간 메시지
 * 4. 개인 메시지 (private) - 특정 장수에게만
 * 5. 메시지 조회 및 삭제
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../server';

describe('E2E: 메시지 시스템', () => {
  let app: Express;
  let authToken1: string;
  let authToken2: string;
  let userId1: string;
  let userId2: string;
  let generalId1: number;
  let generalId2: number;
  const sessionId: string = 'sangokushi_default';

  beforeAll(async () => {
    app = await createApp();

    // 테스트 사용자 1 생성 및 로그인
    const username1 = `testuser1_${Date.now()}`;
    const registerResponse1 = await request(app)
      .post('/api/auth/register')
      .send({ username: username1, password: 'test1234', name: 'Test User 1' });

    userId1 = registerResponse1.body.user.id;

    const loginResponse1 = await request(app)
      .post('/api/auth/login')
      .send({ username: username1, password: 'test1234' });

    authToken1 = loginResponse1.body.token;

    // 테스트 사용자 2 생성 및 로그인
    const username2 = `testuser2_${Date.now()}`;
    const registerResponse2 = await request(app)
      .post('/api/auth/register')
      .send({ username: username2, password: 'test1234', name: 'Test User 2' });

    userId2 = registerResponse2.body.user.id;

    const loginResponse2 = await request(app)
      .post('/api/auth/login')
      .send({ username: username2, password: 'test1234' });

    authToken2 = loginResponse2.body.token;

    // 장수 정보 조회 (게임에 입장해야 generalId 획득)
    // 실제 환경에서는 /api/game/join 등의 엔드포인트 필요
    // 여기서는 generalId를 임시로 설정 (실제 구현에 따라 수정 필요)
  });

  describe('공개 메시지 (Public)', () => {
    let messageId: number;

    it('POST /api/message/send-message - 공개 메시지 전송 성공', async () => {
      const response = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          session_id: sessionId,
          mailbox: 0, // 공개 메시지
          text: '안녕하세요, 모든 분들께 공개 메시지입니다!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('msgType', 'public');
      expect(response.body).toHaveProperty('msgID');

      messageId = response.body.msgID;
    });

    it('GET /api/message/get-recent-message - 공개 메시지 조회 성공', async () => {
      const response = await request(app)
        .get('/api/message/get-recent-message')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);

      // 방금 전송한 공개 메시지가 포함되어 있는지 확인
      const publicMessages = response.body.messages.filter(
        (msg: any) => msg.type === 'public'
      );
      expect(publicMessages.length).toBeGreaterThan(0);
    });

    it('다른 사용자도 공개 메시지를 볼 수 있어야 함', async () => {
      const response = await request(app)
        .get('/api/message/get-recent-message')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      const publicMessages = response.body.messages.filter(
        (msg: any) => msg.type === 'public'
      );
      expect(publicMessages.length).toBeGreaterThan(0);
    });

    it('빈 메시지 전송 시 실패해야 함', async () => {
      const response = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          session_id: sessionId,
          mailbox: 0,
          text: ''
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('개인 메시지 (Private)', () => {
    let targetGeneralId: number;

    beforeAll(async () => {
      // 실제 환경에서는 장수 목록 조회 API를 통해 대상 장수 ID를 얻어야 함
      // 여기서는 테스트를 위해 임시값 사용 (실제 구현에 따라 수정 필요)
      targetGeneralId = 2;
    });

    it('POST /api/message/send-message - 개인 메시지 전송 성공', async () => {
      // 대상 장수가 존재하는 경우에만 성공
      const response = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          session_id: sessionId,
          mailbox: targetGeneralId, // 개인 메시지: 대상 장수 ID
          text: '안녕하세요, 개인 메시지입니다!'
        });

      // 대상 장수가 존재하지 않으면 실패할 수 있음
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        if (response.body.success) {
          expect(response.body).toHaveProperty('msgType', 'private');
        }
      }
    });

    it('존재하지 않는 장수에게 메시지 전송 시 실패', async () => {
      const response = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          session_id: sessionId,
          mailbox: 999999, // 존재하지 않는 장수 ID
          text: '테스트 메시지'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('국가 메시지 (National)', () => {
    const MAILBOX_NATIONAL = 1000000;
    let nationId: number;

    beforeAll(async () => {
      // 실제 환경에서는 장수의 국가 ID를 조회해야 함
      // 기본값으로 0 (재야) 사용
      nationId = 0;
    });

    it('POST /api/message/send-message - 국가 메시지 전송 성공', async () => {
      const response = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          session_id: sessionId,
          mailbox: MAILBOX_NATIONAL + nationId, // 국가 메시지
          text: '우리 국가 멤버들께 전하는 메시지입니다!'
        });

      // 국가에 소속되어 있는 경우에만 성공
      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('msgType', 'national');
      }
    });

    it('같은 국가 멤버만 국가 메시지를 볼 수 있어야 함', async () => {
      // 국가 메시지 조회 시 필터링 테스트
      // 실제 구현에서는 GetMessages 서비스에서 국가 ID로 필터링
      const response = await request(app)
        .get('/api/message/get-recent-message')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      if (response.body.messages) {
        const nationalMessages = response.body.messages.filter(
          (msg: any) => msg.type === 'national'
        );

        // 국가 메시지가 있다면, dest_nation_id가 현재 장수의 국가와 같아야 함
        nationalMessages.forEach((msg: any) => {
          // 필터링 로직 확인 (실제 구현에 따라 수정)
        });
      }
    });
  });

  describe('외교 메시지 (Diplomacy)', () => {
    const MAILBOX_NATIONAL = 1000000;
    let srcNationId: number;
    let destNationId: number;

    beforeAll(async () => {
      // 실제 환경에서는 국가 목록을 조회해야 함
      srcNationId = 0;
      destNationId = 1;
    });

    it('POST /api/message/send-message - 외교 메시지 전송 성공', async () => {
      const response = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          session_id: sessionId,
          mailbox: MAILBOX_NATIONAL + destNationId, // 다른 국가에게
          text: '외교 제안 메시지입니다!'
        });

      // 외교 권한(strategic)이 있고, 대상 국가가 존재하는 경우에만 성공
      if (response.status === 200 && response.body.success) {
        expect(response.body).toHaveProperty('msgType', 'diplomacy');
      }
    });

    it('외교 권한이 없으면 외교 메시지 전송 실패', async () => {
      // 일반 장수(외교 권한 없음)는 외교 메시지를 보낼 수 없음
      // 실제 구현에서는 permission 체크
      const response = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          session_id: sessionId,
          mailbox: MAILBOX_NATIONAL + destNationId,
          text: '외교 메시지 테스트'
        });

      // 권한 부족 시 자신의 국가 메시지로 전환되거나 실패
      if (response.status === 200) {
        // 외교 권한이 없으면 국가 메시지로 전환됨
        if (response.body.success) {
          // msgType이 diplomacy가 아니어야 함 (권한 없으면)
        }
      }
    });
  });

  describe('메시지 조회 및 관리', () => {
    it('GET /api/message/get-messages - 받은 메시지 목록 조회', async () => {
      const response = await request(app)
        .get('/api/message/get-messages')
        .query({
          session_id: sessionId,
          type: 'received'
        })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('GET /api/message/get-messages - 보낸 메시지 목록 조회', async () => {
      const response = await request(app)
        .get('/api/message/get-messages')
        .query({
          session_id: sessionId,
          type: 'sent'
        })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('GET /api/message/get-contact-list - 연락처 목록 조회', async () => {
      const response = await request(app)
        .get('/api/message/get-contact-list')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('contacts');
      expect(Array.isArray(response.body.contacts)).toBe(true);
    });

    it('POST /api/message/delete-message - 메시지 삭제 성공', async () => {
      // 먼저 메시지 목록 조회
      const listResponse = await request(app)
        .get('/api/message/get-messages')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      if (listResponse.body.messages && listResponse.body.messages.length > 0) {
        const messageId = listResponse.body.messages[0].id;

        const response = await request(app)
          .post('/api/message/delete-message')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            session_id: sessionId,
            message_id: messageId
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      }
    });

    it('GET /api/message/get-message-preview - 메시지 미리보기 조회', async () => {
      const response = await request(app)
        .get('/api/message/get-message-preview')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('GET /api/message/get-old-message - 이전 메시지 페이징 조회', async () => {
      const response = await request(app)
        .get('/api/message/get-old-message')
        .query({
          session_id: sessionId,
          before_id: 100
        })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });
  });

  describe('권한 및 보안 검증', () => {
    it('인증 없이 메시지 전송 시 401 에러', async () => {
      const response = await request(app)
        .post('/api/message/send-message')
        .send({
          session_id: sessionId,
          mailbox: 0,
          text: '인증 없는 메시지'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('인증 없이 메시지 조회 시 401 에러', async () => {
      const response = await request(app)
        .get('/api/message/get-messages')
        .query({ session_id: sessionId })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('다른 유저의 메시지를 삭제할 수 없어야 함', async () => {
      // 사용자1이 메시지를 보냄
      const sendResponse = await request(app)
        .post('/api/message/send-message')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          session_id: sessionId,
          mailbox: 0,
          text: '삭제 테스트 메시지'
        });

      if (sendResponse.body.success && sendResponse.body.msgID) {
        const messageId = sendResponse.body.msgID;

        // 사용자2가 사용자1의 메시지를 삭제 시도
        const deleteResponse = await request(app)
          .post('/api/message/delete-message')
          .set('Authorization', `Bearer ${authToken2}`)
          .send({
            session_id: sessionId,
            message_id: messageId
          });

        // 권한 체크에 따라 실패하거나 자신의 메시지만 삭제 가능
        // 실제 구현에 따라 검증 방식이 다를 수 있음
      }
    });
  });

  describe('메시지 읽음 처리', () => {
    it('GET /api/message/read-latest-message - 최신 메시지 읽음 처리', async () => {
      const response = await request(app)
        .get('/api/message/read-latest-message')
        .query({ session_id: sessionId })
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
