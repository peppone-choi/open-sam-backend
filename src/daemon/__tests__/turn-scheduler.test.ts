import { TurnScheduler } from '../turn-scheduler';

jest.mock('../../models/session.model', () => ({
  Session: {
    find: jest.fn(),
  },
}));

jest.mock('../../services/global/ExecuteEngine.service', () => ({
  ExecuteEngineService: {
    execute: jest.fn(),
  },
}));

const { Session } = require('../../models/session.model');
const { ExecuteEngineService } = require('../../services/global/ExecuteEngine.service');

const mockSessionFind = Session.find as jest.Mock;
const mockExecute = ExecuteEngineService.execute as jest.Mock;

describe('TurnScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSessionFind.mockReset();
    mockExecute.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs ExecuteEngine for scheduled sessions', async () => {
    const now = Date.now();
    mockSessionFind.mockResolvedValue([
      {
        session_id: 's1',
        status: 'running',
        data: { turntime: new Date(now + 50).toISOString() },
      },
    ]);
    mockExecute.mockResolvedValue({ success: true, updated: true, turntime: new Date(now + 1000).toISOString() });

    const scheduler = new TurnScheduler({ pollIntervalMs: 1_000, jitterMs: 0, maxConcurrentSessions: 1 });
    await scheduler.start();
    expect(mockSessionFind).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60);
    await Promise.resolve();

    expect(mockExecute).toHaveBeenCalledWith({ session_id: 's1' });

    scheduler.stop();
  });

  it('queues sessions when reaching concurrency limit', async () => {
    const now = Date.now();
    mockSessionFind.mockResolvedValue([
      { session_id: 'a', status: 'running', data: { turntime: new Date(now + 10).toISOString() } },
      { session_id: 'b', status: 'running', data: { turntime: new Date(now + 15).toISOString() } },
    ]);

    let resolveFirst: (() => void) | null = null;
    mockExecute.mockImplementation(({ session_id }: { session_id: string }) => {
      return new Promise((resolve) => {
        if (session_id === 'a') {
          resolveFirst = () => resolve({ success: true, updated: true, turntime: new Date(now + 1000).toISOString() });
        } else {
          resolve({ success: true, updated: true, turntime: new Date(now + 1000).toISOString() });
        }
      });
    });

    const scheduler = new TurnScheduler({ pollIntervalMs: 1_000, jitterMs: 0, maxConcurrentSessions: 1 });
    await scheduler.start();

    jest.advanceTimersByTime(20);
    await Promise.resolve();
    expect(mockExecute).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(20);
    await Promise.resolve();
    expect(mockExecute).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockExecute).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });
});
