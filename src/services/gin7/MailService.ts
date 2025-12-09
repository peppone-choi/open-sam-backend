/**
 * MailService - 메일 시스템
 * 매뉴얼 611-625행 기반 구현
 *
 * 기능:
 * - 메일 송신 (개인, 진영, 직책)
 * - 수신함/발신함 조회
 * - 메일 읽음 처리
 * - 메일 삭제
 * - 부재중 자동응답
 * - 용량 제한 관리 (120통)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Gin7MailBox, IGin7MailBox } from '../../models/gin7/MailBox';
import { Gin7Message, IGin7Message } from '../../models/gin7/Message';
import { Gin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export type AddressType = 'personal' | 'faction' | 'position';

export interface SendMailRequest {
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRoleId?: string;
  
  // 수신자 정보 (하나만 필수)
  recipientId?: string;         // 개인 메일
  recipientRoleId?: string;     // 직책 메일
  factionId?: string;           // 진영 메일 (브로드캐스트)
  
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
  isArchived?: boolean;
}

export interface SentMailListParams {
  sessionId: string;
  senderId: string;
  page?: number;
  limit?: number;
}

export interface AutoReplyConfig {
  enabled: boolean;
  message: string;
  startDate?: Date;
  endDate?: Date;
}

export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MailListResult {
  messages: IGin7Message[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_CAPACITY = 120;
const DEFAULT_PAGE_LIMIT = 20;
const CLEANUP_BUFFER = 10;

// ============================================================
// MailService Class
// ============================================================

export class MailService extends EventEmitter {
  private static instance: MailService;
  
  // 자동응답 설정 (sessionId:characterId -> config)
  private autoReplyConfigs: Map<string, AutoReplyConfig> = new Map();

  private constructor() {
    super();
    logger.info('[MailService] Initialized');
  }

  public static getInstance(): MailService {
    if (!MailService.instance) {
      MailService.instance = new MailService();
    }
    return MailService.instance;
  }

  // ============================================================
  // 메일박스 관리
  // ============================================================

  /**
   * 캐릭터 메일박스 조회 또는 생성
   */
  public async getOrCreateMailBox(
    sessionId: string,
    characterId: string,
    label?: string,
  ): Promise<IGin7MailBox> {
    let mailBox = await Gin7MailBox.findOne({ sessionId, characterId });

    if (!mailBox) {
      mailBox = await Gin7MailBox.create({
        mailBoxId: `MAIL-${uuidv4().slice(0, 8)}`,
        sessionId,
        characterId,
        capacity: DEFAULT_CAPACITY,
        unreadCount: 0,
        totalCount: 0,
        label,
      });

      logger.info(`[MailService] Created mailbox for character: ${characterId}`);
    }

    return mailBox;
  }

  /**
   * 직책 메일박스 조회 또는 생성
   */
  public async getOrCreateRoleMailBox(
    sessionId: string,
    roleId: string,
    label?: string,
  ): Promise<IGin7MailBox> {
    let mailBox = await Gin7MailBox.findOne({ sessionId, roleId });

    if (!mailBox) {
      mailBox = await Gin7MailBox.create({
        mailBoxId: `ROLE-${uuidv4().slice(0, 8)}`,
        sessionId,
        roleId,
        capacity: DEFAULT_CAPACITY,
        unreadCount: 0,
        totalCount: 0,
        label: label || roleId,
      });

      logger.info(`[MailService] Created mailbox for role: ${roleId}`);
    }

    return mailBox;
  }

  /**
   * 메일박스 조회
   */
  public async getMailBox(
    sessionId: string,
    characterId?: string,
    roleId?: string,
  ): Promise<IGin7MailBox | null> {
    if (characterId) {
      return Gin7MailBox.findOne({ sessionId, characterId });
    }
    if (roleId) {
      return Gin7MailBox.findOne({ sessionId, roleId });
    }
    return null;
  }

  /**
   * 직책 보유자 찾기 (직책 메일 라우팅용)
   */
  public async findRoleHolder(
    sessionId: string,
    roleId: string,
  ): Promise<string | null> {
    const character = await Gin7Character.findOne({
      sessionId,
      'commandCards.cardId': roleId,
    });
    return character?.characterId || null;
  }

  // ============================================================
  // 메일 송신
  // ============================================================

  /**
   * 메일 송신
   * 매뉴얼: 개인/직책/진영 주소 지원
   */
  public async sendMail(request: SendMailRequest): Promise<MailResult> {
    const {
      sessionId,
      senderId,
      senderName,
      senderRoleId,
      recipientId,
      recipientRoleId,
      factionId,
      subject,
      body,
      messageType = 'personal',
      attachments,
      replyToId,
    } = request;

    try {
      // 진영 메일 (브로드캐스트)
      if (factionId && !recipientId && !recipientRoleId) {
        const count = await this.broadcastToFaction(
          sessionId,
          factionId,
          senderId,
          senderName,
          subject,
          body,
        );
        return { success: true, messageId: `BROADCAST-${count}` };
      }

      // 수신자 메일박스 결정
      let recipientMailBox: IGin7MailBox | null = null;
      let recipientName = '';

      if (recipientId) {
        const recipient = await Gin7Character.findOne({ sessionId, characterId: recipientId });
        if (!recipient) {
          return { success: false, error: '수신자를 찾을 수 없습니다.' };
        }
        recipientName = recipient.name;
        recipientMailBox = await this.getOrCreateMailBox(sessionId, recipientId);
      } else if (recipientRoleId) {
        recipientMailBox = await this.getOrCreateRoleMailBox(sessionId, recipientRoleId);
        recipientName = recipientMailBox.label || recipientRoleId;
      } else {
        return { success: false, error: '수신자 정보가 필요합니다.' };
      }

      // 용량 확인 및 정리
      if (recipientMailBox.totalCount >= recipientMailBox.capacity) {
        await this.cleanupOldMessages(sessionId, recipientMailBox.mailBoxId);
      }

      // 메시지 생성
      const messageId = `MSG-${uuidv4().slice(0, 8)}`;
      const message = await Gin7Message.create({
        messageId,
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
        sentAt: new Date(),
      });

      // 메일박스 카운트 업데이트
      await Gin7MailBox.updateOne(
        { mailBoxId: recipientMailBox.mailBoxId, sessionId },
        { $inc: { totalCount: 1, unreadCount: 1 } },
      );

      // 이벤트 발생
      this.emit('mail:sent', {
        sessionId,
        messageId,
        senderId,
        senderName,
        recipientId: recipientId || recipientRoleId,
        subject,
      });

      // 자동응답 확인
      if (recipientId) {
        await this.checkAndSendAutoReply(sessionId, recipientId, senderId, senderName);
      }

      logger.info(`[MailService] Mail sent: ${senderName} -> ${recipientName}, subject: ${subject}`);

      return { success: true, messageId };
    } catch (error) {
      logger.error('[MailService] sendMail error:', error);
      return { success: false, error: '메일 전송에 실패했습니다.' };
    }
  }

  /**
   * 진영 전체 브로드캐스트
   */
  public async broadcastToFaction(
    sessionId: string,
    factionId: string,
    senderId: string,
    senderName: string,
    subject: string,
    body: string,
  ): Promise<number> {
    const characters = await Gin7Character.find({
      sessionId,
      'data.factionId': factionId,
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
          messageType: 'broadcast',
        });
        sentCount++;
      }
    }

    this.emit('mail:broadcast', {
      sessionId,
      factionId,
      senderId,
      sentCount,
    });

    logger.info(`[MailService] Broadcast to faction ${factionId}: ${sentCount} recipients`);

    return sentCount;
  }

  // ============================================================
  // 수신함 조회
  // ============================================================

  /**
   * 수신함 메일 목록 조회
   */
  public async getInbox(params: MailListParams): Promise<MailListResult> {
    const {
      sessionId,
      mailBoxId,
      page = 1,
      limit = DEFAULT_PAGE_LIMIT,
      unreadOnly = false,
      isArchived = false,
    } = params;

    const query: Record<string, any> = {
      sessionId,
      mailBoxId,
      isArchived,
    };
    if (unreadOnly) {
      query.isRead = false;
    }

    const [messages, total] = await Promise.all([
      Gin7Message.find(query)
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Gin7Message.countDocuments(query),
    ]);

    return {
      messages: messages as unknown as IGin7Message[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================================
  // 발신함 조회
  // ============================================================

  /**
   * 발신함 메일 목록 조회
   */
  public async getSentBox(params: SentMailListParams): Promise<MailListResult> {
    const {
      sessionId,
      senderId,
      page = 1,
      limit = DEFAULT_PAGE_LIMIT,
    } = params;

    const query = { sessionId, senderId };

    const [messages, total] = await Promise.all([
      Gin7Message.find(query)
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Gin7Message.countDocuments(query),
    ]);

    return {
      messages: messages as unknown as IGin7Message[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================================
  // 읽음 처리
  // ============================================================

  /**
   * 메일 읽음 처리
   */
  public async markAsRead(
    sessionId: string,
    messageId: string,
  ): Promise<{ success: boolean; message?: IGin7Message; error?: string }> {
    const message = await Gin7Message.findOneAndUpdate(
      { sessionId, messageId, isRead: false },
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    if (!message) {
      return { success: false, error: '메일을 찾을 수 없거나 이미 읽은 메일입니다.' };
    }

    await Gin7MailBox.updateOne(
      { mailBoxId: message.mailBoxId, sessionId },
      { $inc: { unreadCount: -1 } },
    );

    this.emit('mail:read', {
      sessionId,
      messageId,
      mailBoxId: message.mailBoxId,
    });

    return { success: true, message };
  }

  /**
   * 메일박스의 모든 메일 읽음 처리
   */
  public async markAllAsRead(
    sessionId: string,
    mailBoxId: string,
  ): Promise<number> {
    const result = await Gin7Message.updateMany(
      { sessionId, mailBoxId, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    await Gin7MailBox.updateOne(
      { mailBoxId, sessionId },
      { unreadCount: 0 },
    );

    this.emit('mail:allRead', {
      sessionId,
      mailBoxId,
      count: result.modifiedCount,
    });

    return result.modifiedCount;
  }

  // ============================================================
  // 메일 삭제
  // ============================================================

  /**
   * 메일 삭제
   */
  public async deleteMail(
    sessionId: string,
    messageId: string,
    mailBoxId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const message = await Gin7Message.findOneAndDelete({
      sessionId,
      messageId,
      mailBoxId,
    });

    if (!message) {
      return { success: false, error: '메일을 찾을 수 없습니다.' };
    }

    await Gin7MailBox.updateOne(
      { mailBoxId, sessionId },
      {
        $inc: {
          totalCount: -1,
          unreadCount: message.isRead ? 0 : -1,
        },
      },
    );

    this.emit('mail:deleted', {
      sessionId,
      messageId,
      mailBoxId,
    });

    return { success: true };
  }

  /**
   * 다중 메일 삭제
   */
  public async deleteMultiple(
    sessionId: string,
    mailBoxId: string,
    messageIds: string[],
  ): Promise<{ success: boolean; deletedCount: number }> {
    const messages = await Gin7Message.find({
      sessionId,
      mailBoxId,
      messageId: { $in: messageIds },
    }).lean();

    const unreadCount = messages.filter(m => !m.isRead).length;

    await Gin7Message.deleteMany({
      sessionId,
      mailBoxId,
      messageId: { $in: messageIds },
    });

    await Gin7MailBox.updateOne(
      { mailBoxId, sessionId },
      {
        $inc: {
          totalCount: -messages.length,
          unreadCount: -unreadCount,
        },
      },
    );

    return { success: true, deletedCount: messages.length };
  }

  /**
   * 오래된 읽은 메일 정리 (용량 초과 시)
   */
  public async cleanupOldMessages(
    sessionId: string,
    mailBoxId: string,
  ): Promise<number> {
    const mailBox = await Gin7MailBox.findOne({ sessionId, mailBoxId });
    if (!mailBox) return 0;

    const excess = mailBox.totalCount - mailBox.capacity + CLEANUP_BUFFER;
    if (excess <= 0) return 0;

    // 오래된 읽은 메시지 삭제
    const toDelete = await Gin7Message.find({
      sessionId,
      mailBoxId,
      isRead: true,
      isStarred: false, // 별표 메일은 보존
    })
      .sort({ sentAt: 1 })
      .limit(excess)
      .select('messageId');

    if (toDelete.length === 0) return 0;

    const deleteIds = toDelete.map(m => m.messageId);
    await Gin7Message.deleteMany({
      sessionId,
      messageId: { $in: deleteIds },
    });

    await Gin7MailBox.updateOne(
      { mailBoxId, sessionId },
      { $inc: { totalCount: -toDelete.length } },
    );

    logger.info(`[MailService] Cleaned up ${toDelete.length} old messages from ${mailBoxId}`);

    return toDelete.length;
  }

  // ============================================================
  // 부재중 자동응답
  // ============================================================

  /**
   * 부재중 자동응답 설정
   */
  public setAutoReply(
    sessionId: string,
    characterId: string,
    config: AutoReplyConfig,
  ): void {
    const key = `${sessionId}:${characterId}`;
    this.autoReplyConfigs.set(key, config);

    this.emit('autoReply:set', {
      sessionId,
      characterId,
      enabled: config.enabled,
    });

    logger.info(`[MailService] Auto-reply ${config.enabled ? 'enabled' : 'disabled'} for ${characterId}`);
  }

  /**
   * 부재중 자동응답 설정 조회
   */
  public getAutoReply(
    sessionId: string,
    characterId: string,
  ): AutoReplyConfig | null {
    const key = `${sessionId}:${characterId}`;
    return this.autoReplyConfigs.get(key) || null;
  }

  /**
   * 자동응답 확인 및 전송
   */
  private async checkAndSendAutoReply(
    sessionId: string,
    recipientId: string,
    senderId: string,
    senderName: string,
  ): Promise<void> {
    const config = this.getAutoReply(sessionId, recipientId);
    if (!config?.enabled) return;

    const now = new Date();
    if (config.startDate && now < config.startDate) return;
    if (config.endDate && now > config.endDate) return;

    // 자동응답 전송 (무한 루프 방지: 시스템 메시지 타입)
    const recipient = await Gin7Character.findOne({
      sessionId,
      characterId: recipientId,
    });

    if (recipient) {
      await this.sendMail({
        sessionId,
        senderId: recipientId,
        senderName: recipient.name,
        recipientId: senderId,
        subject: `[자동응답] Re: ${senderName}님의 메일`,
        body: config.message,
        messageType: 'system',
      });

      logger.debug(`[MailService] Auto-reply sent to ${senderName}`);
    }
  }

  // ============================================================
  // 추가 기능
  // ============================================================

  /**
   * 메일 별표 토글
   */
  public async toggleStar(
    sessionId: string,
    messageId: string,
  ): Promise<{ success: boolean; isStarred?: boolean }> {
    const message = await Gin7Message.findOne({ sessionId, messageId });
    if (!message) {
      return { success: false };
    }

    message.isStarred = !message.isStarred;
    await message.save();

    return { success: true, isStarred: message.isStarred };
  }

  /**
   * 메일 보관 토글
   */
  public async toggleArchive(
    sessionId: string,
    messageId: string,
  ): Promise<{ success: boolean; isArchived?: boolean }> {
    const message = await Gin7Message.findOne({ sessionId, messageId });
    if (!message) {
      return { success: false };
    }

    message.isArchived = !message.isArchived;
    await message.save();

    return { success: true, isArchived: message.isArchived };
  }

  /**
   * 직책 메일박스 인계 (직책 변경 시)
   */
  public async transferRoleMailBox(
    sessionId: string,
    roleId: string,
    newHolderId: string,
  ): Promise<void> {
    const roleMailBox = await Gin7MailBox.findOne({ sessionId, roleId });
    if (!roleMailBox) return;

    const newHolder = await Gin7Character.findOne({
      sessionId,
      characterId: newHolderId,
    });

    if (newHolder) {
      await Gin7MailBox.updateOne(
        { sessionId, roleId },
        { label: `${roleId} (${newHolder.name})` },
      );

      this.emit('mailBox:transferred', {
        sessionId,
        roleId,
        newHolderId,
        newHolderName: newHolder.name,
      });

      logger.info(`[MailService] Role mailbox ${roleId} transferred to ${newHolder.name}`);
    }
  }

  /**
   * 메일 검색
   */
  public async searchMails(
    sessionId: string,
    mailBoxId: string,
    query: string,
    limit: number = 50,
  ): Promise<IGin7Message[]> {
    const searchRegex = new RegExp(query, 'i');

    const results = await Gin7Message.find({
      sessionId,
      mailBoxId,
      $or: [
        { subject: searchRegex },
        { body: searchRegex },
        { senderName: searchRegex },
      ],
    })
      .sort({ sentAt: -1 })
      .limit(limit)
      .lean();
    return results as unknown as IGin7Message[];
  }

  // ============================================================
  // 정리
  // ============================================================

  /**
   * 세션 정리
   */
  public cleanup(sessionId: string): void {
    // 자동응답 설정 정리
    for (const key of this.autoReplyConfigs.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.autoReplyConfigs.delete(key);
      }
    }

    logger.info(`[MailService] Cleaned up session: ${sessionId}`);
  }
}

export const mailService = MailService.getInstance();
export default MailService;
