import { Battle, BattleStatus, BattlePhase } from '../models/battle.model';
import { Session } from '../models/session.model';
import * as BattleEventHook from '../services/battle/BattleEventHook.service';

let io: any;
try {
  const server = require('../server');
  io = server.io;
} catch {
  io = { to: () => ({ emit: () => {} }) };
}

interface BattleTimer {
  battleId: string;
  phaseStartTime: Date;
  afkWarnings: Set<number>;
}

const activeBattleTimers = new Map<string, BattleTimer>();

export async function processBattles() {
  try {
    const activeBattles = await (Battle as any).find({ 
      status: BattleStatus.IN_PROGRESS 
    });

    for (const battle of activeBattles) {
      await processSingleBattle(battle);
    }
  } catch (error) {
    console.error('❌ 전투 처리 오류:', error);
  }
}

async function processSingleBattle(battle: any) {
  const battleId = battle.battleId;
  const now = new Date();

  if (!activeBattleTimers.has(battleId)) {
    activeBattleTimers.set(battleId, {
      battleId,
      phaseStartTime: now,
      afkWarnings: new Set()
    });
  }

  const timer = activeBattleTimers.get(battleId)!;
  const elapsed = (now.getTime() - timer.phaseStartTime.getTime()) / 1000;

  if (battle.currentPhase === BattlePhase.PLANNING) {
    await handlePlanningPhase(battle, timer, elapsed);
  } else if (battle.currentPhase === BattlePhase.RESOLUTION) {
    await handleResolutionPhase(battle, timer, elapsed);
  }
}

async function handlePlanningPhase(battle: any, timer: BattleTimer, elapsed: number) {
  const timeLimit = battle.planningTimeLimit || 90;
  const remainingTime = Math.max(0, timeLimit - elapsed);

  if (remainingTime === 30 && elapsed >= 60) {
    io.to(`battle:${battle.battleId}`).emit('battle:planning:warning', {
      battleId: battle.battleId,
      remainingTime: 30,
      message: '⏰ 계획 단계 종료 30초 전!'
    });
  }

  if (remainingTime === 10 && elapsed >= 80) {
    io.to(`battle:${battle.battleId}`).emit('battle:planning:warning', {
      battleId: battle.battleId,
      remainingTime: 10,
      message: '⏰ 계획 단계 종료 10초 전!'
    });
  }

  if (elapsed >= timeLimit) {
    console.log(`⚔️ [${battle.battleId}] Planning Phase 종료 → Resolution Phase`);
    
    await detectAFK(battle);
    await transitionToResolution(battle, timer);
  }
}

async function handleResolutionPhase(battle: any, timer: BattleTimer, elapsed: number) {
  const timeLimit = battle.resolutionTimeLimit || 10;

  if (elapsed >= timeLimit) {
    console.log(`⚔️ [${battle.battleId}] Resolution Phase 완료 → 다음 턴`);
    
    const result = await executeResolution(battle);
    
    const victoryCheck = checkVictoryCondition(battle, result);
    
    if (victoryCheck.isFinished) {
      await finishBattle(battle, victoryCheck.winner);
    } else {
      await startNextTurn(battle, timer);
    }
  }
}

