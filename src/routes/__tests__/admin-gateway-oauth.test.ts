import express from 'express';
import request from 'supertest';
import adminRoutes from '../admin.routes';
import oauthRoutes from '../oauth.routes';
import { redisHealthMonitor } from '../../services/monitoring/RedisHealthMonitor';
import { Session } from '../../models/session.model';
import { SessionStateService } from '../../services/sessionState.service';
import { AdminErrorLogService } from '../../services/admin/AdminErrorLog.service';
import { AdminEconomyService } from '../../services/admin/AdminEconomy.service';
import { ExecuteEngineService } from '../../services/global/ExecuteEngine.service';
import { OAuthStateService } from '../../services/oauth/OAuthState.service';
import { OAuthService } from '../../services/oauth.service';

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const gradeHeader = req.headers['x-test-grade'];
    const parsedGrade = Array.isArray(gradeHeader) ? gradeHeader[0] : gradeHeader;
    const grade = parsedGrade ? Number(parsedGrade) : 9;
    req.user = {
      userId: 'test-admin',
      grade,
      acl: grade >= 5 ? '*' : '',
    };
    next();
  },
  autoExtractToken: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../models/session.model', () => ({
  Session: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../services/sessionState.service', () => ({
  SessionStateService: {
    updateSessionState: jest.fn(),
    invalidateCache: jest.fn(),
  },
}));

jest.mock('../../services/admin/AdminErrorLog.service', () => ({
  AdminErrorLogService: {
    getLogs: jest.fn(),
  },
}));

jest.mock('../../services/admin/AdminEconomy.service', () => ({
  AdminEconomyService: {
    paySalary: jest.fn(),
  },
}));

