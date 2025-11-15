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
    const generalName = general.data.name || general.name;
    const josaYi = JosaUtil.pick(generalName, '이');

    const nationID = this.nation?.nation || 0;
    const nationName = this.nation?.name || '';

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D><b>${nationName}</b></>에서 하야했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>에서 하야`) as any;
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>에서 <R>하야</>했습니다.`);

    general.data.experience = (general.data.experience ?? 0) * (1 - 0.1 * (general.data.betray ?? 0));
    general.addExperience(0);
    general.data.dedication = (general.data.dedication ?? 0) * (1 - 0.1 * (general.data.betray ?? 0));
    general.addDedication(0);
    
    const maxBetrayCnt = GameConst.maxBetrayCnt || 10;
    general.increaseVarWithLimit('betray', 1, null, maxBetrayCnt);
    general.data.permission = 'normal';

    const newGold = Util.valueFit(general.data.gold, null, GameConst.defaultGold);
    const newRice = Util.valueFit(general.data.rice, null, GameConst.defaultRice);

    const lostGold = general.data.gold - newGold;
    const lostRice = general.data.rice - newRice;

    general.data.gold = newGold;
    general.data.rice = newRice;

    const currentNation = await nationRepository.findByNationNum(sessionId, nationID);
    const npcType = general.data.npc ?? general.npc ?? 0;
    await nationRepository.updateByNationNum(sessionId, nationID, {
      gold: (currentNation?.gold || 0) + lostGold,
      rice: (currentNation?.rice || 0) + lostRice,
      gennum: (currentNation?.gennum || 0) - (npcType !== 5 ? 1 : 0)
    });

    try {
      const { refreshNationStaticInfo } = await import('../../func/refreshNationStaticInfo');
      await refreshNationStaticInfo();
    } catch (error) {
      console.error('refreshNationStaticInfo 실패:', error);
    }

    general.data.nation = 0;
    general.data.officer_level = 0;
    general.data.officer_city = 0;
    general.data.belong = 0;
    general.data.makelimit = 12;

    if (general.data.troop === generalID) {
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
    general.data.troop = 0;

    try {
      // TODO: general.increaseInheritancePoint('active_action', 1);
      // InheritancePoint 시스템이 아직 구현되지 않음
      
      const npcType = general.data.npc ?? general.npc ?? 0;
      if (npcType < 2) {
        const belongCount = general.data.belong || 0;
        general.data.max_belong = Math.max(belongCount, general.data.max_belong || 0);
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
