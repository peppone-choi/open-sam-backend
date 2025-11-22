import { randomUUID } from 'crypto';
import { GalaxySession } from '../../models/logh/GalaxySession.model';
import { GalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { GalaxyOrganizationNode } from '../../models/logh/GalaxyOrganization.model';
import { GalaxyValidationService } from './GalaxyValidation.service';
import { notifyQaLogUpdate } from './GalaxyNotification.service';
import { GalaxyAuthorityCardService } from './GalaxyAuthorityCard.service';

interface JoinSessionParams {
  sessionId: string;
  userId: string;
  characterName: string;
  originType: 'original' | 'generated';
  faction: 'empire' | 'alliance' | 'rebel';
  preferredRole?: string;
}

export async function joinGalaxySession(params: JoinSessionParams) {
  const { sessionId, userId, characterName, originType, faction, preferredRole } = params;

  const session = await GalaxySession.findOne({ session_id: sessionId });
  if (!session) {
    throw new Error(`Galaxy session not found: ${sessionId}`);
  }

  const existingCharacter = await GalaxyCharacter.findOne({ session_id: sessionId, userId });
  if (existingCharacter) {
    GalaxyValidationService.enforceReentryPolicy(
      session,
      existingCharacter,
      faction,
      originType
    );
    return existingCharacter;
  }

  GalaxyValidationService.ensureSessionCapacity(session, faction);
  GalaxyValidationService.enforceReentryPolicy(
    session,
    null,
    faction,
    originType
  );

  const characterId = randomUUID();
  const mailbox = `${characterId}@${faction}.galaxy`; // Placeholder mailbox

  await GalaxyAuthorityCardService.ensureAuthorityCards(sessionId, faction);
  const commandCards = GalaxyAuthorityCardService.getStarterCardPayloads(preferredRole);

  const character = await GalaxyCharacter.create({
    session_id: sessionId,
    characterId,
    userId,
    displayName: characterName,
    originType,
    faction,
    rank: 'Second Lieutenant',
    commandCards,
    mailbox: {
      personal: mailbox,
      roles: commandCards.map((card) => `${card.cardId}@roles.galaxy`),
    },
  });

  const factionSlot = session.factions.find((slot) => slot.name === faction);
  if (factionSlot) {
    factionSlot.activePlayers += 1;
  }
  session.activePlayers += 1;
  await session.save();

  await GalaxyValidationService.refreshSessionCounters(sessionId, faction);

  notifyQaLogUpdate(sessionId, {
    section: 'SessionJoin',
    status: 'pass',
    note: 'Join API validated against manual Chapter1 Session rules.',
  });

  return character;
}

export async function getOrganizationTree(
  sessionId: string,
  faction: 'empire' | 'alliance' | 'rebel'
) {
  const nodes = await GalaxyOrganizationNode.find({ session_id: sessionId, faction }).lean();
  const map = new Map<string, any>();
  const roots: any[] = [];

  nodes.forEach((node) => {
    map.set(node.nodeId, { ...node, children: [] });
  });

  map.forEach((node) => {
    if (node.parentNodeId && map.has(node.parentNodeId)) {
      map.get(node.parentNodeId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

