import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import { joinYearMonth } from '../../utils/date-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 전투특기초기화 커맨드
 * 
 * 전투 특기를 초기화하여 새로운 특기를 얻을 수 있게 합니다.
 * 5년(60턴)마다 1회 사용 가능합니다.
 */
export class ResetWarSkillCommand extends GeneralCommand {
  protected static actionName = '전투 특기 초기화';
  protected static specialType = 'special2';
  protected static specialAge = 'specage2';
  protected static specialText = '전투 특기';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected async init(): Promise<void> {
    this.minConditionConstraints = [
      ConstraintHelper.ReqGeneralValue(
        ResetWarSkillCommand.specialType,
        ResetWarSkillCommand.specialText,
        '!=',
        'None',
        '특기가 없습니다.'
      ),
    ];

    this.fullConditionConstraints = [
      ConstraintHelper.ReqGeneralValue(
        ResetWarSkillCommand.specialType,
        ResetWarSkillCommand.specialText,
        '!=',
        'None',
        '특기가 없습니다.'
      )
    ];
  }

  public getCommandDetailTitle(): string {
    const name = ResetWarSkillCommand.getName();
    let reqTurn = 0;
    if (this.getPreReqTurn()) {
      reqTurn = this.getPreReqTurn() + 1;
    }

    const title = `${name}(${reqTurn ? reqTurn + '턴, ' : ''}5년마다 1회)`;
    return title;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 1;
  }

  public getPostReqTurn(): number {
    return 60;
  }

  public getTermString(): string {
    const term = this.getResultTurn()?.getTerm() ?? 0;
    const termMax = this.getPreReqTurn() + 1;
    return `새로운 적성을 찾는 중... (${term}/${termMax})`;
  }

  public async runImpl(rng: RandUtil): Promise<boolean> {
    const general = this.generalObj;
    const date = general.getTurnTime('hm');

    const oldTypeKey = `prev_types_${ResetWarSkillCommand.specialType}`;
    const specialName = ResetWarSkillCommand.specialText;

    const env = this.env;

    const yearMonth = joinYearMonth(env.year, env.month);
    let oldSpecialList = general.getAuxVar(oldTypeKey) ?? [];
    oldSpecialList.push(general.getVar(ResetWarSkillCommand.specialType));

    // Reset list if all specials have been tried
    if (
      ResetWarSkillCommand.specialType === 'special' &&
      oldSpecialList.length === GameConst.availableSpecialDomestic.length
    ) {
      oldSpecialList = [general.getVar(ResetWarSkillCommand.specialType)];
    } else if (
      ResetWarSkillCommand.specialType === 'special2' &&
      oldSpecialList.length === GameConst.availableSpecialWar.length
    ) {
      oldSpecialList = [general.getVar(ResetWarSkillCommand.specialType)];
    }

    general.setAuxVar(oldTypeKey, oldSpecialList);

    // Reset special and increment age
    general.setVar(ResetWarSkillCommand.specialType, 'None');
    general.setVar(
      ResetWarSkillCommand.specialAge,
      (general.getVar('age') as number) + 1
    );

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`새로운 ${specialName}를 가질 준비가 되었습니다. <1>${date}</>`);

    this.setResultTurn(new LastTurn(ResetWarSkillCommand.getName(), this.arg));

    // Try unique item lottery
    tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, ResetWarSkillCommand.actionName),
      general
    );

    await general.applyDB();

    return true;
  }
}
