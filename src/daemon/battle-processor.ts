// @ts-nocheck - Type issues need investigation
import { Battle, BattleStatus, BattlePhase } from '../models/battle.model';
import * as BattleEventHook from '../services/battle/BattleEventHook.service';
// 스택 시스템 제거됨
import { cityDefenseRepository } from '../repositories/city-defense.repository';
import { generalRepository } from '../repositories/general.repository';
import { acquireDistributedLock, releaseDistributedLock } from '../common/lock/distributed-lock.helper';
import { invalidateCache } from '../common/cache/model-cache.helper';
import { logger } from '../common/logger';


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
    const activeBattles = await Battle.find({ 
      status: BattleStatus.IN_PROGRESS 
    });

    for (const battle of activeBattles) {
      await processSingleBattle(battle);
    }
  } catch (error: any) {
    logger.error('전투 처리 오류', { error: error.message, stack: error.stack });
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
    logger.info('Planning Phase completed, transitioning to Resolution', { 
      battleId: battle.battleId 
    });
    
    await detectAFK(battle);
    await transitionToResolution(battle, timer);
  }
}

async function handleResolutionPhase(battle: any, timer: BattleTimer, elapsed: number) {
  const timeLimit = battle.resolutionTimeLimit || 10;

  if (elapsed >= timeLimit) {
    logger.info('Resolution Phase completed', { battleId: battle.battleId });
    
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
        logger.warn('General AFK warning', { 
          battleId: battle.battleId, 
          generalName: unit.generalName, 
          afkCount: 1 
        });
        
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
        logger.info('General transferred to AI control', { 
          battleId: battle.battleId, 
          generalName: unit.generalName, 
          afkCount: newAfkCount 
        });
        
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
  const timeCapSeconds = battle.time_cap_seconds || 1840;
  
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

  logger.info('Battle finished', { battleId: battle.battleId, winner });

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
  const sessionId = battle.session_id;
  const settlementLockKey = `lock:battle:settle:${sessionId}:${battle.battleId}`;
  const acquired = await acquireDistributedLock(settlementLockKey, {
    ttl: 120,
    retry: 3,
    retryDelayMs: 500,
    context: 'battle-settlement',
  });

  if (!acquired) {
    logger.warn('[BattleEventHook] 다른 인스턴스가 전투 정산을 수행 중이어서 건너뜁니다.', {
      sessionId,
      battleId: battle.battleId,
    });
    return;
  }

  try {
    const targetCityId = battle.targetCityId;
    const attackerNationId = battle.attackerNationId;
    const defenderNationId = battle.defenderNationId;

    const { attackerLoss, defenderLoss } = calculateBattleLosses(battle);

    if (targetCityId) {
      await applyCityGarrisonCasualties(battle, sessionId, targetCityId);
      const cityName = battle.meta?.cityName ?? `도시${targetCityId}`;
      await updateCityDefenseAfterBattle(sessionId, targetCityId, cityName, winner, attackerLoss, defenderLoss);
    }

    // 멀티 스택 모드: 장수별 스택 손실 반영
    await applyGeneralStackCasualties(battle, sessionId, 'attacker');
    await applyGeneralStackCasualties(battle, sessionId, 'defender');

    // 공격자가 승리하고 도시 공격이면 도시 점령 처리
    if (winner === 'attacker' && targetCityId) {
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

    // 목록 캐시만 무효화 - entity 캐시는 saveCity/saveNation에서 이미 업데이트됨
    const invalidations: Promise<void>[] = [];
    if (targetCityId) {
      invalidations.push(invalidateCache('city', sessionId, targetCityId, { targets: ['lists'] }));
    }
    const nationIds = [attackerNationId, defenderNationId].filter((nationId): nationId is number => typeof nationId === 'number' && nationId > 0);
    for (const nationId of nationIds) {
      invalidations.push(invalidateCache('nation', sessionId, nationId, { targets: ['lists'] }));
    }
    if (invalidations.length > 0) {
      await Promise.all(invalidations);
      logger.debug('[BattleEventHook] 캐시 무효화 완료 (전투 정산)', {
        sessionId,
        battleId: battle.battleId,
        cityId: targetCityId,
        nationIds,
      });
    }

    logger.info('Battle ended processing complete', { 
      battleId: battle.battleId, 
      winner 
    });
  } catch (error: any) {
    logger.error('전투 종료 처리 중 오류', { 
      battleId: battle.battleId, 
      error: error.message, 
      stack: error.stack 
    });
  } finally {
    await releaseDistributedLock(settlementLockKey, 'battle-settlement');
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

  logger.info('Battle turn started', { 
    battleId: battle.battleId, 
    turn: battle.currentTurn 
  });

  io.to(`battle:${battle.battleId}`).emit('battle:turn:start', {
    battleId: battle.battleId,
    turn: battle.currentTurn,
    phase: BattlePhase.PLANNING,
    timeLimit: battle.planningTimeLimit,
    attackerUnits: battle.attackerUnits,
    defenderUnits: battle.defenderUnits
  });
}

function calculateBattleLosses(battle: any) {
  const initialAttacker = battle.meta?.initialAttackerTroops ?? sumMaxTroops(battle.attackerUnits);
  const initialDefender = battle.meta?.initialDefenderTroops ?? sumMaxTroops(battle.defenderUnits);
  const attackerSurvivors = sumCurrentTroops(battle.attackerUnits);
  const defenderSurvivors = sumCurrentTroops(battle.defenderUnits);
  return {
    attackerLoss: Math.max(0, initialAttacker - attackerSurvivors),
    defenderLoss: Math.max(0, initialDefender - defenderSurvivors)
  };
}

function sumMaxTroops(units: any[] = []): number {
  return units.reduce((sum, unit) => sum + (unit?.maxTroops ?? unit?.troops ?? 0), 0);
}

function sumCurrentTroops(units: any[] = []): number {
  return units.reduce((sum, unit) => sum + (unit?.troops ?? 0), 0);
}

/**
 * 멀티 스택 전투: 장수의 개별 스택 손실 반영
 * originType: 'generalStack'인 유닛들의 손실을 originStackId로 매핑
 */
async function applyGeneralStackCasualties(
  battle: any,
  sessionId: string,
  side: 'attacker' | 'defender'
): Promise<void> {
  const units = side === 'attacker' ? battle.attackerUnits : battle.defenderUnits;
  if (!units || units.length === 0) {
    return;
  }

  // generalStack 타입 유닛들의 생존 병력 집계
  const survivorsByStack = new Map<string, number>();
  const commanderCrew = new Map<number, number>(); // commanderId별 총 병력

  for (const unit of units) {
    if (unit.originType === 'generalStack' && unit.originStackId) {
      const troops = unit.troops || 0;
      survivorsByStack.set(unit.originStackId, troops);
      
      // 지휘관별 총 병력 집계 (레거시 crew 값 업데이트용)
      if (unit.commanderId && unit.commanderId > 0) {
        commanderCrew.set(
          unit.commanderId,
          (commanderCrew.get(unit.commanderId) || 0) + troops
        );
      }
    }
  }

  if (survivorsByStack.size === 0) {
    return;
  }

  // 스택 시스템 제거됨 - 스택별 손실 반영 스킵

  // 지휘관(장수)의 레거시 crew 값 업데이트
  for (const [commanderId, totalCrew] of commanderCrew) {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, commanderId);
      if (general) {
        (general as any).crew = totalCrew;
        if (general.data) {
          (general.data as any).crew = totalCrew;
        }
        await (general as any).save?.();
      }
    } catch (error) {
      logger.warn(`[applyGeneralStackCasualties] 장수 crew 업데이트 실패: ${commanderId}`, error);
    }
  }
}

async function applyCityGarrisonCasualties(battle: any, sessionId: string, cityId: number): Promise<void> {
  const garrisonSnapshot = battle.meta?.garrisonStacks;
  if (!garrisonSnapshot || garrisonSnapshot.length === 0) {
    return;
  }
  const survivorsByStack = new Map<string, number>();
  for (const unit of battle.defenderUnits || []) {
    if (unit.originType === 'cityStack' && unit.originStackId) {
      survivorsByStack.set(
        unit.originStackId,
        (survivorsByStack.get(unit.originStackId) || 0) + (unit.troops || 0)
      );
    }
  }

  // 스택 시스템 제거됨 - 도시 주둔군 손실 반영 스킵
}

async function updateCityDefenseAfterBattle(
  sessionId: string,
  cityId: number,
  cityName: string,
  winner: string | undefined,
  attackerLoss: number,
  defenderLoss: number
): Promise<void> {
  const state = await cityDefenseRepository.ensure(sessionId, cityId, cityName);
  if (winner === 'attacker') {
    await cityDefenseRepository.update(sessionId, cityId, {
      wall_hp: state.wall_max,
      gate_hp: state.gate_max,
      last_repair_at: new Date()
    });
    return;
  }
  const wallDamage = Math.max(0, Math.round(attackerLoss * 0.05 + defenderLoss * 0.02));
  const gateDamage = Math.max(0, Math.round(attackerLoss * 0.08));
  await cityDefenseRepository.update(sessionId, cityId, {
    wall_hp: Math.max(0, (state.wall_hp ?? state.wall_max) - wallDamage),
    gate_hp: Math.max(0, (state.gate_hp ?? state.gate_max) - gateDamage),
    last_damage_at: new Date()
  });
}

function getStackTroopCount(stack: any): number {
  if (!stack) {
    return 0;
  }
  if (typeof stack.hp === 'number') {
    return stack.hp;
  }
  const unitSize = stack.unit_size ?? 100;
  const stackCount = stack.stack_count ?? 0;
  return unitSize * stackCount;
}

export function startBattleProcessor() {
  const CHECK_INTERVAL = 1000;
  
  setInterval(() => {
    processBattles();
  }, CHECK_INTERVAL);
  
  logger.info('전투 프로세서 시작', { checkInterval: CHECK_INTERVAL });
  
  setTimeout(() => processBattles(), 1000);
}

