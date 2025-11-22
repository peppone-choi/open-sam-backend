import { randomUUID } from 'crypto';
import { GalaxySession } from '../../models/logh/GalaxySession.model';
import {
  GalaxyEconomyEvent,
  GalaxyEconomyEventType,
  IGalaxyEconomyEvent,
} from '../../models/logh/GalaxyEconomyEvent.model';

interface EconomyEventInput {
  sessionId: string;
  type: GalaxyEconomyEventType;
  faction?: 'empire' | 'alliance' | 'rebel';
  amount: number;
  summary: string;
  description?: string;
  supplyImpact?: number;
  tradeImpact?: number;
  createdBy?: {
    userId?: string;
    characterId?: string;
    displayName?: string;
  };
}

export async function getEconomyState(sessionId: string) {
  const session = await GalaxySession.findOne({ session_id: sessionId });
  if (!session) {
    throw new Error(`Galaxy session not found: ${sessionId}`);
  }
  return session.economyState;
}

export async function listEconomyEvents(
  sessionId: string,
  opts?: { limit?: number; offset?: number; faction?: string }
) {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100);
  const skip = Math.max(opts?.offset ?? 0, 0);

  const filter: Record<string, any> = { session_id: sessionId };
  if (opts?.faction) {
    filter.faction = opts.faction;
  }

  const [events, total] = await Promise.all([
    GalaxyEconomyEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    GalaxyEconomyEvent.countDocuments(filter),
  ]);

  return {
    total,
    events,
    limit,
    offset: skip,
  };
}

export async function recordEconomyEvent(input: EconomyEventInput): Promise<IGalaxyEconomyEvent> {
  const session = await GalaxySession.findOne({ session_id: input.sessionId });
  if (!session) {
    throw new Error(`Galaxy session not found: ${input.sessionId}`);
  }

  const event = await GalaxyEconomyEvent.create({
    session_id: input.sessionId,
    eventId: randomUUID(),
    type: input.type,
    faction: input.faction,
    amount: input.amount,
    summary: input.summary,
    description: input.description,
    supplyImpact: input.supplyImpact ?? 0,
    tradeImpact: input.tradeImpact ?? 0,
    createdBy: input.createdBy,
  });

  const state = session.economyState ?? {
    status: 'active',
    treasury: 0,
    taxRate: 0.1,
    supplyBudget: 0,
    tradeIndex: 1,
    lastTick: null,
  };

  state.treasury += input.amount;
  state.supplyBudget += input.supplyImpact ?? 0;
  state.tradeIndex = Math.max(0, state.tradeIndex + (input.tradeImpact ?? 0));
  state.lastTick = new Date();
  state.note = `Last updated by ${input.createdBy?.displayName || 'system'} on ${
    state.lastTick.toISOString()
  }`;

  session.economyState = state;
  await session.save();

  return event;
}
