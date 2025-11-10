/**
 * LOGH Command API Routes
 * 은하영웅전설 커맨드 실행 API
 */

import { Router } from 'express';
import { LoghCommander } from '../../models/logh/Commander.model';
import { Fleet } from '../../models/logh/Fleet.model';
import { MoveFleetCommand } from '../../commands/logh/MoveFleet';
import { IssueOperationCommand } from '../../commands/logh/IssueOperation';
import { authenticate, validateSession } from '../../middleware/auth';
import { ILoghCommandContext } from '../../commands/logh/BaseLoghCommand';

const router = Router();

/**
 * POST /api/logh/command/execute
 * 커맨드 실행
 */
router.post('/command/execute', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const userId = req.user?.userId;
    const { command, params } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command name required' });
    }

    // 커맨더 조회 (TODO: userId 매핑)
    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      isActive: true,
    });

    if (!commander) {
      return res.status(404).json({ error: 'Commander not found' });
    }

    // 함대 조회
    let fleet = null;
    if (commander.fleetId) {
      fleet = await Fleet.findOne({
        session_id: sessionId,
        id: commander.fleetId,
      });
    }

    // 커맨드 인스턴스 생성
    let commandInstance;
    switch (command) {
      case 'move_fleet':
        commandInstance = new MoveFleetCommand();
        break;
      case 'issue_operation':
        commandInstance = new IssueOperationCommand();
        break;
      default:
        return res.status(400).json({ error: `Unknown command: ${command}` });
    }

    // 커맨더를 ILoghCommandExecutor 인터페이스로 래핑
    const commanderExecutor = {
      no: commander.no,
      session_id: commander.session_id,
      getVar: (key: string) => (commander as any)[key],
      setVar: (key: string, value: any) => {
        (commander as any)[key] = value;
      },
      increaseVar: (key: string, value: number) => {
        const current = (commander as any)[key] || 0;
        (commander as any)[key] = current + value;
      },
      decreaseVar: (key: string, value: number) => {
        const current = (commander as any)[key] || 0;
        (commander as any)[key] = current - value;
      },
      getNationID: () => 0, // TODO: implement
      getFactionType: () => commander.faction,
      getRank: () => commander.rank,
      getCommandPoints: () => commander.commandPoints,
      consumeCommandPoints: (amount: number) => {
        commander.commandPoints = Math.max(0, commander.commandPoints - amount);
      },
      getFleetId: () => commander.fleetId,
      getPosition: () => commander.position,
      startCommand: (commandType: string, durationMs: number, data?: any) => {
        // Store command execution data in customData
        if (!commander.customData) commander.customData = {};
        commander.customData.activeCommand = {
          type: commandType,
          startedAt: new Date(),
          durationMs,
          data: data || {},
        };
      },
      save: async () => await commander.save(),
    };

    // 커맨드 컨텍스트 생성
    const context: ILoghCommandContext = {
      commander: commanderExecutor,
      fleet,
      session: req.sessionInstance,
      env: params || {},
    };

    // 실행 가능 여부 체크
    const checkResult = await commandInstance.checkConditionExecutable(context);
    if (checkResult !== null) {
      return res.status(400).json({
        error: checkResult,
        success: false
      });
    }

    // 커맨드 실행
    const result = await commandInstance.execute(context);

    res.json({
      success: result.success,
      message: result.message,
      effects: result.effects,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/logh/commands/available
 * 사용 가능한 커맨드 목록
 */
router.get('/commands/available', authenticate, validateSession, async (req, res) => {
  try {
    const commands = [
      {
        name: 'move_fleet',
        displayName: '함대 이동',
        category: 'fleet',
        requiredCP: 2,
        description: '함대를 지정한 좌표로 워프 항행시킵니다.',
      },
      {
        name: 'issue_operation',
        displayName: '작전 발령',
        category: 'strategic',
        requiredCP: 5,
        description: '복수의 함대를 조율하는 작전 계획을 발령합니다.',
      },
    ];

    res.json({ commands });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
