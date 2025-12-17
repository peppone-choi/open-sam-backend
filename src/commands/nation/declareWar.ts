// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';

import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { DiplomacyProposalService } from '../../services/diplomacy/DiplomacyProposal.service';
import { DiplomacyState } from '../../services/diplomacy/DiplomacyState.service';

export class che_선전포고 extends NationCommand {
  static getName(): string {
    return '선전포고';
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

    const startYear = this.env['startyear'] ?? 184;
    // warDeclareYear: 선전포고 가능 상대 년도 (직접 설정 가능)
    // 기본값: openingPartYear - 2 = 1
    const openingPartYear = this.env['openingPartYear'] ?? this.env['opening_part_year'] ?? 3;
    const warDeclareYear = this.env['warDeclareYear'] ?? this.env['war_declare_year'] ?? (openingPartYear - 2);
    const declareWarAbsYear = startYear + warDeclareYear;
    this.minConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      // "선전포고 차단" 설정이 켜져 있으면 선전포고도 막아야 함
      ConstraintHelper.AllowWar(),
      ConstraintHelper.ReqEnvValue('year', '>=', declareWarAbsYear, `${declareWarAbsYear}년부터 선전포고가 가능합니다.`)
    ];
  }

  protected async initWithArg(): Promise<void> {
    const startYear = this.env['startyear'] ?? 184;
    // warDeclareYear: 선전포고 가능 상대 년도 (직접 설정 가능)
    const openingPartYear = this.env['openingPartYear'] ?? this.env['opening_part_year'] ?? 3;
    const warDeclareYear = this.env['warDeclareYear'] ?? this.env['war_declare_year'] ?? (openingPartYear - 2);
    const declareWarAbsYear = startYear + warDeclareYear;

    this.setDestNation(this.arg['destNationID'], null);

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      // "선전포고 차단" 설정이 켜져 있으면 선전포고도 막아야 함
      ConstraintHelper.AllowWar(),
      ConstraintHelper.ReqEnvValue('year', '>=', declareWarAbsYear, `${declareWarAbsYear}년부터 선전포고가 가능합니다.`),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.NearNation(),
      ConstraintHelper.DisallowDiplomacyBetweenStatus({
        0: '아국과 이미 교전중입니다.',
        1: '아국과 이미 선포중입니다.',
        7: '불가침국입니다.'
      })
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
    return `【${destNationName}】에 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }


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

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const logger = general!.getLogger();
    const destLogger = new ActionLogger(0, destNationID, this.env['year'], this.env['month']);

    logger.pushGeneralActionLog(`<D><b>${destNationName}</b></>에 선전 포고 했습니다.<1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 선전 포고 <1>${date}</>`);
    logger.pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 선전 포고`
    );
    destLogger.pushNationalHistoryLog(
      `<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국에 선전 포고`
    );

    logger.pushGlobalActionLog(
      `<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <M>선전 포고</> 하였습니다.`
    );
    logger.pushGlobalHistoryLog(
      `<R><b>【선포】</b></><D><b>${nationName}</b></>${josaYiNation} <D><b>${destNationName}</b></>에 선전 포고 하였습니다.`
    );

    // 서비스를 통해 외교 상태 업데이트
    const sessionId = this.env['session_id'] || 'sangokushi_default';
    const result = await DiplomacyProposalService.declareWar(
      sessionId,
      nationID,
      destNationID
    );

    if (!result.success) {
      throw new Error(result.reason);
    }

    const { Message } = await import('../../models/Message');
    const { GetImageURL } = await import('../../func');
    const { MessageTarget } = await import('../../core/message/MessageTarget');

    const text = `【외교】${this.env['year']}년 ${this.env['month']}월:${nationName}에서 ${destNationName}에 선전포고`;
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

    await Message.send(srcTarget, destTarget, text, new Date(general!.getTurnTime()), new Date('9999-12-31'), []);

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await this.saveGeneral();
    await destLogger.flush();
    await ActionLogger.flush();

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj!.getNationID();
    const nationList = [];
    const testTurn = new LastTurn(this.constructor.getName(), null, this.getPreReqTurn());
    const getAllNationStaticInfo = global.getAllNationStaticInfo;

    for (const destNation of getAllNationStaticInfo()) {
      testTurn.setArg({ destNationID: destNation['nation'] });
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
        startYear: this.env['startyear']
      }
    };
  }
}
