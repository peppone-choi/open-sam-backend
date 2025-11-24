import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { joinYearMonth } from '../../utils/date-utils';
import { refreshNationStaticInfo, deleteNation } from '../../utils/nation-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 해산 커맨드
 * 
 * 유랑 중인 세력의 군주가 세력을 해산합니다.
 * 게임 시작 이후에만 사용 가능하며, 모든 장수의 자금/군량이 기본값으로 조정됩니다.
 */
export class DissolveCommand extends GeneralCommand {
  protected static actionName = '해산';

  protected argTest(): boolean {
    this.arg = {};
    return true;
  }

  protected async init(): Promise<void> {
    await this.setCity();
    await this.setNation(['gennum']);

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

  public async runImpl(rng: RandUtil): Promise<boolean> {
    const general = this.generalObj;
    const logger = general.getLogger();
    const date = general.getTurnTime('hm');
    const env = this.env;

    // Check if game has started
    const initYearMonth = joinYearMonth(env.init_year, env.init_month);
    const yearMonth = joinYearMonth(env.year, env.month);

    if (yearMonth <= initYearMonth) {
      logger.pushGeneralActionLog(`다음 턴부터 해산할 수 있습니다. <1>${date}</>`);
      // Alternative command: searchTalent
      const SearchTalentCommand = require('./searchTalent').SearchTalentCommand;
      this.alternative = new SearchTalentCommand(general, this.env, null);
      return false;
    }

    const generalName = general.getName();
    const josaYi = this.pickJosa(generalName, '이');

    const nation = this.nation;
    const nationID = nation.nation;
    const nationName = nation.name;
    const josaUl = this.pickJosa(nationName, '을');

    // Reset all generals' gold and rice to default
    const General = require('../../models/general.model').General;
    await General.updateMany(
      { nation: nationID, gold: { $gt: GameConst.defaultGold } },
      { gold: GameConst.defaultGold }
    );
    await General.updateMany(
      { nation: nationID, rice: { $gt: GameConst.defaultRice } },
      { rice: GameConst.defaultRice }
    );

    // Reset current general's resources
    general.increaseVarWithLimit('gold', 0, 0, GameConst.defaultGold);
    general.increaseVarWithLimit('rice', 0, 0, GameConst.defaultRice);

    await refreshNationStaticInfo();

    // Log messages
    logger.pushGeneralActionLog(`세력을 해산했습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} 세력을 해산했습니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaUl} 해산`);

    this.setResultTurn(new LastTurn(DissolveCommand.getName(), this.arg));

    // Delete nation and update all its generals
    const nationGenerals = await deleteNation(general, false);
    general.setVar('makelimit', 12);

    // Apply DB changes for all generals
    for (const oldGeneral of nationGenerals) {
      await oldGeneral.applyDB();
    }

    await general.applyDB();

    // TODO: Trigger event handler for city occupation
    // runEventHandler(db, null, EventTarget.OccupyCity);

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
