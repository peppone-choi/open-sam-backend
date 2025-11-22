import { randomUUID } from 'crypto';
import { GalaxyCommMessage, GalaxyCommChannel } from '../../models/logh/GalaxyCommMessage.model';
import { GalaxyAddressBookEntry } from '../../models/logh/GalaxyAddressBook.model';
import { GalaxyCommHandshake } from '../../models/logh/GalaxyCommHandshake.model';
import { GalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';

interface SendMessageParams {
  sessionId: string;
  channelType: GalaxyCommChannel;
  scopeId?: string;
  senderCharacterId: string;
  senderName: string;
  message: string;
  metadata?: Record<string, any>;
}

export async function sendCommMessage(params: SendMessageParams) {
  const { sessionId, channelType, scopeId, senderCharacterId } = params;

  if (channelType !== 'global' && !scopeId) {
    throw new Error('scopeId is required for non-global channels.');
  }

  const message = await GalaxyCommMessage.create({
    session_id: sessionId,
    channelType,
    scopeId,
    senderCharacterId,
    senderName: params.senderName,
    message: params.message,
    metadata: params.metadata,
  });

  const totalMessages = await GalaxyCommMessage.countDocuments({
    session_id: sessionId,
    channelType,
    scopeId,
  });

  return { message, totalMessages };
}

export async function listCommMessages(
  sessionId: string,
  opts: { channelType: GalaxyCommChannel; scopeId?: string; limit?: number }
) {
  if (opts.channelType !== 'global' && !opts.scopeId) {
    throw new Error('scopeId is required for non-global channels.');
  }

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  const query: Record<string, any> = {
    session_id: sessionId,
    channelType: opts.channelType,
  };
  if (opts.scopeId) {
    query.scopeId = opts.scopeId;
  }

  const messages = await GalaxyCommMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(limit);

  return messages.reverse();
}

export async function addAddressBookEntry(
  sessionId: string,
  ownerCharacterId: string,
  contactCharacterId: string,
  contactName: string
) {
  const existingCount = await GalaxyAddressBookEntry.countDocuments({
    session_id: sessionId,
    ownerCharacterId,
  });

  if (existingCount >= 100) {
    throw new Error('Address book limit reached (max 100 entries).');
  }

  return GalaxyAddressBookEntry.create({
    session_id: sessionId,
    ownerCharacterId,
    contactCharacterId,
    contactName,
  });
}

export async function listAddressBook(sessionId: string, ownerCharacterId: string) {
  return GalaxyAddressBookEntry.find({ session_id: sessionId, ownerCharacterId }).sort({ contactName: 1 });
}

export async function requestHandshake(
  sessionId: string,
  requesterCharacterId: string,
  targetCharacterId: string
) {
  if (requesterCharacterId === targetCharacterId) {
    throw new Error('Cannot send a handshake to yourself.');
  }

  const existing = await GalaxyCommHandshake.findOne({
    session_id: sessionId,
    requesterCharacterId,
    targetCharacterId,
    status: 'pending',
  });

  if (existing) {
    return existing;
  }

  return GalaxyCommHandshake.create({
    session_id: sessionId,
    handshakeId: randomUUID(),
    requesterCharacterId,
    targetCharacterId,
  });
}

export async function respondHandshake(
  sessionId: string,
  handshakeId: string,
  responderCharacterId: string,
  action: 'accepted' | 'rejected'
) {
  const handshake = await GalaxyCommHandshake.findOne({ session_id: sessionId, handshakeId });
  if (!handshake) {
    throw new Error('Handshake not found.');
  }

  if (handshake.targetCharacterId !== responderCharacterId) {
    throw new Error('Only the target character can respond to this handshake.');
  }

  handshake.status = action;
  await handshake.save();

  if (action === 'accepted') {
    const requester = await GalaxyCharacter.findOne({ session_id: sessionId, characterId: handshake.requesterCharacterId });
    const target = await GalaxyCharacter.findOne({ session_id: sessionId, characterId: handshake.targetCharacterId });

    if (requester && target) {
      await Promise.all([
        addAddressBookEntry(sessionId, requester.characterId, target.characterId, target.displayName),
        addAddressBookEntry(sessionId, target.characterId, requester.characterId, requester.displayName),
      ]);
    }
  }

  return handshake;
}

export async function listHandshakes(sessionId: string, characterId: string, status?: string) {
  const query: Record<string, any> = {
    session_id: sessionId,
    $or: [{ requesterCharacterId: characterId }, { targetCharacterId: characterId }],
  };
  if (status) {
    query.status = status;
  }

  return GalaxyCommHandshake.find(query).sort({ createdAt: -1 });
}
