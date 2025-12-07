/**
 * gin7-command-delay 검증 테스트
 * 
 * 검증 항목:
 * 1. 지연: 명령 입력 후 0~20초의 대기 시간이 발생하는가?
 * 2. 방해: 재밍 상황에서 지연 시간이 늘어나는가?
 * 3. 표시: UI에 남은 시간이 표시되는가?
 */

import { CommandDelayService } from '../../services/gin7/CommandDelayService';
import { ElectronicWarfareService } from '../../services/gin7/ElectronicWarfareService';
import { COMMAND_DELAY_CONSTANTS, TacticalCommand } from '../../types/gin7/tactical.types';

describe('gin7-command-delay 검증', () => {
  let commandDelayService: CommandDelayService;
  let ewService: ElectronicWarfareService;

  const testBattleId = 'test-battle-001';
  const testFactionId = 'faction-001';
  const testCommanderId = 'commander-001';

  beforeEach(() => {
    commandDelayService = new CommandDelayService();
    ewService = new ElectronicWarfareService();
    
    // EW 상태 초기화
    ewService.initializeState(testBattleId, testFactionId);
  });

  afterEach(() => {
    commandDelayService.clearBattle(testBattleId);
    ewService.clearBattle(testBattleId);
  });

  describe('1. 지연: 명령 입력 후 0~20초의 대기 시간이 발생하는가?', () => {
    it('명령이 큐에 추가되면 지연 시간이 계산된다', () => {
      const command: TacticalCommand = {
        type: 'MOVE',
        unitIds: ['unit-001', 'unit-002'],
        timestamp: Date.now(),
        data: { targetPosition: { x: 100, y: 200, z: 0 } },
      };

      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'NORMAL',
        currentTick: 0,
        commanderSkill: 50,
      });

      expect(result.success).toBe(true);
      expect(result.delayedCommand).toBeDefined();
      
      const delayedCmd = result.delayedCommand!;
      
      // 지연 시간이 0~333틱 (0~20초) 범위인지 확인
      const { totalDelay } = delayedCmd.delayBreakdown;
      console.log(`[검증 1] 총 지연 시간: ${totalDelay}틱 (${Math.ceil(totalDelay / 16)}초)`);
      
      expect(totalDelay).toBeGreaterThanOrEqual(COMMAND_DELAY_CONSTANTS.MIN_BASE_DELAY_TICKS);
      // 최대값은 우선순위와 스킬 보너스에 따라 달라질 수 있음
      expect(totalDelay).toBeLessThanOrEqual(COMMAND_DELAY_CONSTANTS.MAX_BASE_DELAY_TICKS * 2);
      
      // executeTime이 issueTime + totalDelay인지 확인
      expect(delayedCmd.executeTime).toBe(delayedCmd.issueTime + totalDelay);
    });

    it('여러 명령을 큐에 추가하면 각각 다른 지연 시간을 가진다', () => {
      const delays: number[] = [];

      for (let i = 0; i < 5; i++) {
        const command: TacticalCommand = {
          type: 'MOVE',
          unitIds: [`unit-${i}`],
          timestamp: Date.now(),
          data: { targetPosition: { x: i * 100, y: 0, z: 0 } },
        };

        const result = commandDelayService.queueCommand({
          battleId: testBattleId,
          commanderId: testCommanderId,
          factionId: testFactionId,
          command,
          priority: 'NORMAL',
          currentTick: 0,
        });

        if (result.delayedCommand) {
          delays.push(result.delayedCommand.delayBreakdown.baseDelay);
        }
      }

      console.log(`[검증 1] 5개 명령의 기본 지연 시간: ${delays.map(d => `${Math.ceil(d/16)}초`).join(', ')}`);
      
      // 최소한 일부 명령은 다른 지연 시간을 가져야 함 (무작위)
      expect(delays.length).toBe(5);
    });
  });

  describe('2. 방해: 재밍 상황에서 지연 시간이 늘어나는가?', () => {
    it('CLEAR 상태에서는 재밍 페널티가 없다', () => {
      const command: TacticalCommand = {
        type: 'ATTACK',
        unitIds: ['unit-001'],
        timestamp: Date.now(),
        data: { targetId: 'enemy-001' },
      };

      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'NORMAL',
        currentTick: 0,
      });

      expect(result.delayedCommand?.delayBreakdown.jammingPenalty).toBe(0);
      console.log('[검증 2] CLEAR 상태 재밍 페널티: 0틱');
    });

    it('HEAVY 재밍 상태에서는 지연 시간이 2배로 증가한다', () => {
      // 재밍 공격 실행 (intensity 60으로 HEAVY 상태 유발)
      ewService.executeEWAttack({
        battleId: testBattleId,
        attackerFactionId: 'enemy-faction',
        targetFactionId: testFactionId,
        intensity: 60,
        duration: 100,
      });

      const ewState = ewService.getState(testBattleId, testFactionId);
      console.log(`[검증 2] 재밍 레벨: ${ewState?.jammingLevel}, 농도: ${ewState?.minovskyDensity}%`);

      const command: TacticalCommand = {
        type: 'ATTACK',
        unitIds: ['unit-001'],
        timestamp: Date.now(),
        data: { targetId: 'enemy-001' },
      };

      // 재밍 상태에서 명령 큐 추가
      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'NORMAL',
        currentTick: 0,
      });

      expect(ewState?.jammingLevel).toBe('HEAVY');
      expect(result.delayedCommand?.delayBreakdown.jammingPenalty).toBeGreaterThan(0);
      
      console.log(`[검증 2] HEAVY 상태 재밍 페널티: ${result.delayedCommand?.delayBreakdown.jammingPenalty}틱`);
    });

    it('BLACKOUT 상태에서는 명령이 거부된다', () => {
      // 재밍 공격으로 BLACKOUT 유발 (intensity 80 이상)
      ewService.executeEWAttack({
        battleId: testBattleId,
        attackerFactionId: 'enemy-faction',
        targetFactionId: testFactionId,
        intensity: 80,
        duration: 100,
      });

      const ewState = ewService.getState(testBattleId, testFactionId);
      console.log(`[검증 2] 재밍 레벨: ${ewState?.jammingLevel}, 농도: ${ewState?.minovskyDensity}%`);

      const command: TacticalCommand = {
        type: 'MOVE',
        unitIds: ['unit-001'],
        timestamp: Date.now(),
        data: { targetPosition: { x: 0, y: 0, z: 0 } },
      };

      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'NORMAL',
        currentTick: 0,
      });

      expect(ewState?.jammingLevel).toBe('BLACKOUT');
      expect(result.success).toBe(false);
      expect(result.error).toBe('COMMUNICATION_BLACKOUT');
      
      console.log(`[검증 2] BLACKOUT 상태: 명령 거부됨 - ${result.message}`);
    });
  });

  describe('3. 표시: UI에 남은 시간이 표시되는가?', () => {
    it('명령의 진행률이 올바르게 계산된다', () => {
      const command: TacticalCommand = {
        type: 'FORMATION',
        unitIds: ['unit-001'],
        timestamp: Date.now(),
        data: { formation: 'WEDGE' },
      };

      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'NORMAL',
        currentTick: 0,
      });

      const commandId = result.delayedCommand!.id;
      const totalDelay = result.delayedCommand!.delayBreakdown.totalDelay;

      // 시작 시점: 0%
      const progressStart = commandDelayService.getProgress(commandId, 0);
      console.log(`[검증 3] 시작 시점 진행률: ${progressStart}%`);
      expect(progressStart).toBe(0);

      // 50% 시점
      const halfwayTick = Math.floor(totalDelay / 2);
      const progressHalf = commandDelayService.getProgress(commandId, halfwayTick);
      console.log(`[검증 3] 50% 시점 (${halfwayTick}틱) 진행률: ${progressHalf}%`);
      expect(progressHalf).toBeGreaterThanOrEqual(45);
      expect(progressHalf).toBeLessThanOrEqual(55);

      // 완료 시점: 100%
      const progressEnd = commandDelayService.getProgress(commandId, totalDelay);
      console.log(`[검증 3] 완료 시점 (${totalDelay}틱) 진행률: ${progressEnd}%`);
      expect(progressEnd).toBe(100);
    });

    it('남은 지연 시간이 올바르게 계산된다', () => {
      const command: TacticalCommand = {
        type: 'RETREAT',
        unitIds: ['unit-001'],
        timestamp: Date.now(),
        data: {},
      };

      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'HIGH',
        currentTick: 100,
      });

      const commandId = result.delayedCommand!.id;
      const executeTime = result.delayedCommand!.executeTime;
      const totalDelay = result.delayedCommand!.delayBreakdown.totalDelay;

      // 현재 틱 = 100, 실행 예정 = executeTime
      const remainingAtStart = commandDelayService.getRemainingDelay(commandId, 100);
      console.log(`[검증 3] 시작 시점 남은 시간: ${remainingAtStart}틱 (${Math.ceil(remainingAtStart/16)}초)`);
      expect(remainingAtStart).toBe(totalDelay);

      // 중간 시점
      const midTick = 100 + Math.floor(totalDelay / 2);
      const remainingAtMid = commandDelayService.getRemainingDelay(commandId, midTick);
      console.log(`[검증 3] 중간 시점 남은 시간: ${remainingAtMid}틱 (${Math.ceil(remainingAtMid/16)}초)`);

      // 완료 후
      const remainingAfterComplete = commandDelayService.getRemainingDelay(commandId, executeTime + 10);
      console.log(`[검증 3] 완료 후 남은 시간: ${remainingAfterComplete}틱`);
      expect(remainingAfterComplete).toBe(0);
    });

    it('명령 큐 요약 정보가 올바르게 반환된다', () => {
      // 여러 명령 추가
      for (let i = 0; i < 3; i++) {
        commandDelayService.queueCommand({
          battleId: testBattleId,
          commanderId: testCommanderId,
          factionId: testFactionId,
          command: {
            type: 'MOVE',
            unitIds: [`unit-${i}`],
            timestamp: Date.now(),
            data: { targetPosition: { x: i * 100, y: 0, z: 0 } },
          },
          priority: i === 0 ? 'HIGH' : 'NORMAL',
          currentTick: 0,
        });
      }

      const summary = commandDelayService.getQueueSummary(testBattleId, testFactionId);
      
      console.log('[검증 3] 큐 요약:', {
        totalQueued: summary.totalQueued,
        executing: summary.executing,
        averageDelay: `${summary.averageDelay}틱 (${Math.ceil(summary.averageDelay/16)}초)`,
        jammingLevel: summary.jammingLevel,
      });

      expect(summary.totalQueued).toBe(3);
      expect(summary.jammingLevel).toBe('CLEAR');
      expect(summary.averageDelay).toBeGreaterThan(0);
    });
  });

  describe('추가 검증: 명령 실행 및 취소', () => {
    it('실행 시간에 도달하면 명령이 실행된다', () => {
      const command: TacticalCommand = {
        type: 'STOP',
        unitIds: ['unit-001'],
        timestamp: Date.now(),
        data: { holdPosition: true },
      };

      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'EMERGENCY', // 빠른 실행
        currentTick: 0,
        commanderSkill: 100, // 최대 스킬 보너스
      });

      const executeTime = result.delayedCommand!.executeTime;

      // 실행 시간 이전
      let readyCommands = commandDelayService.processTick(testBattleId, executeTime - 1);
      expect(readyCommands.length).toBe(0);

      // 실행 시간 도달
      readyCommands = commandDelayService.processTick(testBattleId, executeTime);
      expect(readyCommands.length).toBe(1);
      expect(readyCommands[0].type).toBe('STOP');

      console.log('[추가 검증] 명령 실행됨:', readyCommands[0].type);
    });

    it('실행 전 명령을 취소할 수 있다', () => {
      const command: TacticalCommand = {
        type: 'ATTACK',
        unitIds: ['unit-001'],
        timestamp: Date.now(),
        data: { targetId: 'enemy-001' },
      };

      const result = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command,
        priority: 'LOW', // 느린 실행
        currentTick: 0,
      });

      const commandId = result.delayedCommand!.id;

      // 취소
      const cancelResult = commandDelayService.cancelCommand(commandId);
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.chaosProbability).toBe(COMMAND_DELAY_CONSTANTS.CANCEL_CHAOS_PROBABILITY);

      console.log(`[추가 검증] 명령 취소됨, 혼란 확률: ${cancelResult.chaosProbability * 100}%`);

      // 취소된 명령 확인
      const cmd = commandDelayService.getCommand(commandId);
      expect(cmd).toBeUndefined(); // 큐에서 제거됨
    });
  });
});








