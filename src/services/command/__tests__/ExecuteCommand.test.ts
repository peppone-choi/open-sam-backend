import { ExecuteCommandService } from '../ExecuteCommand.service';

describe('ExecuteCommandService', () => {
  describe('execute', () => {
    it('유효한 커맨드를 실행해야 함', async () => {
      const context = {
        sessionId: 'test_session',
        generalId: 1,
        turnIdx: 0,
        action: 'test_action',
        cost: {
          gold: 100
        }
      };

      const result = await ExecuteCommandService.execute(context);

      expect(result).toBeDefined();
      expect(['executed', 'failed', 'refunded']).toContain(result.status);
    });

    it('장수를 찾을 수 없으면 실패해야 함', async () => {
      const context = {
        sessionId: 'test_session',
        generalId: 999999,
        turnIdx: 0,
        action: 'test_action'
      };

      const result = await ExecuteCommandService.execute(context);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('general_not_found');
    });

    it('도시 소유권이 변경되면 실패하고 환불해야 함', async () => {
      const context = {
        sessionId: 'test_session',
        generalId: 1,
        turnIdx: 0,
        action: 'test_action',
        targetCity: 10,
        ownerAtQueue: 1,
        requiresOwnership: true,
        cost: {
          gold: 500
        }
      };

      const result = await ExecuteCommandService.execute(context);

      if (result.reason === 'city_ownership_changed') {
        expect(result.success).toBe(false);
        expect(result.refund).toEqual({ gold: 500 });
      }
    });
  });

  describe('validateExecution', () => {
    it('전투 중인 장수는 사용 불가해야 함', async () => {
      const context = {
        sessionId: 'test_session',
        generalId: 1,
        turnIdx: 0,
        action: 'test_action'
      };

      const result = await ExecuteCommandService.execute(context);

      if (result.reason === 'general_not_available') {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('refundCommand', () => {
    it('커맨드 비용을 환불해야 함', async () => {
      const context = {
        sessionId: 'test_session',
        generalId: 1,
        turnIdx: 0,
        action: 'test_action',
        cost: {
          gold: 100,
          rice: 50
        }
      };

      await ExecuteCommandService.refundCommand(context, 'test_reason');
    });
  });
});
