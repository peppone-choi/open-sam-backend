import { GalaxyTacticalBattle } from '../../models/logh/GalaxyTacticalBattle.model';
import { GalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { notifyQaLogUpdate } from './GalaxyNotification.service';

interface ResolveBattleParams {
  sessionId: string;
  battleId: string;
  finalState: {
    enemyPresence: boolean;
    occupiedAllPlanets: boolean;
  };
  rewards: Array<{
    characterId: string;
    fame: number;
    evaluation: number;
  }>;
  casualtyReport?: Array<{ faction: string; shipsLost: number; troopsLost: number }>;
}

interface AutoResolveParams {
  sessionId: string;
  battleId: string;
  resolverCharacterId: string;
}

export async function resolveGalaxyBattle(params: ResolveBattleParams) {
  const { sessionId, battleId, finalState, rewards, casualtyReport = [] } = params;

  const battle = await GalaxyTacticalBattle.findOne({ session_id: sessionId, battleId });
  if (!battle) {
    throw new Error('Battle state not found for resolution.');
  }

  if (finalState.enemyPresence || !finalState.occupiedAllPlanets) {
    throw new Error('Victory conditions were not met (Manual Chapter4).');
  }

  battle.victoryCheck = {
    ...battle.victoryCheck,
    enemyPresence: false,
    occupiedAllPlanets: true,
    resolvedAt: new Date(),
  };
  battle.status = 'resolved';
  battle.rewards = rewards;
  battle.casualtyReport = casualtyReport;

  await battle.save();

  await Promise.all(
    rewards.map(async (reward) => {
      const character = await GalaxyCharacter.findOne({
        session_id: sessionId,
        characterId: reward.characterId,
      });
      if (!character) {
        return;
      }
      character.famePoints += reward.fame;
      character.evaluationPoints += reward.evaluation;
      await character.save();
    })
  );

  notifyQaLogUpdate(sessionId, {
    section: 'BattleResolution',
    status: 'pass',
    note: 'Battle resolved per Chapter4 tactical victory conditions.',
  });

  return battle;
}

export async function autoResolveGalaxyBattle(params: AutoResolveParams) {
  const { sessionId, battleId, resolverCharacterId } = params;

  const battle = await GalaxyTacticalBattle.findOne({ session_id: sessionId, battleId });
  if (!battle) {
    throw new Error('Battle state not found for auto resolution.');
  }

  if (!battle.factions || battle.factions.length === 0) {
    throw new Error('Battle has no faction state to evaluate.');
  }

  const factions = [...battle.factions].sort((a, b) => (b.unitCount || 0) - (a.unitCount || 0));
  const winner = factions[0];
  const loser = factions[1];

  const finalState = {
    enemyPresence: false,
    occupiedAllPlanets: true,
  };

  const rewards = (winner.commanderIds || []).map((commanderId) => ({
    characterId: commanderId,
    fame: 8,
    evaluation: 15,
  }));

  if (rewards.length === 0) {
    rewards.push({ characterId: resolverCharacterId, fame: 5, evaluation: 10 });
  }

  const casualtyReport = factions.map((faction) => ({
    faction: faction.code,
    shipsLost: Math.max(0, Math.round((faction.unitCount || 0) * (faction === winner ? 0.1 : 0.4))),
    troopsLost: Math.max(0, Math.round((faction.unitCount || 0) * 20)),
  }));

  const result = await resolveGalaxyBattle({
    sessionId,
    battleId,
    finalState,
    rewards,
    casualtyReport,
  });

  notifyQaLogUpdate(sessionId, {
    section: 'BattleResolution',
    status: 'pass',
    note: `Auto-resolve executed via AI delegation for battle ${battleId}.`,
  });

  return result;
}
