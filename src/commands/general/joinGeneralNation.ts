// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * 장수대상임관 커맨드
 * PHP che_장수대상임관과 동일한 구조
 */
export class JoinGeneralNationCommand extends GeneralCommand {
  protected static actionName = '장수를 따라 임관';
  public static reqArg = true;

  protected destGeneral: any = null;
  protected destNation: any = null;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destGeneralID = this.arg['destGeneralID'];
    if (destGeneralID === null || destGeneralID === undefined) {
      return false;
    }

    if (!Number.isInteger(destGeneralID)) {
      return false;
    }

    if (destGeneralID < 1) {
      return false;
    }

    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }

    this.arg = {
      destGeneralID: destGeneralID
    };

    return true;
  }

  protected init(): void {
    const general = this.generalObj;
    const env = this.env;

    this.setCity();
    this.setNation();

    const relYear = env['year'] - env['startyear'];

    this.permissionConstraints = [
      // ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다')
    ];

    this.minConditionConstraints = [
      // ConstraintHelper.BeNeutral(),
      // ConstraintHelper.AllowJoinAction()
    ];
  }

  protected async initWithArg(): Promise<void> {
    const destGeneralID = this.arg['destGeneralID'];
    const sessionId = this.env['session_id'] || 'sangokushi_default';

    const destGeneralDoc = await generalRepository.findOneByFilter({
      session_id: sessionId,
      'data.no': destGeneralID
    });

    if (!destGeneralDoc) {
      throw new Error('대상 장수를 찾을 수 없습니다');
    }

    this.destGeneral = destGeneralDoc;
    const destNationId = destGeneralDoc.nation || 0;

    const destNationDoc = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': destNationId
    });

    if (destNationDoc) {
      this.destNation = {
        nation: destNationId,
        name: destNationDoc.data?.name || '무명',
        gennum: destNationDoc.data?.gennum || 0
      };
    }

    const env = this.env;
    const relYear = env['year'] - env['startyear'];

    this.fullConditionConstraints = [
      // ConstraintHelper.ExistsDestNation(),
      // ConstraintHelper.AllowJoinDestNation(relYear),
    ];
  }

  public getCommandDetailTitle(): string {
    return '장수를 따라 임관';
  }

  public canDisplay(): boolean {
    return this.env['join_mode'] !== 'onlyRandom';
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
    if (!this.destGeneral) {
      return '장수를 따라 임관';
    }

    const destGeneralName = this.destGeneral.data?.name || '무명';
    const josaUl = JosaUtil.pick(destGeneralName, '을');
    return `【${destGeneralName}】${josaUl} 따라 임관`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;
    const sessionId = env['session_id'] || 'sangokushi_default';

    const general = this.generalObj;
    const date = general.getTurnTime();
    const generalName = general.getName();
    const josaYi = JosaUtil.pick(generalName, '이');

    const destNation = this.destNation;
    if (!destNation) {
      throw new Error('대상 국가를 찾을 수 없습니다');
    }

    const gennum = destNation.gennum || 0;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    const initialGenLimit = GameConst.initialNationGenLimit || 10;
    let exp = 100;
    if (gennum < initialGenLimit) {
      exp = 700;
    }

    general.setVar('nation', destNationID);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.setVar('belong', 1);

    if (this.destGeneral) {
      general.setVar('city', this.destGeneral.data?.city || this.destGeneral.data?.location || 0);
    } else {
      // TODO: 국가의 수도를 찾아서 설정
      const capitalCity = await db.queryFirst('SELECT city FROM general WHERE nation = ? AND officer_level = 12', [destNationID]);
      if (capitalCity) {
        general.setVar('city', capitalCity.city);
      }
    }

    await db.update(
      'nation',
      {
        gennum: db.raw('gennum + 1')
      },
      'nation = ?',
      destNationID
    );

    // TODO: refreshNationStaticInfo 구현

    // TODO: increaseInheritancePoint 구현
    // general.increaseInheritancePoint(InheritanceKey.active_action, 1);

    general.addExperience(exp);
    this.setResultTurn(new LastTurn(JoinGeneralNationCommand.getName(), this.arg));
    general.checkStatChange();

    // StaticEventHandler 처리
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(
        general,
        this.destGeneral,
        this,
        this.env,
        this.arg
      );
    } catch (error: any) {
      // StaticEventHandler 실패해도 계속 진행
      console.error('StaticEventHandler failed:', error);
    }

    // tryUniqueItemLottery 처리
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env['session_id'] || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '임관');
    } catch (error: any) {
      // tryUniqueItemLottery 실패해도 계속 진행
      console.error('tryUniqueItemLottery failed:', error);
    }

    await this.saveGeneral();

    return true;
  }

  public exportJSVars(): Record<string, any> {
    // TODO: 구현
    return {};
    return {
      procRes: {
        nationList: [],
        generals: [],
        generalsKey: ['no', 'name', 'nationID', 'officerLevel', 'npc', 'leadership', 'strength', 'intel']
      }
    };
  }
}