async function detectAFK(battle: any) {
  const allGeneralIds = [
    ...battle.attackerUnits.map((u: any) => u.generalId),
    ...battle.defenderUnits.map((u: any) => u.generalId)
  ];

  const submittedGeneralIds = new Set(
    battle.currentTurnActions.map((a: any) => a.generalId)
  );

  for (const generalId of allGeneralIds) {
    if (!submittedGeneralIds.has(generalId)) {
      const unit = [...battle.attackerUnits, ...battle.defenderUnits]
        .find((u: any) => u.generalId === generalId);
      
      if (!unit) continue;

      const currentAfkCount = battle.afkTurns?.[generalId] || 0;
      const newAfkCount = currentAfkCount + 1;

      if (!battle.afkTurns) {
        battle.afkTurns = {};
      }
      battle.afkTurns[generalId] = newAfkCount;

      if (newAfkCount === 1) {
        console.log(`⚠️ [${battle.battleId}] 장수 ${unit.generalName} AFK 1턴 (Hold)`);
        
        io.to(`battle:${battle.battleId}`).emit('battle:afk:warning', {
          battleId: battle.battleId,
          generalId,
          generalName: unit.generalName,
          afkCount: 1,
          message: `${unit.generalName}이(가) 방어 태세로 전환합니다.`
        });

        battle.currentTurnActions.push({
          generalId,
          action: 'defend'
        });
      } else if (newAfkCount >= 2) {
        console.log(`🤖 [${battle.battleId}] 장수 ${unit.generalName} AI 전환 (${newAfkCount}턴 AFK)`);
        
        if (!battle.ai_controlled) {
          battle.ai_controlled = [];
        }
        if (!battle.ai_controlled.includes(generalId)) {
          battle.ai_controlled.push(generalId);
        }

        io.to(`battle:${battle.battleId}`).emit('battle:ai:takeover', {
          battleId: battle.battleId,
          generalId,
          generalName: unit.generalName,
          message: `${unit.generalName}의 지휘가 AI로 전환되었습니다.`
        });

        const aiAction = generateAIAction(battle, unit);
        battle.currentTurnActions.push(aiAction);
      }
    } else {
      if (battle.afkTurns && battle.afkTurns[generalId]) {
        battle.afkTurns[generalId] = 0;
      }
      
      if (battle.ai_controlled && battle.ai_controlled.includes(generalId)) {
        battle.ai_controlled = battle.ai_controlled.filter((id: number) => id !== generalId);
        
        io.to(`battle:${battle.battleId}`).emit('battle:ai:return', {
          battleId: battle.battleId,
          generalId,
          message: `장수가 수동 지휘로 복귀했습니다.`
        });
      }
    }
  }

  battle.markModified('afkTurns');
  battle.markModified('ai_controlled');
  await battle.save();
}

function generateAIAction(battle: any, unit: any): any {
  const isAttacker = battle.attackerUnits.some((u: any) => u.generalId === unit.generalId);
  
  if (unit.troops < unit.maxTroops * 0.3) {
    return {
      generalId: unit.generalId,
      action: 'retreat'
    };
  }

  const enemies = isAttacker ? battle.defenderUnits : battle.attackerUnits;
  const aliveEnemies = enemies.filter((e: any) => e.troops > 0);

  if (aliveEnemies.length > 0) {
    return {
      generalId: unit.generalId,
      action: 'attack',
      targetGeneralId: aliveEnemies[0].generalId
    };
  }

  return {
    generalId: unit.generalId,
    action: 'defend'
  };
}

async function transitionToResolution(battle: any, timer: BattleTimer) {
  battle.currentPhase = BattlePhase.RESOLUTION;
  timer.phaseStartTime = new Date();
  
  await battle.save();

  io.to(`battle:${battle.battleId}`).emit('battle:phase:resolution', {
    battleId: battle.battleId,
    turn: battle.currentTurn,
    actions: battle.currentTurnActions,
    message: '⚔️ 결전 단계 시작!'
  });
}

async function executeResolution(battle: any): Promise<any> {
  const actions = battle.currentTurnActions;

  const attackerDamage = Math.floor(Math.random() * 1000);
  const defenderDamage = Math.floor(Math.random() * 1000);

  for (const unit of battle.attackerUnits) {
    unit.troops = Math.max(0, unit.troops - attackerDamage / battle.attackerUnits.length);
  }

  for (const unit of battle.defenderUnits) {
    unit.troops = Math.max(0, unit.troops - defenderDamage / battle.defenderUnits.length);
  }

  const events = [
    `공격군 피해: ${attackerDamage}`,
    `수비군 피해: ${defenderDamage}`
  ];

  const turnHistory = {
    turnNumber: battle.currentTurn,
    timestamp: new Date(),
    actions,
    results: {
      attackerDamage,
      defenderDamage,
      events
    },
    battleLog: events
  };

  battle.turnHistory.push(turnHistory);
  battle.markModified('attackerUnits');
  battle.markModified('defenderUnits');
  battle.markModified('turnHistory');
  
  await battle.save();

  io.to(`battle:${battle.battleId}`).emit('battle:resolution:result', {
    battleId: battle.battleId,
    turn: battle.currentTurn,
    result: {
      attackerDamage,
      defenderDamage,
      events
    }
  });

  return {
    attackerDamage,
    defenderDamage,
    events
  };
}

