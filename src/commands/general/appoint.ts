import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import { refreshNationStaticInfo, getNationStaticInfo } from '../../utils/nation-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 임관 커맨드
 * 
 * 재야 장수가 지정한 국가에 임관합니다.
 * 초기 국가 장수 제한 미만이면 경험치 700, 이후는 100을 획득합니다.
 */
export class AppointCommand extends GeneralCommand {
  protected static actionName = '임관';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destNationID = this.arg.destNationID ?? null;

    if (destNationID === null) {
      return false;
    }

    if (typeof destNationID !== 'number') {
      return false;
    }

    if (destNationID < 1) {
      return false;
    }

    this.arg = {
      destNationID
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
      ConstraintHelper.AllowJoinAction(),
      ConstraintHelper.NoPenalty('NoChosenAssignment'),
    ];
  }

  public getCommandDetailTitle(): string {
    return '지정한 국가로 임관';
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  protected async initWithArg(): Promise<void> {
    const destNationID = this.arg.destNationID;
    await this.setDestNation(destNationID, ['gennum', 'scout']);

    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.AllowJoinDestNation(relYear),
      ConstraintHelper.AllowJoinAction(),
      ConstraintHelper.NoPenalty('NoChosenAssignment'),
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
    const commandName = AppointCommand.getName();
    const destNationName = getNationStaticInfo(this.arg.destNationID)?.name ?? '알 수 없음';
    const josaRo = this.pickJosa(destNationName, '로');
    return `【${destNationName}】${josaRo} ${commandName}`;
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
    general.setVar('troop', 0);

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

    this.setResultTurn(new LastTurn(AppointCommand.getName(), this.arg));
    general.checkStatChange();

    // Try unique item lottery
    tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, AppointCommand.actionName),
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
    } else if (type === '로') {
      return hasJongseong ? '으로' : '로';
    }
    return '';
  }
}
