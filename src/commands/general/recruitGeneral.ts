// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 장수를 따라 임관 커맨드
 * 
 * 재야 장수가 특정 장수가 속한 국가로 임관합니다.
 */
export class RecruitGeneralCommand extends GeneralCommand {
  protected static actionName = '장수를 따라 임관';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destGeneralID = this.arg.destGeneralID;

    if (destGeneralID === null || destGeneralID === undefined) {
      return false;
    }

    if (typeof destGeneralID !== 'number') {
      return false;
    }
    if (destGeneralID < 1) {
      return false;
    }
    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }

    this.arg = {
      destGeneralID,
    };

    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const relYear = this.env.year - this.env.startyear;

    this.permissionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!==', 'onlyRandom', '임관 모드가 아닙니다.')
    ];

    this.minConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!==', 'onlyRandom', '임관 모드가 아닙니다.'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.AllowJoinAction()
    ];
  }

  public getCommandDetailTitle(): string {
    return '장수를 따라 임관';
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  protected initWithArg(): void {
    const relYear = this.env.year - this.env.startyear;

    // PHP: fullConditionConstraints
    this.fullConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!==', 'onlyRandom', '임관 모드가 아닙니다.'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.NotOpeningPart(relYear),
      ConstraintHelper.AllowJoinAction()
    ];
    
    // destGeneral, destNation은 run() 메서드에서 로드됨
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
    const destGeneralName = this.destGeneralObj.getName();
    return `【${destGeneralName}】을 따라 임관`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const env = this.env;
    const general = this.generalObj;
    const sessionId = general.getSessionID();
    const date = general.getTurnTime('HM');
    const generalName = general.data.name || general.name;

    const destNation = this.destNation;
    const gennum = destNation.gennum;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    let exp: number;
    const initialNationGenLimit = 6; // GameConst::$initialNationGenLimit
    if (gennum < initialNationGenLimit) {
      exp = 700;
    } else {
      exp = 100;
    }

    general.data.nation = destNationID;
    general.data.officer_level = 1;
    general.data.officer_city = 0;
    general.data.belong = 1;

    let targetCityID: number;
    if (this.destGeneralObj !== null) {
      targetCityID = this.destGeneralObj.getCityID();
    } else {
      const lordGeneral = await generalRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': destNationID,
        'data.officer_level': 12
      });
      targetCityID = lordGeneral?.data?.city || destNation.capital || 0;
    }
    await this.updateGeneralCity(targetCityID);

    await nationRepository.updateByNationNum(sessionId, destNationID, {
      gennum: (destNation.gennum || 0) + 1
    });

    try {
      const { refreshNationStaticInfo } = await import('../../func/refreshNationStaticInfo');
      await refreshNationStaticInfo();
    } catch (error) {
      console.error('refreshNationStaticInfo 실패:', error);
    }

    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        // TODO: general.increaseInheritancePoint('active_action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }

    general.addExperience(exp);
    this.setResultTurn(new LastTurn(RecruitGeneralCommand.getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      await tryUniqueItemLottery(
        // TODO: general.genGenericUniqueRNG(RecruitGeneralCommand.actionName),
        general
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    const generals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.no': { $ne: this.generalObj.getID() }
    });
    
    const destRawGenerals = generals.map(g => ({
      no: g.data?.no,
      name: g.data?.name,
      nationID: g.data?.nation,
      officerLevel: g.data?.officer_level,
      npc: g.data?.npc,
      leadership: g.data?.leadership,
      strength: g.data?.strength,
      intel: g.data?.intel
    })).sort((a, b) => {
      if (a.npc !== b.npc) return (a.npc || 0) - (b.npc || 0);
      return (a.name || '').localeCompare(b.name || '');
    });

    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    const nationList = nations.map(n => ({
      nation: n.nation || n.data?.nation,
      name: n.name || n.data?.name,
      color: n.color || n.data?.color
    }));

    return {
      procRes: {
        nationList,
        generals: destRawGenerals,
        generalsKey: ['no', 'name', 'nationID', 'officerLevel', 'npc', 'leadership', 'strength', 'intel'],
      },
    };
  }
}