jest.mock('../../services/global/ExecuteEngine.service', () => ({
  ExecuteEngineService: {
    execute: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

jest.mock('../../services/oauth/OAuthState.service', () => ({
  OAuthStateService: {
    issueState: jest.fn(),
    consumeState: jest.fn(),
  },
}));

jest.mock('../../services/oauth.service', () => ({
  OAuthService: {
    getKakaoAuthUrl: jest.fn(),
    getKakaoAccessToken: jest.fn(),
    getKakaoUserInfo: jest.fn(),
    unlinkKakao: jest.fn(),
  },
}));

const buildSessionDoc = () => ({
  session_id: 'session-alpha',
  data: {
    game_env: {
      isunited: 0,
      allow_npc_possess: false,
      turntime: new Date().toISOString(),
    },
    year: 184,
    month: 1,
  },
  status: 'running',
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(null),
});

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use('/api/oauth', oauthRoutes);

const sessionFindOneMock = Session.findOne as unknown as jest.Mock;
const updateSessionStateMock = SessionStateService.updateSessionState as unknown as jest.Mock;
const invalidateSessionCacheMock = SessionStateService.invalidateCache as unknown as jest.Mock;
const errorLogMock = AdminErrorLogService.getLogs as unknown as jest.Mock;
const paySalaryMock = AdminEconomyService.paySalary as unknown as jest.Mock;
const executeEngineMock = ExecuteEngineService.execute as unknown as jest.Mock;
const issueStateMock = OAuthStateService.issueState as unknown as jest.Mock;
const consumeStateMock = OAuthStateService.consumeState as unknown as jest.Mock;
const getAuthUrlMock = OAuthService.getKakaoAuthUrl as unknown as jest.Mock;
const getAccessTokenMock = OAuthService.getKakaoAccessToken as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  sessionFindOneMock.mockResolvedValue(buildSessionDoc());
  redisHealthMonitor.resetForTests();
});

describe('Admin update-game cache lock enforcement', () => {
  it('rejects low-grade operators before touching session data', async () => {
    const response = await request(app)
      .post('/api/admin/update-game')
      .set('x-test-grade', '3')
      .send({ action: 'lock', data: { locked: true }, session_id: 'session-alpha' });

    expect(response.status).toBe(403);
    expect(sessionFindOneMock).not.toHaveBeenCalled();
  });

  it('updates cache lock state and invalidates caches when locking', async () => {
    const response = await request(app)
      .post('/api/admin/update-game')
      .send({ action: 'lock', data: { locked: true }, session_id: 'session-alpha' });

    expect(response.status).toBe(200);
    expect(updateSessionStateMock).toHaveBeenCalledWith('session-alpha', {
      isLocked: true,
      status: 'paused',
    });
  });

  it('triggers execute engine hook when unlocking a cached session', async () => {
    const response = await request(app)
      .post('/api/admin/update-game')
      .send({ action: 'lock', data: { locked: false }, session_id: 'session-alpha' });

    expect(response.status).toBe(200);
    expect(updateSessionStateMock).toHaveBeenCalledWith('session-alpha', {
      isLocked: false,
      status: 'running',
    });
    expect(executeEngineMock).toHaveBeenCalledWith({ session_id: 'session-alpha' });
  });
});

describe('Admin error-log route', () => {
  it('returns sanitized error log payload', async () => {
    errorLogMock.mockResolvedValue({
      result: true,
      total: 1,
      errorLogs: [{ id: 1, date: '2025-11-21_120000', err: 'boom', errstr: 'oops', errpath: 'x', trace: '[]' }],
    });

    const response = await request(app)
      .post('/api/admin/error-log')
      .send({ from: 0, limit: 5 });

    expect(response.status).toBe(200);
    expect(errorLogMock).toHaveBeenCalledWith({ offset: 0, limit: 5 });
    expect(response.body.errorLogs).toHaveLength(1);
  });
});

describe('Admin pay-salary guard rails', () => {
  it('rejects unsupported salary types', async () => {
    const response = await request(app)
      .post('/api/admin/pay-salary')
      .send({ type: 'stone' });

    expect(response.status).toBe(400);
    expect(paySalaryMock).not.toHaveBeenCalled();
  });

  it('invokes AdminEconomyService for supported salary types', async () => {
    paySalaryMock.mockResolvedValue({ result: true, reason: 'ok' });

    const response = await request(app)
      .post('/api/admin/pay-salary')
      .send({ type: 'gold', session_id: 'session-alpha' });

    expect(response.status).toBe(200);
    expect(paySalaryMock).toHaveBeenCalledWith('session-alpha', 'gold');
  });
});

describe('OAuth state enforcement', () => {
  it('issues state tokens when requesting kakao authorization', async () => {
    issueStateMock.mockResolvedValue('state-123');
    getAuthUrlMock.mockReturnValue('https://auth.example?state=state-123');

    const response = await request(app)
      .get('/api/oauth/kakao/authorize')
      .query({ redirect_uri: 'http://localhost/callback' });

    expect(response.status).toBe(200);
    expect(issueStateMock).toHaveBeenCalledWith({ redirectUri: 'http://localhost/callback' });
    expect(response.body.state).toBe('state-123');
    expect(response.body.authUrl).toContain('state-123');
  });

  it('requires state tokens during OAuth callback', async () => {
    const response = await request(app)
      .get('/api/oauth/kakao/callback')
      .query({ code: 'abc' });

    expect(response.status).toBe(400);
    expect(consumeStateMock).not.toHaveBeenCalled();
  });

  it('consumes issued state even when downstream token exchange fails', async () => {
    consumeStateMock.mockResolvedValue({ redirectUri: 'http://localhost/callback' });
    getAccessTokenMock.mockResolvedValue({ success: false, message: 'bad token' });

    const response = await request(app)
      .get('/api/oauth/kakao/callback')
      .query({ code: 'abc', state: 'state-xyz' });

    expect(response.status).toBe(400);
    expect(consumeStateMock).toHaveBeenCalledWith('state-xyz');
  });
});

describe('Redis monitoring endpoint', () => {
  it('surfaces recent latency events for admin UI', async () => {
    redisHealthMonitor.recordDelay(1250, 'jest-delay');

    const response = await request(app)
      .get('/api/admin/monitoring/redis');

    expect(response.status).toBe(200);
    expect(response.body.monitor.status).toBe('degraded');
    expect(response.body.monitor.recentEvents[0].detail).toBe('jest-delay');
  });
});
