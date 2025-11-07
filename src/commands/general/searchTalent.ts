import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';
import { generalRepository } from '../../repositories/general.repository';

/**
 * 인재 탐색 커맨드
 * 
 * 재야 인재를 찾습니다.
 * 성공 시 새로운 NPC 장수가 생성되며, 실패 시 랜덤 능력치 경험치를 획득합니다.
 */
export class SearchTalentCommand extends GeneralCommand {
  protected static actionName = '인재탐색';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];
  }

  public async getCommandDetailTitle(): Promise<string> {
    const maxGenCnt = this.env.maxgeneral;
    
    // 실제 장수 수 계산 (npc <= 2: 플레이어/NPC 장수, npc >= 3 && npc <= 4: 재야 장수)
    const totalGenCnt = await generalRepository.countByFilter({ npc: { $lte: 2 } });
    const totalNpcCnt = await generalRepository.countByFilter({ npc: { $gte: 3, $lte: 4 } });

    const name = SearchTalentCommand.getName();
    const [reqGold, reqRice] = this.getCost();

    const foundProp = this.calcFoundProp(maxGenCnt, totalGenCnt, totalNpcCnt);
    const foundPropText = (foundProp * 100).toFixed(1);

    let title = `${name}(랜덤경험`;
    if (reqGold > 0) {
      title += `, 자금${reqGold}`;
    }
    if (reqRice > 0) {
      title += `, 군량${reqRice}`;
    }

    title += `, 확률 ${foundPropText}%)`;
    return title;
  }

  public getCost(): [number, number] {
    return [this.env.develcost, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public calcFoundProp(maxGenCnt: number, totalGenCnt: number, totalNpcCnt: number): number {
    const currCnt = Math.floor(totalGenCnt + totalNpcCnt / 2);
    let remainSlot = maxGenCnt - currCnt;
    if (remainSlot < 0) {
      remainSlot = 0;
    }

    const foundPropMain = Math.pow(remainSlot / maxGenCnt, 6);
    const foundPropSmall = 1 / (totalNpcCnt / 3 + 1);
    const foundPropBig = 1 / maxGenCnt;

    let foundProp: number;
    if (totalNpcCnt < 50) {
      foundProp = Math.max(foundPropMain, foundPropSmall);
    } else {
      foundProp = Math.max(foundPropMain, foundPropBig);
    }
    return foundProp;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();
    const env = this.env;
    const relYear = env.year - env.startyear;

    const general = this.generalObj;
    const date = general.getTurnTime('HM');

    const nationID = general.getNationID();

    // 실제 장수 수 계산 (npc <= 2: 플레이어/NPC 장수, npc >= 3 && npc <= 4: 재야 장수)
    const totalGenCnt = await generalRepository.countByFilter({ npc: { $lte: 2 } });
    const totalNpcCnt = await generalRepository.countByFilter({ npc: { $gte: 3, $lte: 4 } });

    const foundProp = this.calcFoundProp(env.maxgeneral, totalGenCnt, totalNpcCnt);
    const foundNpc = rng.nextBool(foundProp);

    const logger = general.getLogger();

    if (!foundNpc) {
      logger.pushGeneralActionLog(`인재를 찾을 수 없었습니다. <1>${date}</>`);

      const incStat = rng.choiceUsingWeight({
        leadership_exp: general.getLeadership(false, false, false, false),
        strength_exp: general.getStrength(false, false, false, false),
        intel_exp: general.getIntel(false, false, false, false),
      });

      const [reqGold, reqRice] = this.getCost();

      const exp = 100;
      const ded = 70;

      general.increaseVarWithLimit('gold', -reqGold, 0);
      general.increaseVarWithLimit('rice', -reqRice, 0);
      general.addExperience(exp);
      general.addDedication(ded);
      general.increaseVar(incStat, 1);
      this.setResultTurn(new LastTurn(SearchTalentCommand.getName(), this.arg));
      general.checkStatChange();
      // TODO: tryUniqueItemLottery
      await general.save();
      return true;
    }

    const exp = 100 * (Math.sqrt(1 / foundProp) + 1);
    const ded = 150 * (Math.sqrt(1 / foundProp) + 1);

    const scoutType = '발견';

    // TODO: NPC 생성 로직
    // 여기서는 간략화된 버전
    logger.pushGeneralActionLog(`<Y>인재</>를 ${scoutType}하였습니다! <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${general.getName()}</>이 <C>인재</>를 ${scoutType}하였습니다!`);
    logger.pushGeneralHistoryLog(`<C>인재</>를 ${scoutType}`);

    const incStat = rng.choiceUsingWeight({
      leadership_exp: general.getLeadership(false, false, false, false),
      strength_exp: general.getStrength(false, false, false, false),
      intel_exp: general.getIntel(false, false, false, false),
    });

    const [reqGold, reqRice] = this.getCost();

    // TODO: InheritancePoint
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(200);
    general.addDedication(300);
    general.increaseVar(incStat, 3);
    this.setResultTurn(new LastTurn(SearchTalentCommand.getName(), this.arg));
    general.checkStatChange();
    // TODO: StaticEventHandler
    // TODO: tryUniqueItemLottery
    await general.save();
    return true;
  }
}
