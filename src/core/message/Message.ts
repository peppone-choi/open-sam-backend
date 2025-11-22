import { DB } from '../../config/db';
import { MessageType } from '../../types/message.types';
import { MessageTarget } from './MessageTarget';
import { messageRepository } from '../../repositories/message.repository';


/**
 * Message 클래스
 * 
 * PHP 버전의 sammo\Message 클래스를 TypeScript로 변환
 */
export class Message {
  public static readonly MAILBOX_PUBLIC = 9999;
  public static readonly MAILBOX_NATIONAL = 9000;

  public mailbox: number | null = null;
  public id: number | string | null = null;

  public isInboxMail: boolean = false;

  protected sendCnt: number = 0;

  constructor(
    public msgType: MessageType,
    public src: MessageTarget,
    public dest: MessageTarget,
    public msg: string,
    public date: Date,
    public validUntil: Date,
    public msgOption: Record<string, any> | null = null
  ) {}

  /**
   * 전송 정보 설정
   */
  public setSentInfo(mailbox: number, messageID: number | string): this {
    if (!Message.isValidMailBox(mailbox)) {
      throw new Error('올바르지 않은 mailbox');
    }


    if (mailbox === Message.MAILBOX_PUBLIC) {
      if (this.msgType !== MessageType.public) {
        throw new Error('올바르지 않은 mailbox, msgType !== MessageType::public');
      }
      this.isInboxMail = true;
    } else if (mailbox >= Message.MAILBOX_NATIONAL) {
      if (this.msgType === MessageType.diplomacy) {
        this.isInboxMail = true;
      } else if (this.msgType !== MessageType.national) {
        throw new Error('올바르지 않은 mailbox, msgType not in (MessageType::diplomacy, MessageType::national)');
      }
      if (this.dest.nationID + Message.MAILBOX_NATIONAL === mailbox) {
        this.isInboxMail = true;
      } else if (this.src.nationID + Message.MAILBOX_NATIONAL === mailbox) {
        this.isInboxMail = false;
      } else {
        throw new Error('송신, 수신국 둘 중의 어느 메일함도 아닙니다');
      }
    } else {
      if (this.msgType !== MessageType.private) {
        throw new Error('올바르지 않은 mailbox, msgType !== MSGTYPE_PRIVATE');
      }
      if (this.dest.generalID === mailbox) {
        this.isInboxMail = true;
      } else if (this.src.generalID === mailbox) {
        this.isInboxMail = false;
      } else {
        throw new Error('송신자, 수신자 둘 중의 어느 메일함도 아닙니다');
      }
    }

    this.id = messageID;
    this.mailbox = mailbox;
    return this;
  }

  /**
   * 배열로 변환
   */
  public toArray(): Record<string, any> {
    let src: any;
    let dest: any;

    if (this.msgType === MessageType.public) {
      src = this.src.toArray();
      dest = null;
    } else if (this.msgType === MessageType.national || this.msgType === MessageType.diplomacy) {
      src = this.src.toArray();
      dest = this.dest.toArray();
    } else {
      src = this.src.toArray();
      dest = this.dest.toArray();
    }

    return {
      id: this.id,
      msgType: this.msgType,
      src: src,
      dest: dest,
      text: this.msg,
      option: this.msgOption,
      time: this.date.toISOString()
    };
  }

