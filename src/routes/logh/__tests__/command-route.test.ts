import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import loghCommandRoutes from '../command.route';

describe('LOGH 커맨드 라우트', () => {
  let app: Express;
  let token: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/logh', loghCommandRoutes);

    token = jwt.sign({ userId: 'tester', sessionId: 'test_session' }, process.env.JWT_SECRET || 'secret');
  });

  it('사용 가능한 커맨드 목록을 반환한다', async () => {
    const response = await request(app)
      .get('/api/logh/commands/available')
      .set('Authorization', `Bearer ${token}`)
      .query({ sessionId: 'test_session' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.commands)).toBe(true);
    expect(response.body.commands.length).toBeGreaterThan(0);
    expect(response.body.commands[0]).toMatchObject({
      displayName: '함대 이동',
      requiredCP: 2,
    });
  });
});
