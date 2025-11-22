import express, { Express } from 'express';
import request from 'supertest';
import { setupSessionMiddleware, sessionMiddleware } from '../../../common/middleware/session.middleware';
import { createAPIHandler } from '../../../common/middleware/api.middleware';
import { ReqNonceAPI } from '../ReqNonceAPI';

describe('ReqNonceAPI', () => {
  let app: Express;

  beforeAll(() => {
    process.env.SESSION_DISABLE_PERSISTENCE = 'true';

    app = express();
    app.use(express.json());
    app.use(setupSessionMiddleware());
    app.use(sessionMiddleware);
    app.post('/api/login/req-nonce', createAPIHandler(ReqNonceAPI));
  });

  it('nonce 요청 시 200과 16자리 토큰을 반환한다', async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/login/req-nonce');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ result: true });
    expect(typeof response.body.loginNonce).toBe('string');
    expect(response.body.loginNonce).toHaveLength(16);
  });

  it('같은 세션에서도 매 요청마다 새로운 nonce를 발급한다', async () => {
    const agent = request.agent(app);

    const first = await agent.post('/api/login/req-nonce');
    const second = await agent.post('/api/login/req-nonce');

    expect(first.body.loginNonce).not.toEqual(second.body.loginNonce);
  });
});
