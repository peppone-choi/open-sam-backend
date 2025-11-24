/**
 * LOGH Command API Routes
 * 은하영웅전설 커맨드 실행 API
 * 
 * 동적 커맨드 로딩 시스템 사용 (97개 커맨드 자동 지원)
 */

import { Router } from 'express';
import { LoghCommander } from '../../models/logh/Commander.model';
import { Fleet } from '../../models/logh/Fleet.model';
import { commandRegistry } from '../../commands/logh/CommandRegistry';
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
    const userId = req.user?.userId || req.user?.id;
    const { command, params } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: '세션 정보가 필요합니다.' });
    }

    if (!userId) {
      return res.status(401).json({ error: '로그인한 사용자 정보가 필요합니다.' });
    }

    if (!command) {
      return res.status(400).json({ error: '실행할 커맨드 이름이 필요합니다.' });
    }

    // 커맨더 조회 (1차 강화: ownerUserId 기반)
    // TODO: 현재 ownerUserId를 채우는 경로는 시나리오/세션 서비스에서 아직 완성되지 않았습니다.
    //       실 서비스에서는 join 시점에 commander-사용자 매핑을 생성해야 합니다.

    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      isActive: true,
      ownerUserId: userId,
    });

    if (!commander) {
      // 구조만 존재하고 실제 매핑이 없는 경우를 방지하기 위한 guard
      return res.status(403).json({
        error: '현재 세션에서 이 사용자에게 소유된 LOGH 커맨더를 찾을 수 없습니다. (테스트용 엔드포인트이며, 실 서비스에서는 커맨더-사용자 소유권 검증이 필요합니다.)',
      });
    }


    // 함대 조회
    let fleet = null;
    if (commander.fleetId) {
      fleet = await Fleet.findOne({
        session_id: sessionId,
        id: commander.fleetId,
      });
    }

    // 커맨드 인스턴스 가져오기 (동적 로딩)
    const commandInstance = commandRegistry.getCommand(command);
    if (!commandInstance) {
      return res.status(400).json({ 
        error: `알 수 없는 커맨드입니다: ${command}`,
        availableCommands: commandRegistry.getAllCommandNames().slice(0, 10), // 처음 10개만 표시
        totalCommands: commandRegistry.getAllCommandNames().length
      });
    }

    // 커맨더를 ILoghCommandExecutor 인터페이스로 래핑
    const commanderExecutor = {
      no: commander.no,
      session_id: commander.session_id,
      data: commander,
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
      getNationID: () => commander.faction === 'empire' ? 1 : 2,
      getFactionType: () => commander.faction,
      getRank: () => commander.getRankName(),
      getCommandPoints: () => commander.commandPoints.military,
      consumeCommandPoints: (amount: number, type: 'PCP' | 'MCP' = 'MCP') => {
        if (type === 'PCP') {
          commander.commandPoints.personal = Math.max(0, commander.commandPoints.personal - amount);
        } else {
          commander.commandPoints.military = Math.max(0, commander.commandPoints.military - amount);
        }
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
    res.status(500).json({ error: '커맨드 처리 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/logh/commands/available
 * 사용 가능한 커맨드 목록 (동적 생성)
 */
router.get('/commands/available', authenticate, validateSession, async (req, res) => {
  try {
    const { category } = req.query;
    
    let commandList;
    if (category && typeof category === 'string') {
      // 카테고리별 필터링
      commandList = commandRegistry.getCommandsByCategory(category as any);
    } else {
      // 전체 커맨드 목록
      const allNames = commandRegistry.getAllCommandNames();
      commandList = allNames.map(name => commandRegistry.getCommand(name)).filter(cmd => cmd !== null);
    }

    const commands = commandList.map(cmd => ({
      name: cmd!.getName(),
      displayName: cmd!.getDisplayName(),
      category: cmd!.getCategory(),
      requiredCP: cmd!.getRequiredCommandPoints(),
      requiredTurns: cmd!.getRequiredTurns(),
      description: cmd!.getDescription(),
    }));

    const stats = commandRegistry.getStats();

    res.json({ 
      commands,
      total: commands.length,
      stats,
      schemaVersion: '2025-11-24.command-registry.1',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
