import { Message } from './Message';
import { MessageTarget } from './MessageTarget';
import { MessageType } from '../../types/message.types';
import { General } from '../../models/general.model';
import { DB } from '../../config/db';
import { ActionLogger } from '../../types/ActionLogger';
import { JosaUtil } from '../../utils/JosaUtil';

/**
 * DiplomaticMessage
 * 
 * PHP 버전의 sammo\DiplomaticMessage 클래스를 TypeScript로 변환
 */
export class DiplomaticMessage extends Message {
  public static readonly ACCEPTED = 1;
  public static readonly DECLINED = -1;
  public static readonly INVALID = 0;

  public static readonly TYPE_NO_AGGRESSION = 'noAggression'; // 불가침
  public static readonly TYPE_CANCEL_NA = 'cancelNA'; // 불가침 파기
  public static readonly TYPE_STOP_WAR = 'stopWar'; // 종전

  protected diplomaticType: string = '';
  protected diplomacyName: string = '';
  protected diplomacyDetail: string = '';
  protected validDiplomacy: boolean = true;

  constructor(
    msgType: MessageType,
    src: MessageTarget,
    dest: MessageTarget,
    msg: string,
    date: Date,
    validUntil: Date,
    msgOption: Record<string, any>
  ) {
    super(msgType, src, dest, msg, date, validUntil, msgOption);

    if (msgType !== MessageType.diplomacy) {
      throw new Error('DiplomaticMessage msgType');
    }

    this.diplomaticType = msgOption.action || '';
    switch (this.diplomaticType) {
      case DiplomaticMessage.TYPE_NO_AGGRESSION:
        this.diplomacyName = '불가침';
        break;
      case DiplomaticMessage.TYPE_CANCEL_NA:
        this.diplomacyName = '불가침 파기';
        break;
      case DiplomaticMessage.TYPE_STOP_WAR:
        this.diplomacyName = '종전';
        break;
      default:
        throw new Error('diplomaticType이 올바르지 않음');
    }

    if (msgOption.used) {
      this.validDiplomacy = false;
    }

    if (validUntil < new Date()) {
      this.validDiplomacy = false;
    }
  }

  /**
   * 외교 메시지 유효성 검사
   */
  protected async checkDiplomaticMessageValidation(general: any): Promise<[number, string]> {
    if (!this.validDiplomacy) {
      return [DiplomaticMessage.INVALID, '유효하지 않은 외교서신입니다.'];
    }

    if (this.mailbox !== this.dest.nationID + Message.MAILBOX_NATIONAL) {
      return [DiplomaticMessage.INVALID, '송신자가 외교서신을 처리할 수 없습니다.'];
    }

    // TODO: checkSecretPermission 구현
    const permission = general?.permission || 0;
    if (!general || permission < 4) {
      return [DiplomaticMessage.INVALID, '해당 국가의 외교권자가 아닙니다.'];
    }

    return [DiplomaticMessage.ACCEPTED, ''];
  }

  /**
   * 불가침 처리
   */
  protected async noAggression(): Promise<[number, string]> {
    // TODO: KVStorage 구현
    // const gameStor = KVStorage.getStorage(db, 'game_env');

    // TODO: General.createObjFromDB 구현
    // const destGeneralObj = await General.createObjFromDB(this.dest.generalID);

    // TODO: buildNationCommandClass 구현
    // const commandObj = buildNationCommandClass(
    //   'che_불가침수락',
    //   destGeneralObj,
    //   gameStor.getAll(true),
    //   new LastTurn(),
    //   {
    //     destNationID: this.src.nationID,
    //     destGeneralID: this.src.generalID,
    //     year: this.msgOption.year,
    //     month: this.msgOption.month
    //   }
    // );

    // this.diplomacyDetail = commandObj.getBrief();

    // if (!commandObj.hasFullConditionMet()) {
    //   return [DiplomaticMessage.INVALID, commandObj.getFailString()];
    // }

    // await commandObj.run(NoRNG.rngInstance());
    // await commandObj.setNextAvailable();

    return [DiplomaticMessage.ACCEPTED, ''];
  }

  /**
   * 불가침 파기 처리
   */
  protected async cancelNA(): Promise<[number, string]> {
    // TODO: 구현 (noAggression과 유사)
    return [DiplomaticMessage.ACCEPTED, ''];
  }

  /**
   * 종전 처리
   */
  protected async stopWar(): Promise<[number, string]> {
    // TODO: 구현 (noAggression과 유사)
    return [DiplomaticMessage.ACCEPTED, ''];
  }

