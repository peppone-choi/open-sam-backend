import express, { Express } from 'express';
import request from 'supertest';
import processingRoutes from '../processing.routes';
import commandRoutes from '../command.routes';
import gin7Router from '../gin7';
import loghCommandRoutes from '../logh/command.route';
import { GetProcessingCommandService } from '../../services/processing/GetProcessingCommand.service';
import { ReserveCommandService } from '../../services/command/ReserveCommand.service';
import { Gin7FrontendService } from '../../services/logh/Gin7Frontend.service';

jest.mock('../../middleware/auth', () => {
  const attachUser = (req: any) => {
    if (req.headers['x-test-anon']) {
      return;
    }
    req.user = {
      userId: 'tester',
      generalId: 1,
      sessionId: req.headers['x-test-session'] || 'test_session',
    };
  };

  const authenticate = (req: any, _res: any, next: any) => {
    attachUser(req);
    next();
  };

  const validateSession = (req: any, res: any, next: any) => {
    const requestSessionId = req.body.sessionId || req.params.sessionId || req.query.sessionId;
    const userSessionId = req.user?.sessionId;

    if (!userSessionId) {
      return res.status(400).json({ success: false, message: '사용자 세션 정보가 없습니다' });
    }
    if (requestSessionId && requestSessionId !== userSessionId) {
      return res.status(403).json({ success: false, message: '세션이 일치하지 않습니다' });
    }
    req.sessionInstance = { session_id: requestSessionId || userSessionId };
    next();
  };

  return {
    authenticate,
    optionalAuth: authenticate,
    autoExtractToken: authenticate,
    validateSession,
  };
});

describe('세션 D 커맨드/메뉴 API 계약 검증', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/processing', processingRoutes);
    app.use('/api/command', commandRoutes);
    app.use('/api/gin7', gin7Router);
    app.use('/api/logh', loghCommandRoutes);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('/api/processing/command', () => {
    it('정상적으로 명령 데이터를 반환한다', async () => {
      jest.spyOn(GetProcessingCommandService, 'execute').mockResolvedValue({
        result: true,
        commandData: {
          name: '훈련',
          options: [],
        },
      });

      const response = await request(app)
        .post('/api/processing/command')
        .set('Authorization', 'Bearer test')
        .send({
          session_id: 'test_session',
          command: '훈련',
          general_id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        result: true,
        commandData: expect.objectContaining({ name: '훈련' }),
      });
    });

    it('서비스 오류 시 400과 에러 메시지를 반환한다', async () => {
      jest.spyOn(GetProcessingCommandService, 'execute').mockRejectedValue(new Error('데이터 조회 실패'));

      const response = await request(app)
        .post('/api/processing/command')
        .set('Authorization', 'Bearer test')
        .send({ session_id: 'test_session', command: '훈련' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: '데이터 조회 실패' });
    });
  });

  describe('/api/command/reserve-command', () => {
    it('단일 턴 명령을 성공적으로 예약한다', async () => {
      jest.spyOn(ReserveCommandService, 'execute').mockResolvedValue({
        success: true,
        result: true,
        turn_idx: 3,
        action: '훈련',
      });

      const response = await request(app)
        .post('/api/command/reserve-command')
        .set('Authorization', 'Bearer test')
        .send({
          session_id: 'test_session',
          general_id: 1,
          turn_idx: 3,
          action: '훈련',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true, turn_idx: 3 });
    });

    it('서비스에서 검증 실패 시 400으로 전달된다', async () => {
      jest.spyOn(ReserveCommandService, 'execute').mockResolvedValue({
        success: false,
        message: 'turn_idx는 0-29 사이여야 합니다',
        result: false,
      });

      const response = await request(app)
        .post('/api/command/reserve-command')
        .set('Authorization', 'Bearer test')
        .send({
          session_id: 'test_session',
          general_id: 1,
          turn_idx: 99,
          action: '훈련',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, message: 'turn_idx는 0-29 사이여야 합니다', result: false });
    });
  });

  describe('/api/gin7/session', () => {
    it('세션 상태를 반환한다', async () => {
      jest.spyOn(Gin7FrontendService, 'resolveCharacter').mockResolvedValue({
        characterId: 'char-1',
        faction: 'alliance',
      } as any);
      jest.spyOn(Gin7FrontendService, 'getSessionOverview').mockResolvedValue({
        factions: [],
        timeline: [],
      } as any);

      const response = await request(app)
        .get('/api/gin7/session')
        .set('Authorization', 'Bearer test')
        .query({ sessionId: 'test_session' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        schemaVersion: expect.stringContaining('state.session'),
        data: expect.any(Object),
      });
    });

    it('세션 식별자가 없으면 401을 반환한다', async () => {
      jest.spyOn(Gin7FrontendService, 'resolveCharacter').mockResolvedValue(null as any);

      const response = await request(app)
        .get('/api/gin7/session')
        .set('x-test-anon', 'true');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ success: false, message: '세션 식별자가 필요합니다.' });
    });
  });

  describe('/api/logh/commands/available', () => {
    it('사용 가능한 LOGH 커맨드 목록을 반환한다', async () => {
      const response = await request(app)
        .get('/api/logh/commands/available')
        .set('Authorization', 'Bearer test')
        .query({ sessionId: 'test_session' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.commands)).toBe(true);
      expect(response.body.commands[0]).toMatchObject({ displayName: expect.any(String) });
    });

    it('세션이 일치하지 않으면 403을 반환한다', async () => {
      const response = await request(app)
        .get('/api/logh/commands/available')
        .set('Authorization', 'Bearer test')
        .query({ sessionId: 'other_session' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ success: false, message: '세션이 일치하지 않습니다' });
    });
  });
});
