import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import { refreshNationStaticInfo } from '../../utils/nation-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 장수대상임관 커맨드
 * 
 * 재야 장수가 특정 장수를 따라 그 장수가 소속된 국가에 임관합니다.
 */
export class AppointGeneralCommand extends GeneralCommand {
  protected static actionName = '장수를 따라 임관';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destGeneralID = this.arg.destGeneralID ?? null;

    if (destGeneralID === null) {
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
      destGeneralID
    };

    return true;
  }

  protected async init(): Promise<void> {
    await this.setCity();
    await this.setNation();

    const relYear = this.env.year - this.env.startyear;

    this.permissionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다')
    ];

    this.minConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
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

  protected async initWithArg(): Promise<void> {
    const destGeneralID = this.arg.destGeneralID;
    
    // Load destination general
    const General = require('../../models/general.model').General;
    const destGeneral = await General.createObjFromDB(destGeneralID);
    
    if (destGeneral) {
      this.setDestGeneral(destGeneral);
      await this.setDestNation(this.destGeneralObj.getVar('nation'), ['gennum', 'scout']);
    }

    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.AllowJoinDestNation(relYear),
      ConstraintHelper.AllowJoinAction()
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
    const destGeneralName = this.destGeneralObj?.getName() ?? '알 수 없음';
    const josaUl = this.pickJosa(destGeneralName, '을');
    return `【${destGeneralName}】${josaUl} 따라 임관`;
  }

  public async runImpl(rng: RandUtil): Promise<boolean> {
    const general = this.generalObj;
    const date = general.getTurnTime('hm');
    const generalName = general.getName();
    const josaYi = this.pickJosa(generalName, '이');

    const destNation = this.destNation;
    const gennum = destNation.gennum;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    // Determine experience based on nation general count
    const exp = gennum < GameConst.initialNationGenLimit ? 700 : 100;

    // Update general status
    general.setVar('nation', destNationID);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.setVar('belong', 1);

    // Set city - either destGeneralObj's city or lord's city
    if (this.destGeneralObj !== null) {
      general.setVar('city', this.destGeneralObj.getCityID());
    } else {
      // Find lord's city
      const General = require('../../models/general.model').General;
      const lordGeneral = await General.findOne({
        nation: destNationID,
        officer_level: 12
      }).lean();
      
      if (lordGeneral) {
        general.setVar('city', lordGeneral.city);
      }
    }

    // Update nation general count
    const Nation = require('../../models/nation.model').Nation;
    await Nation.updateOne(
      { nation: destNationID },
      { $inc: { gennum: 1 } }
    );

    await refreshNationStaticInfo();

    // Apply rewards
    general.increaseInheritancePoint('active_action', 1);
    general.addExperience(exp);

    this.setResultTurn(new LastTurn(AppointGeneralCommand.getName(), this.arg));
    general.checkStatChange();

    // Try unique item lottery
    tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, AppointGeneralCommand.actionName),
      general
    );

    await general.applyDB();

    return true;
  }

  /**
   * Helper to pick Korean josa particle
   */
  private pickJosa(word: string, type: string): string {
    const lastChar = word.charCodeAt(word.length - 1);
    const hasJongseong = (lastChar - 0xAC00) % 28 > 0;

    if (type === '이') {
      return hasJongseong ? '이' : '가';
    } else if (type === '을') {
      return hasJongseong ? '을' : '를';
    }
    return '';
  }
}
