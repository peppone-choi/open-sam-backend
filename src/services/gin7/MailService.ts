import { v4 as uuidv4 } from 'uuid';
import { Gin7MailBox, IGin7MailBox } from '../../models/gin7/MailBox';
import { Gin7Message, IGin7Message } from '../../models/gin7/Message';
import { Gin7Character } from '../../models/gin7/Character';

export interface SendMailParams {
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRoleId?: string;
  recipientId?: string;
  recipientRoleId?: string;
  subject: string;
  body: string;
  messageType?: 'personal' | 'system' | 'broadcast' | 'diplomatic';
  attachments?: Array<{
    type: string;
    data: Record<string, any>;
  }>;
  replyToId?: string;
}

export interface MailListParams {
  sessionId: string;
  mailBoxId: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

class MailService {
  /**
   * Get or create a mailbox for a character
   */
  async getOrCreateMailBox(sessionId: string, characterId: string, label?: string): Promise<IGin7MailBox> {
    let mailBox = await Gin7MailBox.findOne({ sessionId, characterId });
    
    if (!mailBox) {
      mailBox = await Gin7MailBox.create({
        mailBoxId: uuidv4(),
        sessionId,
        characterId,
        capacity: 120,
        unreadCount: 0,
        totalCount: 0,
        label
      });
    }
    
    return mailBox;
  }

  /**
   * Get or create a role-based mailbox
   */
  async getOrCreateRoleMailBox(sessionId: string, roleId: string, label?: string): Promise<IGin7MailBox> {
    let mailBox = await Gin7MailBox.findOne({ sessionId, roleId });
    
    if (!mailBox) {
      mailBox = await Gin7MailBox.create({
        mailBoxId: uuidv4(),
        sessionId,
        roleId,
        capacity: 120,
        unreadCount: 0,
        totalCount: 0,
        label: label || roleId
      });
    }
    
    return mailBox;
  }

  /**
   * Find current holder of a role (for role-based mail routing)
   */
  async findRoleHolder(sessionId: string, roleId: string): Promise<string | null> {
    // Look for character with this role in commandCards
    const character = await Gin7Character.findOne({
      sessionId,
      'commandCards.cardId': roleId
    });
    
    return character?.characterId || null;
  }

  /**
   * Send a mail message
   */
  async sendMail(params: SendMailParams): Promise<IGin7Message> {
    const {
      sessionId,
      senderId,
      senderName,
      senderRoleId,
      recipientId,
      recipientRoleId,
      subject,
      body,
      messageType = 'personal',
      attachments,
      replyToId
    } = params;

    // Determine recipient mailbox
    let recipientMailBox: IGin7MailBox | null = null;
    let recipientName = '';

    if (recipientId) {
      const recipient = await Gin7Character.findOne({ sessionId, characterId: recipientId });
      if (!recipient) {
        throw new Error('Recipient not found');
      }
      recipientName = recipient.name;
      recipientMailBox = await this.getOrCreateMailBox(sessionId, recipientId);
    } else if (recipientRoleId) {
      recipientMailBox = await this.getOrCreateRoleMailBox(sessionId, recipientRoleId);
      recipientName = recipientMailBox.label || recipientRoleId;
    } else {
      throw new Error('Either recipientId or recipientRoleId must be provided');
    }

    // Check capacity
    if (recipientMailBox.totalCount >= recipientMailBox.capacity) {
      await this.cleanupOldMessages(sessionId, recipientMailBox.mailBoxId);
    }

    // Create message
    const message = await Gin7Message.create({
      messageId: uuidv4(),
      sessionId,
      mailBoxId: recipientMailBox.mailBoxId,
      senderId,
      senderRoleId,
      senderName,
      recipientId,
      recipientRoleId,
      recipientName,
      subject,
      body,
      messageType,
      attachments: attachments?.map(a => ({ ...a, claimed: false })),
      replyToId,
      isRead: false,
      isArchived: false,
      isStarred: false,
      sentAt: new Date()
    });

    // Update mailbox counts
    await Gin7MailBox.updateOne(
      { mailBoxId: recipientMailBox.mailBoxId, sessionId },
      { 
        $inc: { totalCount: 1, unreadCount: 1 }
      }
    );

    return message;
  }

