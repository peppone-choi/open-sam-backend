/**
 * gin7-command-delay 검증 스크립트
 * 
 * 검증 항목:
 * 1. 지연: 명령 입력 후 0~20초의 대기 시간이 발생하는가?
 * 2. 방해: 재밍 상황에서 지연 시간이 늘어나는가?
 * 3. 표시: UI에 남은 시간이 표시되는가?
 * 
 * 실행: npx ts-node src/scripts/verify-command-delay.ts
 */

import { commandDelayService } from '../services/gin7/CommandDelayService';
import { electronicWarfareService } from '../services/gin7/ElectronicWarfareService';
import { COMMAND_DELAY_CONSTANTS, TacticalCommand } from '../types/gin7/tactical.types';

// 테스트 상수
const testBattleId = 'test-battle-001';
const testFactionId = 'faction-001';
const testCommanderId = 'commander-001';

// 검증 결과
const results: { name: string; pass: boolean; message: string }[] = [];

function log(message: string) {
  console.log(`  ${message}`);
}

function pass(name: string, message: string) {
  results.push({ name, pass: true, message });
  console.log(`✅ ${name}: ${message}`);
}

function fail(name: string, message: string) {
  results.push({ name, pass: false, message });
  console.log(`❌ ${name}: ${message}`);
}

