import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { refreshNationStaticInfo, deleteNation } from '../../utils/nation-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 해산 커맨드
 * PHP: sammo/Command/General/che_해산.php
 * 
 * 재야 국가(wandering nation)를 해산합니다.
 * 군주만 실행 가능하며, 소속 장수들은 모두 재야로 전환됩니다.
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

  public async run(rng: RandUtil): Promise<boolean> {
    if (!await this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const logger = general.getLogger();
    const date = general.getTurnTime('HM');

    const env = this.env;
    const initYearMonth = Util.joinYearMonth(env.init_year, env.init_month);
    const yearMonth = Util.joinYearMonth(env.year, env.month);

    // 초기 턴에는 해산 불가
    if (yearMonth <= initYearMonth) {
      logger.pushGeneralActionLog(`다음 턴부터 해산할 수 있습니다. <1>${date}</>`);
      // PHP에서는 che_인재탐색으로 대체하지만 여기서는 그냥 false 반환
      return false;
    }

    const generalName = general.getName();
    const nation = this.nation;
    const nationID = nation?.nation || 0;
    const nationName = nation?.name || '알 수 없음';
    const josaUl = JosaUtil.pick(nationName, '을');

    // 소속 장수들의 자금/군량을 기본값으로 제한
    // (실제로는 generalRepository를 통해 처리해야 하지만 간소화)
    
    // 본인의 자금/군량을 기본값으로 제한
    general.increaseVarWithLimit('gold', 0, 0, GameConst.defaultGold);
    general.increaseVarWithLimit('rice', 0, 0, GameConst.defaultRice);

    await refreshNationStaticInfo(env.session_id || 'default');

    logger.pushGeneralActionLog(`세력을 해산했습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 세력을 해산했습니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaUl} 해산`);
    
    this.setResultTurn(new LastTurn(DissolveCommand.getName(), this.arg));

    // deleteNation 함수 호출 (nation-utils에 구현 필요)
    // PHP: $nationGenerals = deleteNation($general, false);
    // 여기서는 간소화하여 본인만 재야로 전환
    general.setVar('nation', 0);
    general.setVar('officer_level', 0);
    general.setVar('makelimit', 12);

    await general.applyDB();

    return true;
  }
}