  /**
   * 메시지 동의 처리
   */
  public async agreeMessage(receiverID: number): Promise<[number, string]> {
    if (!this.id) {
      throw new Error('전송되지 않은 메시지에 수락 진행 중');
    }

    const db = DB.db();
    // TODO: KVStorage 구현
    // const gameStor = KVStorage.getStorage(db, 'game_env');
    // const [year, month] = gameStor.getValuesAsArray(['year', 'month']);

    // TODO: DB 쿼리
    // const general = await db.queryFirstRow(
    //   'SELECT name, nation, officer_level, permission, penalty, belong FROM general WHERE no = ? AND nation = ?',
    //   [receiverID, this.dest.nationID]
    // );

    const general: any = {}; // 임시

    if (general) {
      this.dest.generalID = receiverID;
      this.dest.generalName = general.name;
    }

    const [result, reason] = await this.checkDiplomaticMessageValidation(general);
    if (result !== DiplomaticMessage.ACCEPTED) {
      // TODO: ActionLogger 구현
      // const logger = new ActionLogger(receiverID, 0, year, month);
      // logger.pushGeneralActionLog(`${reason} ${this.diplomacyName} 실패`, ActionLogger.PLAIN);
      if (result === DiplomaticMessage.DECLINED) {
        await this.declineMessageInternal();
      }
      return [result, reason];
    }

    let actionResult: [number, string] = [DiplomaticMessage.INVALID, ''];
    switch (this.diplomaticType) {
      case DiplomaticMessage.TYPE_NO_AGGRESSION:
        actionResult = await this.noAggression();
        break;
      case DiplomaticMessage.TYPE_CANCEL_NA:
        actionResult = await this.cancelNA();
        break;
      case DiplomaticMessage.TYPE_STOP_WAR:
        actionResult = await this.stopWar();
        break;
      default:
        throw new Error('diplomaticType이 올바르지 않음');
    }

    if (actionResult[0] !== DiplomaticMessage.ACCEPTED) {
      // TODO: ActionLogger 구현
      // const logger = new ActionLogger(receiverID, 0, year, month);
      // logger.pushGeneralActionLog(actionResult[1], ActionLogger.PLAIN);
      if (actionResult[0] === DiplomaticMessage.DECLINED) {
        await this.declineMessageInternal();
      }
      return actionResult;
    }

    // 성공 시 처리
    this.dest.generalID = receiverID;
    this.dest.generalName = general.name;
    this.msgOption = this.msgOption || {};
    this.msgOption.used = true;
    this.validDiplomacy = false;

    // TODO: 메시지 생성 및 전송
    // const josaYi = JosaUtil.pick(this.src.nationName, '이');
    // const newMsg = new Message(
    //   MessageType.national,
    //   this.dest,
    //   this.src,
    //   `【외교】${year}년 ${month}월: ${this.src.nationName}${josaYi} ${this.dest.nationName}에게 제안한 ${this.diplomacyDetail}`,
    //   new Date(),
    //   new Date('9999-12-31'),
    //   {
    //     delete: this.id,
    //     silence: true,
    //     deletable: false
    //   }
    // );
    // this.invalidate();
    // await newMsg.send();

    return [DiplomaticMessage.ACCEPTED, ''];
  }

  /**
   * 메시지 거절 (내부)
   */
  protected async declineMessageInternal(): Promise<void> {
    this.msgOption = this.msgOption || {};
    this.msgOption.used = true;
    this.invalidate();
    this.validDiplomacy = false;
  }

  /**
   * 메시지 거절
   */
  public async declineMessage(receiverID: number): Promise<[number, string]> {
    if (!this.id) {
      throw new Error('전송되지 않은 메시지에 거절 진행 중');
    }

    const db = DB.db();
    // TODO: KVStorage 구현
    // const gameStor = KVStorage.getStorage(db, 'game_env');
    // const [year, month] = gameStor.getValuesAsArray(['year', 'month']);

    // TODO: DB 쿼리
    // const general = await db.queryFirstRow(
    //   'SELECT name, nation, officer_level, permission, penalty, belong FROM general WHERE no = ? AND nation = ?',
    //   [receiverID, this.dest.nationID]
    // );

    const general: any = {}; // 임시
    const [result, reason] = await this.checkDiplomaticMessageValidation(general);

    if (result === DiplomaticMessage.INVALID) {
      // TODO: ActionLogger 구현
      // const logger = new ActionLogger(receiverID, 0, year, month);
      // logger.pushGeneralActionLog(`${reason} ${this.diplomacyName} 거절 불가.`, ActionLogger.PLAIN);
      return [result, reason];
    }

    // TODO: ActionLogger 구현
    // const josaYi = JosaUtil.pick(this.dest.nationName, '이');
    // const logger = new ActionLogger(receiverID, 0, year, month);
    // logger.pushGeneralActionLog(`<D>${this.src.nationName}</>의 ${this.diplomacyName} 제안을 거절했습니다.`, ActionLogger.PLAIN);
    // const srcLogger = new ActionLogger(this.src.generalID, 0, year, month);
    // srcLogger.pushGeneralActionLog(`<Y>${this.dest.nationName}</>${josaYi} ${this.diplomacyName} 제안을 거절했습니다.`, ActionLogger.PLAIN);

    await this.declineMessageInternal();
    return [DiplomaticMessage.DECLINED, ''];
  }
}