  /**
   * Get messages in a mailbox
   */
  async getMessages(params: MailListParams): Promise<{ messages: IGin7Message[]; total: number }> {
    const { sessionId, mailBoxId, page = 1, limit = 20, unreadOnly = false } = params;

    const query: Record<string, any> = { sessionId, mailBoxId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const [messages, total] = await Promise.all([
      Gin7Message.find(query)
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Gin7Message.countDocuments(query)
    ]);

    return { messages, total };
  }

  /**
   * Mark message as read
   */
  async markAsRead(sessionId: string, messageId: string): Promise<IGin7Message | null> {
    const message = await Gin7Message.findOneAndUpdate(
      { sessionId, messageId, isRead: false },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (message) {
      await Gin7MailBox.updateOne(
        { mailBoxId: message.mailBoxId, sessionId },
        { $inc: { unreadCount: -1 } }
      );
    }

    return message;
  }

  /**
   * Mark all messages as read
   */
  async markAllAsRead(sessionId: string, mailBoxId: string): Promise<number> {
    const result = await Gin7Message.updateMany(
      { sessionId, mailBoxId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    await Gin7MailBox.updateOne(
      { mailBoxId, sessionId },
      { unreadCount: 0 }
    );

    return result.modifiedCount;
  }

  /**
   * Delete a message
   */
  async deleteMessage(sessionId: string, messageId: string, mailBoxId: string): Promise<boolean> {
    const message = await Gin7Message.findOneAndDelete({ sessionId, messageId, mailBoxId });
    
    if (message) {
      await Gin7MailBox.updateOne(
        { mailBoxId, sessionId },
        { 
          $inc: { 
            totalCount: -1,
            unreadCount: message.isRead ? 0 : -1
          }
        }
      );
      return true;
    }
    
    return false;
  }

  /**
   * Cleanup old read messages when over capacity
   */
  async cleanupOldMessages(sessionId: string, mailBoxId: string): Promise<number> {
    const mailBox = await Gin7MailBox.findOne({ sessionId, mailBoxId });
    if (!mailBox) return 0;

    const excess = mailBox.totalCount - mailBox.capacity + 10; // Delete 10 extra for buffer
    if (excess <= 0) return 0;

    // Find oldest read messages to delete
    const toDelete = await Gin7Message.find({
      sessionId,
      mailBoxId,
      isRead: true
    })
      .sort({ sentAt: 1 })
      .limit(excess)
      .select('messageId');

    if (toDelete.length === 0) return 0;

    const deleteIds = toDelete.map(m => m.messageId);
    await Gin7Message.deleteMany({
      sessionId,
      messageId: { $in: deleteIds }
    });

    await Gin7MailBox.updateOne(
      { mailBoxId, sessionId },
      { $inc: { totalCount: -toDelete.length } }
    );

    return toDelete.length;
  }

  /**
   * Get mailbox by character or role
   */
  async getMailBox(sessionId: string, characterId?: string, roleId?: string): Promise<IGin7MailBox | null> {
    if (characterId) {
      return Gin7MailBox.findOne({ sessionId, characterId });
    }
    if (roleId) {
      return Gin7MailBox.findOne({ sessionId, roleId });
    }
    return null;
  }

  /**
   * Broadcast message to all characters in a faction
   */
  async broadcastToFaction(
    sessionId: string,
    factionId: string,
    senderId: string,
    senderName: string,
    subject: string,
    body: string
  ): Promise<number> {
    // Find all characters in faction
    const characters = await Gin7Character.find({
      sessionId,
      'data.factionId': factionId
    }).select('characterId');

    let sentCount = 0;
    for (const char of characters) {
      if (char.characterId !== senderId) {
        await this.sendMail({
          sessionId,
          senderId,
          senderName,
          recipientId: char.characterId,
          subject,
          body,
          messageType: 'broadcast'
        });
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Transfer role mailbox on position change
   */
  async transferRoleMailBox(
    sessionId: string,
    roleId: string,
    newHolderId: string
  ): Promise<void> {
    const roleMailBox = await Gin7MailBox.findOne({ sessionId, roleId });
    if (!roleMailBox) return;

    // Update the label to show new holder
    const newHolder = await Gin7Character.findOne({ sessionId, characterId: newHolderId });
    if (newHolder) {
      await Gin7MailBox.updateOne(
        { sessionId, roleId },
        { label: `${roleId} (${newHolder.name})` }
      );
    }
  }
}

export default new MailService();

