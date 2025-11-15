import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { generalRepository } from '../../repositories/general.repository';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

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
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
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
    return [this.env.develcost || 24, 0];
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

    // 0으로 나누기 방지
    const safeMaxGenCnt = Math.max(1, maxGenCnt);
    const foundPropMain = Math.pow(remainSlot / safeMaxGenCnt, 6);
    const foundPropSmall = 1 / (totalNpcCnt / 3 + 1);
    const foundPropBig = 1 / safeMaxGenCnt;

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
        politics_exp: general.getPolitics(false, false, false, false),
        charm_exp: general.getCharm(false, false, false, false),
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
      
      try {
        const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
        const sessionId = this.env.session_id || 'sangokushi_default';
        await tryUniqueItemLottery(
          // TODO: general.genGenericUniqueRNG(SearchTalentCommand.actionName),
          general,
          sessionId,
          '인재탐색'
        );
      } catch (error) {
        console.error('tryUniqueItemLottery 실패:', error);
      }
      
      await this.saveGeneral();
      return true;
    }

    // 0으로 나누기 방지
    const safeFoundProp = Math.max(0.0001, foundProp);
    const exp = 100 * (Math.sqrt(1 / safeFoundProp) + 1);
    const ded = 150 * (Math.sqrt(1 / safeFoundProp) + 1);

    const scoutType = '발견';

    // NPC 생성 로직 (실제 구현은 NPC 서비스에서 처리)
    try {
      const { NPCGenerationService } = await import('../../services/npc/NPCGeneration.service');
      await NPCGenerationService.createNPC(general.getSessionID(), {
        nation: 0,
        npc: 3,
        created_by: general.getID()
      });
    } catch (error) {
      console.error('NPC 생성 실패:', error);
    }
    
    logger.pushGeneralActionLog(`<Y>인재</>를 ${scoutType}하였습니다! <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${general.data.name || general.name}</>이 <C>인재</>를 ${scoutType}하였습니다!`);
    logger.pushGeneralHistoryLog(`<C>인재</>를 ${scoutType}`);

    const incStat = rng.choiceUsingWeight({
      leadership_exp: general.getLeadership(false, false, false, false),
      strength_exp: general.getStrength(false, false, false, false),
      intel_exp: general.getIntel(false, false, false, false),
      politics_exp: general.getPolitics(false, false, false, false),
      charm_exp: general.getCharm(false, false, false, false),
    });

    const [reqGold, reqRice] = this.getCost();

    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        // TODO: general.increaseInheritancePoint('active_action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }
    
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(200);
    general.addDedication(300);
    general.increaseVar(incStat, 3);
    this.setResultTurn(new LastTurn(SearchTalentCommand.getName(), this.arg));
    general.checkStatChange();
    
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(
        // TODO: general.genGenericUniqueRNG(SearchTalentCommand.actionName),
        general,
        sessionId,
        '인재탐색'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }
    
    await this.saveGeneral();
    return true;
  }
}