  /**
   * 배열에서 빌드
   */
  public static buildFromArray(row: any): Message {
    const dbMessage = JSON.parse(row.message || '{}');

    const msgType = row.type as MessageType;
    const src = MessageTarget.buildFromArray(dbMessage.src || {});
    const dest = MessageTarget.buildFromArray(dbMessage.dest || {});
    const option = dbMessage.option || {};

    const msgText = dbMessage.text || '';
    const msgDate = new Date(row.time || new Date());
    const validUntilDate = new Date(row.valid_until || '9999-12-31');

    const action = option.action;
    let objMessage: Message;

    if (msgType === MessageType.diplomacy && action) {
      // FUTURE: DiplomaticMessage 구현
      objMessage = new Message(msgType, src, dest, msgText, msgDate, validUntilDate, option);
    } else if (action === 'scout') {
      // FUTURE: ScoutMessage 구현
      objMessage = new Message(msgType, src, dest, msgText, msgDate, validUntilDate, option);
    } else if (action === 'raiseInvader') {
      // FUTURE: RaiseInvaderMessage 구현
      objMessage = new Message(msgType, src, dest, msgText, msgDate, validUntilDate, option);
    } else {
      objMessage = new Message(msgType, src, dest, msgText, msgDate, validUntilDate, option);
    }

    objMessage.setSentInfo(row.mailbox, row.id);
    return objMessage;
  }

  /**
   * 메일박스 유효성 검사
   */
  protected static isValidMailBox(mailbox: number): boolean {
    if (mailbox > MessageType.public) {
      return false;
    }
    if (mailbox <= 0) {
      return false;
    }
    return true;
  }

  /**
   * ID로 메시지 가져오기
   */
  public static async getMessageByID(messageID: number): Promise<Message | null> {
    const db = DB.db();
    const now = new Date();
    // FUTURE: DB 쿼리 구현
    // const row = await db.queryFirstRow(
    //   'SELECT * FROM message WHERE id = ? AND valid_until > ?',
    //   [messageID, now]
    // );
    // if (!row) {
    //   return null;
    // }
    // return this.buildFromArray(row);
    return null;
  }

  /**
   * 메일박스에서 메시지 가져오기
   */
  public static async getMessagesFromMailBox(
    mailbox: number,
    msgType: MessageType,
    limit: number = 30,
    fromSeq: number = 0
  ): Promise<Message[]> {
    const db = DB.db();
    const date = new Date();

    // FUTURE: DB 쿼리 구현
    // const rows = await db.query(
    //   'SELECT * FROM message WHERE mailbox = ? AND type = ? AND valid_until > ? AND id >= ? ORDER BY id DESC LIMIT ?',
    //   [mailbox, msgType, date, fromSeq, limit]
    // );
    // return rows.map(row => this.buildFromArray(row));

    return [];
  }

  /**
   * 메시지 전송 (인스턴스 메서드)
   */
  public async send(silence: boolean = false): Promise<void> {
    const mailbox = this.resolveMailbox();
    const sessionId = (this.msgOption as any)?.session_id || 'global';

    const payload = {
      type: this.msgType,
      mailbox,
      message: this.toArray(),
      silence,
      validUntil: this.validUntil.toISOString(),
      createdAt: new Date().toISOString()
    };

    const saved = await messageRepository.create({
      session_id: sessionId,
      data: payload
    });

    if (saved?._id) {
      this.setSentInfo(mailbox, saved._id.toString());
    }
  }


  /**
   * 메시지 전송 (정적 메서드)
   */
  public static async send(
    src: MessageTarget,
    dest: MessageTarget,
    text: string,
    date: Date,
    validUntil: Date,
    msgOption: any[] = []
  ): Promise<void> {
    const msg = new Message(
      MessageType.private, // 기본값
      src,
      dest,
      text,
      date,
      validUntil,
      msgOption.length > 0 ? msgOption[0] : null
    );
    await msg.send();
  }

  private resolveMailbox(): number {
    if (this.mailbox) {
      return this.mailbox;
    }

    if (this.msgType === MessageType.public) {
      return Message.MAILBOX_PUBLIC;
    }

    if (this.msgType === MessageType.national || this.msgType === MessageType.diplomacy) {
      const nationId = this.dest?.nationID ?? this.src?.nationID ?? 0;
      return nationId + Message.MAILBOX_NATIONAL;
    }

    return this.dest?.generalID ?? this.src?.generalID ?? 0;
  }

  /**
   * 메시지 무효화
   */
  public invalidate(): void {
    this.validUntil = new Date();
    this.msgOption = {
      ...(this.msgOption || {}),
      invalidated: true
    };
  }
}


