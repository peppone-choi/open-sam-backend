// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';

export class StepDownCommand extends GeneralCommand {
  protected static actionName = '하야';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotLord(),
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

    const env = this.env;
    const general = this.generalObj;
    const sessionId = general.getSessionID();
    const date = general.getTurnTime('HM');
    const generalID = general.getID();
    const generalName = general.getName();
    const josaYi = JosaUtil.pick(generalName, '이');

    const nationID = this.nation?.nation || 0;
    const nationName = this.nation?.name || '';

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D><b>${nationName}</b></>에서 하야했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>에서 하야`) as any;
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>에서 <R>하야</>했습니다.`);

    general.setVar('experience', general.getVar('experience') * (1 - 0.1 * general.getVar('betray')));
    general.addExperience(0, false);
    general.setVar('dedication', general.getVar('dedication') * (1 - 0.1 * general.getVar('betray')));
    general.addDedication(0, false);
    
    const maxBetrayCnt = GameConst.maxBetrayCnt || 10;
    general.increaseVarWithLimit('betray', 1, null, maxBetrayCnt);
    general.setVar('permission', 'normal');

    const newGold = Util.valueFit(general.getVar('gold'), null, GameConst.defaultGold);
    const newRice = Util.valueFit(general.getVar('rice'), null, GameConst.defaultRice);

    const lostGold = general.getVar('gold') - newGold;
    const lostRice = general.getVar('rice') - newRice;

    general.setVar('gold', newGold);
    general.setVar('rice', newRice);

    const currentNation = await nationRepository.findByNationNum(sessionId, nationID);
    await nationRepository.updateByNationNum(sessionId, nationID, {
      gold: (currentNation?.gold || 0) + lostGold,
      rice: (currentNation?.rice || 0) + lostRice,
      gennum: (currentNation?.gennum || 0) - (general.getNPCType() !== 5 ? 1 : 0)
    });

    try {
      const { refreshNationStaticInfo } = await import('../../func/refreshNationStaticInfo');
      await refreshNationStaticInfo();
    } catch (error) {
      console.error('refreshNationStaticInfo 실패:', error);
    }

    general.setVar('nation', 0);
    general.setVar('officer_level', 0);
    general.setVar('officer_city', 0);
    general.setVar('belong', 0);
    general.setVar('makelimit', 12);

    if (general.getVar('troop') === generalID) {
      await generalRepository.updateManyByFilter(
        { session_id: sessionId, 'data.troop': generalID },
        { 'data.troop': 0 }
      );
      
      try {
        const { troopRepository } = await import('../../repositories/troop.repository');
        await troopRepository.deleteManyByFilter({
          session_id: sessionId,
          troop_leader: generalID
        });
      } catch (error) {
        console.error('부대 삭제 실패:', error);
      }
    }
    general.setVar('troop', 0);

    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        general.increaseInheritancePoint('active_action', 1);
      }
      
      if (general.getNPCType() < 2) {
        const belongCount = general.getVar('belong') || 0;
        general.setVar('max_belong', Math.max(belongCount, general.getVar('max_belong') || 0));
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }

    this.setResultTurn(new LastTurn(StepDownCommand.getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    // UniqueItemLottery
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '하야');
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }
    
    await this.saveGeneral();

    return true;
  }
}
