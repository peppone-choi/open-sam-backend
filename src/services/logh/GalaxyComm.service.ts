import { randomUUID } from 'crypto';
import { GalaxyCommMessage, GalaxyCommChannel } from '../../models/logh/GalaxyCommMessage.model';
import { GalaxyAddressBookEntry } from '../../models/logh/GalaxyAddressBook.model';
import { GalaxyCommHandshake } from '../../models/logh/GalaxyCommHandshake.model';
import { GalaxyCharacter } from '../../models/logh/GalaxyCharacter.model';
import { GalaxyMail } from '../../models/logh/GalaxyMail.model';

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

// Mail Functions (Manual P.15 - 120 cap limit)
const MAIL_INBOX_LIMIT = 120;

interface SendMailParams {
  sessionId: string;
  fromCharacterId: string;
  fromName: string;
  fromAddress: string;
  toCharacterId: string;
  toName: string;
  toAddress: string;
  subject: string;
  body: string;
  replyToMailId?: string;
}

export async function sendMail(params: SendMailParams) {
  const { sessionId, toCharacterId } = params;

  // Check inbox limit (Manual P.15)
  const inboxCount = await GalaxyMail.countDocuments({
    session_id: sessionId,
    toCharacterId,
  });

  if (inboxCount >= MAIL_INBOX_LIMIT) {
    throw new Error(`受信メールボックスが満杯です (${MAIL_INBOX_LIMIT}通)。古いメールを削除してください。`);
  }

  const mail = await GalaxyMail.create({
    session_id: sessionId,
    mailId: randomUUID(),
    fromCharacterId: params.fromCharacterId,
    fromName: params.fromName,
    fromAddress: params.fromAddress,
    toCharacterId: params.toCharacterId,
    toName: params.toName,
    toAddress: params.toAddress,
    subject: params.subject,
    body: params.body,
    replyToMailId: params.replyToMailId,
  });

  return mail;
}

export async function listMails(
  sessionId: string,
  characterId: string,
  box: 'inbox' | 'outbox' = 'inbox'
) {
  const query: Record<string, any> = {
    session_id: sessionId,
  };

  if (box === 'inbox') {
    query.toCharacterId = characterId;
  } else {
    query.fromCharacterId = characterId;
  }

  const mails = await GalaxyMail.find(query)
    .sort({ createdAt: -1 })
    .limit(200);

  const total = await GalaxyMail.countDocuments(query);

  return { mails, total };
}

export async function markMailAsRead(sessionId: string, mailId: string, characterId: string) {
  const mail = await GalaxyMail.findOne({ session_id: sessionId, mailId });
  if (!mail) {
    throw new Error('Mail not found.');
  }

  // Only recipient can mark as read
  if (mail.toCharacterId !== characterId) {
    throw new Error('Only the recipient can mark mail as read.');
  }

  mail.isRead = true;
  await mail.save();
  return mail;
}

export async function deleteMail(sessionId: string, mailId: string, characterId: string) {
  const mail = await GalaxyMail.findOne({ session_id: sessionId, mailId });
  if (!mail) {
    throw new Error('Mail not found.');
  }

  // Only sender or recipient can delete
  if (mail.fromCharacterId !== characterId && mail.toCharacterId !== characterId) {
    throw new Error('Only sender or recipient can delete mail.');
  }

  await mail.deleteOne();
  return { success: true };
}

export async function getMailboxInfo(sessionId: string, characterId: string) {
  const inboxCount = await GalaxyMail.countDocuments({
    session_id: sessionId,
    toCharacterId: characterId,
  });

  const unreadCount = await GalaxyMail.countDocuments({
    session_id: sessionId,
    toCharacterId: characterId,
    isRead: false,
  });

  return {
    inboxCount,
    unreadCount,
    inboxLimit: MAIL_INBOX_LIMIT,
    inboxAvailable: MAIL_INBOX_LIMIT - inboxCount,
  };
}
