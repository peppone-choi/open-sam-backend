// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { NationCommand } from '../base/NationCommand';
import { nationRepository } from '../../repositories/nation.repository';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { ActionLogger } from '../../types/ActionLogger';
import { ConstraintHelper } from '../../constraints/constraint-helper';

/**
 * 급습 커맨드
 * 
 * 선포 기간이 12개월 이상인 상대국에 대해 급습을 시도합니다.
 * 성공 시 상대국의 선포 기간을 감소시킵니다.
 */
export class RaidCommand extends NationCommand {
  protected static actionName = '급습';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destNationID' in this.arg)) {
      return false;
    }
    const destNationID = this.arg.destNationID;
    if (typeof destNationID !== 'number') {
      return false;
    }
    if (destNationID < 1) {
      return false;
    }

    this.arg = {
      destNationID: destNationID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['strategic_cmd_limit']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.Custom((input: any, env: any) => {
        const nation = input._cached_nation || {};
        return (nation.strategic_cmd_limit || 0) > 0;
      }, '전략 커맨드 실행 가능 횟수를 초과했습니다')
    ];
  }

  protected initWithArg(): void {
    this.setDestNation(this.arg.destNationID, null);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.Custom((input: any, env: any) => {
        const diplomacy = input._cached_diplomacy || {};
        const term = diplomacy.term || 0;
        return diplomacy.state === 1 && term >= 12;
      }, '선포 12개월 이상인 상대국에만 가능합니다.'),
      ConstraintHelper.Custom((input: any, env: any) => {
        const nation = input._cached_nation || {};
        return (nation.strategic_cmd_limit || 0) > 0;
      }, '전략 커맨드 실행 가능 횟수를 초과했습니다')
    ];
  }

  public getCommandDetailTitle(): string {
    const name = RaidCommand.getName();
    const reqTurn = this.getPreReqTurn() + 1;
    const postReqTurn = this.getPostReqTurn();
    return `${name}/${reqTurn}턴(재사용 대기 ${postReqTurn})`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const genCount = Util.valueFit(this.nation.gennum, GameConst.initialNationGenLimit);
    let nextTerm = Util.round(Math.sqrt(genCount * 16) * 10);

    // 장수의 특수 능력으로 delay 조정
    try {
      if (this.generalObj && typeof this.generalObj.onCalcStrategic === 'function') {
        nextTerm = this.generalObj.onCalcStrategic(RaidCommand.getName(), 'delay', nextTerm);
      }
    } catch (error) {
      console.error('onCalcStrategic 실패:', error);
    }
    return nextTerm;
  }

  public getBrief(): string {
    const commandName = RaidCommand.getName();
    const destNationName = this.destNation?.name || `국가${this.arg.destNationID}`;
    return `【${destNationName}】에 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;
    const general = this.generalObj;
    const generalID = general.getID();
    const generalName = general.getName();
    const date = general.getTurnTime(general.TURNTIME_HM);

    const year = this.env.year;
    const month = this.env.month;

    const nation = this.nation;
    const nationID = nation.nation;
    const nationName = nation.name;

    const destNation = this.destNation;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const commandName = RaidCommand.getName();
    const josaUl = JosaUtil.pick(commandName, '을');

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`${commandName} 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동하였습니다.`;

    const nationGeneralList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE nation = ? AND no != ?',
      [nationID, generalID]
    );

    // ActionLogger는 이미 import되어 있음
    for (const nationGeneralID of nationGeneralList) {
      const nationGeneralLogger = new ActionLogger(nationGeneralID as number, nationID, year, month);
      nationGeneralLogger.pushGeneralActionLog(broadcastMessage, ActionLogger.PLAIN);
      await nationGeneralLogger.flush();
    }

    const josaYiCommand = JosaUtil.pick(commandName, '이');
    const broadcastMessageDest = `아국에 <M>${commandName}</>${josaYiCommand} 발동되었습니다.`;

    const destNationGeneralList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE nation = ?',
      [destNationID]
    );

    for (const destNationGeneralID of destNationGeneralList) {
      const destNationGeneralLogger = new ActionLogger(destNationGeneralID as number, destNationID, year, month);
      destNationGeneralLogger.pushGeneralActionLog(broadcastMessageDest, ActionLogger.PLAIN);
      await destNationGeneralLogger.flush();
    }

    const destNationLogger = new ActionLogger(0, destNationID, year, month);
    destNationLogger.pushNationalHistoryLog(`<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국에 <M>${commandName}</>${josaUl} 발동`);
    await destNationLogger.flush();

    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동`);

    // 전략 명령 사용 제한 설정
    let strategicCmdCost = 9;
    try {
      if (this.generalObj && typeof this.generalObj.onCalcStrategic === 'function') {
        strategicCmdCost = this.generalObj.onCalcStrategic(RaidCommand.getName(), 'cost', strategicCmdCost);
      }
    } catch (error) {
      console.error('onCalcStrategic 실패:', error);
    }
    
    const { Nation } = await import('../../models/nation.model');
    await nationRepository.updateOneByFilter(
      { session_id: env.session_id, 'data.nation': nationID },
      { $inc: { 'data.strategic_cmd_limit': -strategicCmdCost } }
    );

    // 외교 관계에서 선포 기간 3개월 감소
    const { Diplomacy } = await import('../../models/diplomacy.model');
    await Diplomacy.updateMany(
      {
        session_id: env.session_id,
        $or: [
          { 'data.me': nationID, 'data.you': destNationID },
          { 'data.you': nationID, 'data.me': destNationID }
        ]
      },
      { $inc: { 'data.term': -3 } }
    );

    this.setResultTurn(new LastTurn(RaidCommand.getName(), this.arg));

    // StaticEventHandler 처리
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(
        general,
        null,
        this,
        env,
        this.arg
      );
    } catch (error: any) {
      // StaticEventHandler 실패해도 계속 진행
      console.error('StaticEventHandler failed:', error);
    }

    await this.saveGeneral();

    return true;
  }
}

