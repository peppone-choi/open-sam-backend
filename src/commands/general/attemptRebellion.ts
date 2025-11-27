import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { JosaUtil } from '../../utils/JosaUtil';
import { General } from '../../models/general.model';
import { generalRepository } from '../../repositories/general.repository';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

export class AttemptRebellionCommand extends GeneralCommand {
  protected static actionName = '모반시도';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    // PHP: fullConditionConstraints
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.NotLord(),
      ConstraintHelper.AllowRebellion(),
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

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const sessionId = general.getSessionID();
    const nationID = general.getNationID();

    // 군주 찾기
    const lordDoc = await generalRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': nationID,
      'data.officer_level': 12
    });

    if (!lordDoc) {
      throw new Error('군주를 찾을 수 없습니다');
    }

    const lordID = lordDoc.data?.no || 0;
    const lordGeneral = await General.createObjFromDB(lordID, sessionId);

    const generalName = general.data.name || '무명';
    const lordName = lordGeneral.data.name || '무명';
    const nationName = this.nation?.name || '';

    const logger = general.getLogger();
    const lordLogger = lordGeneral.getLogger();

    general.data.officer_level = 12;
    general.data.officer_city = 0;
    lordGeneral.data.officer_level = 1;
    lordGeneral.data.officer_city = 0;
    const currentExp = lordGeneral.data.experience || 0;
    lordGeneral.data.experience = Math.floor(currentExp * 0.7);

    const josaYi = JosaUtil.pick(generalName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【모반】</b></><Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>의 군주 자리를 찬탈했습니다.`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <Y>${lordName}</>에게서 군주자리를 찬탈`);

    logger.pushGeneralActionLog(`모반에 성공했습니다. <1>${date}</>`);
    lordLogger.pushGeneralActionLog(`<Y>${generalName}</>에게 군주의 자리를 뺏겼습니다.`);

    logger.pushGeneralHistoryLog(`모반으로 <D><b>${nationName}</b></>의 군주자리를 찬탈`);
    lordLogger.pushGeneralHistoryLog(`<D><b>${generalName}</b></>의 모반으로 인해 <D><b>${nationName}</b></>의 군주자리를 박탈당함`);

    this.setResultTurn(new LastTurn(AttemptRebellionCommand.getName(), this.arg));
    
    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        // TODO: general.increaseInheritancePoint('active_action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }
    
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, lordGeneral, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    // PHP: tryUniqueItemLottery 호출 안 함
    
    await this.saveGeneral();
    await lordGeneral.save();

    return true;
  }
}