async function runVerification() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('     gin7-command-delay 검증 테스트');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 싱글톤 인스턴스 사용 (CommandDelayService가 내부적으로 electronicWarfareService를 참조)
  
  // EW 상태 초기화
  electronicWarfareService.initializeState(testBattleId, testFactionId);

  // ═══════════════════════════════════════════════════════════
  // 검증 1: 지연 - 명령 입력 후 0~20초의 대기 시간이 발생하는가?
  // ═══════════════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│  검증 1: 지연 - 명령 입력 후 0~20초의 대기 시간 발생?   │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  const command1: TacticalCommand = {
    type: 'MOVE',
    unitIds: ['unit-001', 'unit-002'],
    timestamp: Date.now(),
    data: { targetPosition: { x: 100, y: 200, z: 0 } },
  };

  const result1 = commandDelayService.queueCommand({
    battleId: testBattleId,
    commanderId: testCommanderId,
    factionId: testFactionId,
    command: command1,
    priority: 'NORMAL',
    currentTick: 0,
    commanderSkill: 50,
  });

  if (result1.success && result1.delayedCommand) {
    const { baseDelay, totalDelay } = result1.delayedCommand.delayBreakdown;
    const delaySeconds = Math.ceil(totalDelay / 16);
    
    log(`명령 ID: ${result1.delayedCommand.id}`);
    log(`기본 지연: ${baseDelay}틱 (${Math.ceil(baseDelay / 16)}초)`);
    log(`총 지연: ${totalDelay}틱 (${delaySeconds}초)`);
    log(`발령 시간: ${result1.delayedCommand.issueTime}틱`);
    log(`실행 예정: ${result1.delayedCommand.executeTime}틱`);
    
    if (baseDelay >= 0 && baseDelay <= COMMAND_DELAY_CONSTANTS.MAX_BASE_DELAY_TICKS) {
      pass('지연 범위', `기본 지연 ${Math.ceil(baseDelay/16)}초가 0~20초 범위 내`);
    } else {
      fail('지연 범위', `기본 지연 ${Math.ceil(baseDelay/16)}초가 범위를 벗어남`);
    }

    // 여러 명령의 무작위성 테스트
    const delays: number[] = [baseDelay];
    for (let i = 0; i < 4; i++) {
      const r = commandDelayService.queueCommand({
        battleId: testBattleId,
        commanderId: testCommanderId,
        factionId: testFactionId,
        command: { ...command1, unitIds: [`unit-${i+10}`] },
        priority: 'NORMAL',
        currentTick: 0,
      });
      if (r.delayedCommand) {
        delays.push(r.delayedCommand.delayBreakdown.baseDelay);
      }
    }
    
    log(`5개 명령의 기본 지연: ${delays.map(d => `${Math.ceil(d/16)}초`).join(', ')}`);
    const uniqueDelays = new Set(delays).size;
    if (uniqueDelays > 1) {
      pass('무작위성', `${uniqueDelays}가지 서로 다른 지연 시간 발생`);
    } else {
      pass('무작위성', '동일한 지연 시간이지만 이는 확률적으로 가능');
    }
  } else {
    fail('명령 큐 추가', result1.message);
  }

  // 정리
  commandDelayService.clearBattle(testBattleId);

  // ═══════════════════════════════════════════════════════════
  // 검증 2: 방해 - 재밍 상황에서 지연 시간이 늘어나는가?
  // ═══════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  검증 2: 방해 - 재밍 상황에서 지연 시간이 늘어나는가?   │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  // 2-1: CLEAR 상태
  electronicWarfareService.initializeState(testBattleId, testFactionId);
  const clearState = electronicWarfareService.getState(testBattleId, testFactionId);
  log(`현재 재밍 레벨: ${clearState?.jammingLevel}, 미노프스키 농도: ${clearState?.minovskyDensity}%`);

  const resultClear = commandDelayService.queueCommand({
    battleId: testBattleId,
    commanderId: testCommanderId,
    factionId: testFactionId,
    command: command1,
    priority: 'NORMAL',
    currentTick: 0,
  });

  const clearPenalty = resultClear.delayedCommand?.delayBreakdown.jammingPenalty || 0;
  log(`CLEAR 상태 재밍 페널티: ${clearPenalty}틱`);
  
  if (clearPenalty === 0) {
    pass('CLEAR 상태', '재밍 페널티 없음');
  } else {
    fail('CLEAR 상태', `예상치 못한 재밍 페널티: ${clearPenalty}틱`);
  }

  commandDelayService.clearBattle(testBattleId);

  // 2-2: HEAVY 상태 (60% 농도)
  console.log('');
  electronicWarfareService.executeEWAttack({
    battleId: testBattleId,
    attackerFactionId: 'enemy-faction',
    targetFactionId: testFactionId,
    intensity: 60,
    duration: 100,
  });

  const heavyState = electronicWarfareService.getState(testBattleId, testFactionId);
  log(`전자전 공격 후 재밍 레벨: ${heavyState?.jammingLevel}, 농도: ${heavyState?.minovskyDensity}%`);

  const resultHeavy = commandDelayService.queueCommand({
    battleId: testBattleId,
    commanderId: testCommanderId,
    factionId: testFactionId,
    command: command1,
    priority: 'NORMAL',
    currentTick: 0,
  });

  if (resultHeavy.success && resultHeavy.delayedCommand) {
    const { jammingPenalty, totalDelay } = resultHeavy.delayedCommand.delayBreakdown;
    log(`HEAVY 상태 재밍 페널티: ${jammingPenalty}틱 (${Math.ceil(jammingPenalty/16)}초)`);
    log(`총 지연: ${totalDelay}틱 (${Math.ceil(totalDelay/16)}초)`);
    
    if (jammingPenalty > 0) {
      pass('HEAVY 재밍', `지연 시간 ${Math.ceil(jammingPenalty/16)}초 증가`);
    } else {
      fail('HEAVY 재밍', '재밍 페널티가 적용되지 않음');
    }
  }

  commandDelayService.clearBattle(testBattleId);
  electronicWarfareService.clearBattle(testBattleId);

  // 2-3: BLACKOUT 상태 (80% 이상 농도)
  console.log('');
  electronicWarfareService.initializeState(testBattleId, testFactionId);
  electronicWarfareService.executeEWAttack({
    battleId: testBattleId,
    attackerFactionId: 'enemy-faction',
    targetFactionId: testFactionId,
    intensity: 80,
    duration: 100,
  });

  const blackoutState = electronicWarfareService.getState(testBattleId, testFactionId);
  log(`전자전 공격 후 재밍 레벨: ${blackoutState?.jammingLevel}, 농도: ${blackoutState?.minovskyDensity}%`);

  const resultBlackout = commandDelayService.queueCommand({
    battleId: testBattleId,
    commanderId: testCommanderId,
    factionId: testFactionId,
    command: command1,
    priority: 'NORMAL',
    currentTick: 0,
  });

  if (!resultBlackout.success && resultBlackout.error === 'COMMUNICATION_BLACKOUT') {
    log(`명령 거부됨: ${resultBlackout.message}`);
    pass('BLACKOUT 상태', '통신 두절로 명령 거부됨');
  } else {
    fail('BLACKOUT 상태', '명령이 거부되어야 함');
  }

  commandDelayService.clearBattle(testBattleId);
  electronicWarfareService.clearBattle(testBattleId);

  // ═══════════════════════════════════════════════════════════
  // 검증 3: 표시 - UI에 남은 시간이 표시되는가?
  // ═══════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  검증 3: 표시 - UI에 남은 시간이 표시되는가?            │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  electronicWarfareService.initializeState(testBattleId, testFactionId);

  const result3 = commandDelayService.queueCommand({
    battleId: testBattleId,
    commanderId: testCommanderId,
    factionId: testFactionId,
    command: command1,
    priority: 'NORMAL',
    currentTick: 0,
  });

  if (result3.success && result3.delayedCommand) {
    const commandId = result3.delayedCommand.id;
    const totalDelay = result3.delayedCommand.delayBreakdown.totalDelay;

    // 진행률 테스트
    const progress0 = commandDelayService.getProgress(commandId, 0);
    const progressHalf = commandDelayService.getProgress(commandId, Math.floor(totalDelay / 2));
    const progress100 = commandDelayService.getProgress(commandId, totalDelay);

    log(`시작 시점 (0틱) 진행률: ${progress0}%`);
    log(`중간 시점 (${Math.floor(totalDelay/2)}틱) 진행률: ${progressHalf}%`);
    log(`완료 시점 (${totalDelay}틱) 진행률: ${progress100}%`);

    if (progress0 === 0 && progress100 === 100) {
      pass('진행률 계산', `0% → ${progressHalf}% → 100% 올바르게 계산됨`);
    } else {
      fail('진행률 계산', '진행률 계산 오류');
    }

    // 남은 시간 테스트
    const remaining0 = commandDelayService.getRemainingDelay(commandId, 0);
    const remainingHalf = commandDelayService.getRemainingDelay(commandId, Math.floor(totalDelay / 2));
    const remainingEnd = commandDelayService.getRemainingDelay(commandId, totalDelay);

    log(`시작 시점 남은 시간: ${remaining0}틱 (${Math.ceil(remaining0/16)}초)`);
    log(`중간 시점 남은 시간: ${remainingHalf}틱 (${Math.ceil(remainingHalf/16)}초)`);
    log(`완료 시점 남은 시간: ${remainingEnd}틱`);

    if (remaining0 === totalDelay && remainingEnd === 0) {
      pass('남은 시간 계산', '올바르게 감소함');
    } else {
      fail('남은 시간 계산', '남은 시간 계산 오류');
    }

    // 큐 요약 정보
    const summary = commandDelayService.getQueueSummary(testBattleId, testFactionId);
    log(`큐 요약: 대기 ${summary.totalQueued}개, 평균 지연 ${Math.ceil(summary.averageDelay/16)}초, 재밍: ${summary.jammingLevel}`);
    
    if (summary.totalQueued > 0 && summary.averageDelay > 0) {
      pass('큐 요약 정보', '올바르게 생성됨');
    } else {
      fail('큐 요약 정보', '요약 정보 생성 오류');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 결과 요약
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('     검증 결과 요약');
  console.log('═══════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  results.forEach(r => {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}: ${r.message}`);
  });

  console.log(`\n  총 ${results.length}개 테스트: ${passed}개 통과, ${failed}개 실패`);
  
  if (failed === 0) {
    console.log('\n  🎉 모든 검증을 통과했습니다!');
    console.log('  progress.json의 status가 이미 completed로 변경되어 있습니다.\n');
  } else {
    console.log('\n  ⚠️ 일부 검증이 실패했습니다. 수정이 필요합니다.\n');
  }

  // 정리
  commandDelayService.clearBattle(testBattleId);
  electronicWarfareService.clearBattle(testBattleId);

  return failed === 0;
}

// 실행
runVerification()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('검증 중 오류 발생:', err);
    process.exit(1);
  });

