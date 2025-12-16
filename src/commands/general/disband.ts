// @ts-nocheck - Type issues need review
import { GeneralCommand } from '../base/GeneralCommand';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { SearchTalentCommand } from './searchTalent';
import { generalRepository } from '../../repositories/general.repository';

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

    const sessionId = this.env.session_id || 'sangokushi_default';
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

    const generalName = general.data.name || general.name;
    const josaYi = JosaUtil.pick(generalName, '이');

    const nation = this.nation;
    if (!nation) throw new Error('nation이 없습니다');
    const nationID = nation.nation;
    const nationName = nation.name;
    const josaUl = JosaUtil.pick(nationName, '을');

    // MongoDB로 국가 소속 장수들의 자금/군량 상한 설정
    await generalRepository.capResourcesByNation(sessionId, nationID, 'gold', GameConst.defaultGold);
    await generalRepository.capResourcesByNation(sessionId, nationID, 'rice', GameConst.defaultRice);

    general.increaseVarWithLimit('gold', 0, 0, GameConst.defaultGold);
    general.increaseVarWithLimit('rice', 0, 0, GameConst.defaultRice);

    await refreshNationStaticInfo();

    logger.pushGeneralActionLog(`세력을 해산했습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} 세력을 해산했습니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaUl} 해산`);
    this.setResultTurn(new LastTurn((this.constructor as typeof DisbandCommand).getName(), this.arg));

    const nationGenerals = await deleteNation(general, false);
    general.data.makelimit = 12;
    
    for (const oldGeneral of nationGenerals) {
      await oldGeneral.save();
    }
    
    // 공통 후처리 (해산은 아이템 추첨 제외)
    await this.postRunHooks(rng, { skipItemLottery: true });
    
    await this.saveGeneral();

    await runEventHandler('OccupyCity');

    return true;
  }
}

async function refreshNationStaticInfo(): Promise<void> {
  // TODO: 국가 정적 정보 갱신 구현
}

async function deleteNation(general: any, flag: boolean): Promise<any[]> {
  // TODO: 국가 삭제 구현
  return [];
}

async function runEventHandler(eventType: string): Promise<void> {
  // TODO: 이벤트 핸들러 구현
}
