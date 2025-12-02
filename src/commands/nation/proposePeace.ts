// @ts-nocheck - Legacy db usage needs migration to Mongoose
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { DiplomacyProposalService, DiplomacyProposalType } from '../../services/diplomacy/DiplomacyProposal.service';

export class che_종전제의 extends NationCommand {
  static getName(): string {
    return '종전 제의';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destNationID' in this.arg)) return false;
    const destNationID = this.arg['destNationID'];
    if (typeof destNationID !== 'number') return false;
    if (destNationID < 1) return false;

    this.arg = { destNationID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestNation(this.arg['destNationID'], null);

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.AllowDiplomacyBetweenStatus([0, 1], '선포, 전쟁중인 상대국에게만 가능합니다.'),
    ];
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const getNationStaticInfo = global.getNationStaticInfo;
    const destNationName = getNationStaticInfo(this.arg['destNationID'])['name'];
    return `【${destNationName}】에게 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const env = this.env;

    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

        if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

        if (!this.destNation) {
      throw new Error('대상 국가 정보가 없습니다');
    }
    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];
    const josaRo = JosaUtil.pick(destNationName, '로');

    const logger = general!.getLogger();
    const destLogger = new ActionLogger(0, destNationID, env['year'], env['month']);

    logger.pushGeneralActionLog(`<D><b>${destNationName}</b></>${josaRo} 종전 제의 서신을 보냈습니다.<1>${date}</>`);

    logger.pushNationalHistoryLog(`<D><b>${destNationName}</b></>${josaRo} 종전 제의`);

    const { GetImageURL } = await import('../../func');

    const src = {
      id: general!.getID(),
      name: general!.getName(),
      nationID: nationID,
      nationName: nationName,
      color: nation['color'],
      image: GetImageURL(general.data.imgsvr, general.data.picture)
    };

    const dest = {
      id: 0,
      name: '',
      nationID: destNationID,
      nationName: destNationName,
      color: destNation['color']
    };

    const now = new Date(date);
    const validUntil = new Date(date);
    const validMinutes = Math.max(30, env['turnterm'] * 3);
    validUntil.setMinutes(validUntil.getMinutes() + validMinutes);

    // 서비스를 통해 종전 제의 생성
    const sessionId = this.env['session_id'] || 'sangokushi_default';
    const proposalResult = await DiplomacyProposalService.proposePeace({
      sessionId,
      srcNationId: nationID,
      srcNationName: nationName,
      srcGeneralId: general!.getID(),
      srcGeneralName: generalName,
      destNationId: destNationID,
      destNationName: destNationName,
      type: DiplomacyProposalType.STOP_WAR,
      validUntil,
      message: `${nationName}의 종전 제의 서신`
    });

    if (!proposalResult.success) {
      console.error('종전 제의 실패:', proposalResult.reason);
    }

    // 레거시 DiplomaticMessage도 함께 전송 (호환성)
    try {
      const { DiplomaticMessage } = await import('../../core/message/DiplomaticMessage');
      const { MessageTarget } = await import('../../core/message/MessageTarget');
      
      const srcTarget = new MessageTarget(
        general!.getID(),
        general!.getName(),
        nationID,
        nationName,
        nation['color'],
        GetImageURL(general.data.imgsvr, general.data.picture)
      );
      const destTarget = new MessageTarget(
        0,
        '',
        destNationID,
        destNationName,
        destNation['color']
      );
      
      const msg = new DiplomaticMessage(
        'diplomacy',
        srcTarget,
        destTarget,
        `${nationName}의 종전 제의 서신`,
        now,
        validUntil,
        {
          action: 'STOP_WAR',
          deletable: false,
          proposalId: proposalResult.proposalId
        }
      );
      await msg.send();
    } catch (error) {
      console.error('DiplomaticMessage 전송 실패:', error);
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    
    // PHP: StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, this.destGeneralObj, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }
    
    await this.saveGeneral();
    await destLogger.flush();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj!.getNationID();
    const nationList = [];
    const testTurn = new LastTurn(this.constructor.getName(), null, this.getPreReqTurn());
    const getAllNationStaticInfo = global.getAllNationStaticInfo;

    for (const destNation of getAllNationStaticInfo()) {
      const testCommand = new this.constructor(
        generalObj,
        this.env,
        testTurn,
        { destNationID: destNation['nation'] }
      );

      const nationTarget: any = {
        id: destNation['nation'],
        name: destNation['name'],
        color: destNation['color'],
        power: destNation['power']
      };

      if (!testCommand.hasFullConditionMet()) {
        nationTarget['notAvailable'] = true;
      }
      if (destNation['nation'] === nationID) {
        nationTarget['notAvailable'] = true;
      }

      nationList.push(nationTarget);
    }

    return {
      procRes: {
        nationList,
        startYear: this.env['startyear'],
      }
    };
  }
}