function checkVictoryCondition(battle: any, result: any): { isFinished: boolean; winner?: string } {
  const attackerAlive = battle.attackerUnits.filter((u: any) => u.troops > 0).length;
  const defenderAlive = battle.defenderUnits.filter((u: any) => u.troops > 0).length;

  if (attackerAlive === 0 && defenderAlive === 0) {
    return { isFinished: true, winner: 'draw' };
  }

  if (attackerAlive === 0) {
    return { isFinished: true, winner: 'defender' };
  }

  if (defenderAlive === 0) {
    return { isFinished: true, winner: 'attacker' };
  }

  if (battle.currentTurn >= battle.maxTurns) {
    return { isFinished: true, winner: 'defender' };
  }

  const elapsedTime = (new Date().getTime() - new Date(battle.startedAt).getTime()) / 1000;
  const timeCapSeconds = battle.time_cap_seconds || 1800;
  
  if (elapsedTime >= timeCapSeconds) {
    return { isFinished: true, winner: 'defender' };
  }

  return { isFinished: false };
}

async function finishBattle(battle: any, winner: string | undefined) {
  battle.status = BattleStatus.COMPLETED;
  battle.winner = winner ?? 'draw';
  battle.completedAt = new Date();
  
  await battle.save();

  activeBattleTimers.delete(battle.battleId);

  console.log(`🏆 [${battle.battleId}] 전투 종료 - 승자: ${winner}`);

  io.to(`battle:${battle.battleId}`).emit('battle:finished', {
    battleId: battle.battleId,
    winner,
    attackerSurvivors: battle.attackerUnits.reduce((sum: number, u: any) => sum + u.troops, 0),
    defenderSurvivors: battle.defenderUnits.reduce((sum: number, u: any) => sum + u.troops, 0),
    duration: battle.currentTurn,
    message: `🏆 ${winner === 'attacker' ? '공격군' : winner === 'defender' ? '수비군' : '무승부'} 승리!`
  });

  // 전투 종료 후 월드 반영 처리
  await handleBattleEnded(battle, winner);
}

/**
 * 전투 종료 후 월드 반영 처리
 */
async function handleBattleEnded(battle: any, winner: string | undefined) {
  try {
    const sessionId = battle.session_id;
    const targetCityId = battle.targetCityId;
    const attackerNationId = battle.attackerNationId;
    const defenderNationId = battle.defenderNationId;

    // 공격자가 승리하고 도시 공격이면 도시 점령 처리
    if (winner === 'attacker' && targetCityId) {
      // 공격자 장수 ID (첫 번째 장수 사용)
      const attackerGeneralId = battle.attackerUnits?.[0]?.generalId || 0;

      if (attackerGeneralId > 0) {
        await BattleEventHook.onCityOccupied(
          sessionId,
          targetCityId,
          attackerNationId,
          attackerGeneralId
        );
      }
    }

    console.log(`[BattleEventHook] 전투 종료 처리 완료: ${battle.battleId}, 승자: ${winner}`);
  } catch (error: any) {
    console.error('[BattleEventHook] 전투 종료 처리 중 오류:', error);
  }
}

async function startNextTurn(battle: any, timer: BattleTimer) {
  battle.currentTurn += 1;
  battle.currentPhase = BattlePhase.PLANNING;
  battle.currentTurnActions = [];
  battle.readyPlayers = [];
  
  timer.phaseStartTime = new Date();
  timer.afkWarnings.clear();
  
  await battle.save();

  console.log(`📅 [${battle.battleId}] 턴 ${battle.currentTurn} 시작`);

  io.to(`battle:${battle.battleId}`).emit('battle:turn:start', {
    battleId: battle.battleId,
    turn: battle.currentTurn,
    phase: BattlePhase.PLANNING,
    timeLimit: battle.planningTimeLimit,
    attackerUnits: battle.attackerUnits,
    defenderUnits: battle.defenderUnits
  });
}

export function startBattleProcessor() {
  const CHECK_INTERVAL = 1000;
  
  setInterval(() => {
    processBattles();
  }, CHECK_INTERVAL);
  
  console.log('⚔️ 전투 프로세서 시작 (1초마다 체크)');
  
  setTimeout(() => processBattles(), 1000);
}
