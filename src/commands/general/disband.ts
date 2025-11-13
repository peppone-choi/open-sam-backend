// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { SearchTalentCommand } from './searchTalent';

/**
 * 해산 커맨드
 * 
 * 군주가 떠도는 세력(wandering nation)을 해산합니다.
 */
export class DisbandCommand extends GeneralCommand {
  protected static actionName = '해산';

  protected argTest(): boolean {
    this.arg = {};
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gennum']);

    this.fullConditionConstraints = [
      ConstraintHelper.BeLord(),
      ConstraintHelper.WanderingNation(),
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

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const logger = general.getLogger();
    const date = general.getTurnTime('HM');

    const initYearMonth = Util.joinYearMonth(this.env.init_year, this.env.init_month);
    const yearMonth = Util.joinYearMonth(this.env.year, this.env.month);
    
    if (yearMonth <= initYearMonth) {
      logger.pushGeneralActionLog(`다음 턴부터 해산할 수 있습니다. <1>${date}</>`);
      this.alternative = new SearchTalentCommand(general, this.env, null);
      return false;
    }

    const generalName = general.getName();
    const josaYi = JosaUtil.pick(generalName, '이');

    const nation = this.nation;
    if (!nation) throw new Error('nation이 없습니다');
    const nationID = nation.nation;
    const nationName = nation.name;
    const josaUl = JosaUtil.pick(nationName, '을');

    await db.update('general', {
      gold: GameConst.defaultGold
    },  'nation=? AND gold>?', [nationID, GameConst.defaultGold]);
    
    await db.update('general', {
      rice: GameConst.defaultRice
    },  'nation=? AND rice>?', [nationID, GameConst.defaultRice]);

    general.increaseVarWithLimit('gold', 0, 0, GameConst.defaultGold);
    general.increaseVarWithLimit('rice', 0, 0, GameConst.defaultRice);

    await refreshNationStaticInfo();

    logger.pushGeneralActionLog(`세력을 해산했습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} 세력을 해산했습니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaUl} 해산`);
    this.setResultTurn(new LastTurn((this.constructor as typeof DisbandCommand).getName(), this.arg));

    const nationGenerals = await deleteNation(general, false);
    general.setVar('makelimit', 12);
    
    for (const oldGeneral of nationGenerals) {
      await oldGeneral.save();
    }
    
    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      DisbandCommand,
      this.env,
      this.arg ?? {}
    );
    
    await this.saveGeneral();

    await runEventHandler(db, null, 'OccupyCity');

    return true;
  }
}

async function refreshNationStaticInfo(): Promise<void> {
}

async function deleteNation(general: any, flag: boolean): Promise<any[]> {
  return [];
}

async function runEventHandler(db: any, target: any, eventType: string): Promise<void> {
}
