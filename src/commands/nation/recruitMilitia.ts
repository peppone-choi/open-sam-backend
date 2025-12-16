// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { GameConst } from '../../const/GameConst';
import { Util } from '../../utils/Util';

export class che_의병모집 extends NationCommand {
  static getName(): string {
    return '의병모집';
  }

  static getCategory(): string {
    return 'nation';
  }

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setNation(['strategic_cmd_limit']);
    this.setCity();
    const env = this.env;
    const relYear = env['year'] - env['startyear'];

    // PHP: fullConditionConstraints
    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.AvailableStrategicCommand('strategic'),
      ConstraintHelper.NotOpeningPart(relYear)
    ];
  }

  public getCommandDetailTitle(): string {
    const name = che_의병모집.getName();
    const reqTurn = this.getPreReqTurn() + 1;
    const postReqTurn = this.getPostReqTurn();

    return `${name}/${reqTurn}턴(재사용 대기 ${postReqTurn})`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 2;
  }

  public getPostReqTurn(): number {
    const genCount = Util.valueFit(this.nation['gennum'], GameConst.initialNationGenLimit);
    let nextTerm = Util.round(Math.sqrt(genCount * 10) * 10);

    nextTerm = this.generalObj.onCalcStrategic(che_의병모집.getName(), 'delay', nextTerm);
    return nextTerm;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const env = this.env;

    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalID = general!.getID();
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const year = this.env['year'];
    const month = this.env['month'];

        if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

    const commandName = che_의병모집.getName();
    const josaUl = JosaUtil.pick(commandName, '을');

    // 장수 수 조회 (MongoDB)
    const sessionId = this.env.session_id || 'sangokushi_default';
    const allGenerals = await generalRepository.findByNation(sessionId, nationID);
    const genCount = allGenerals.filter((g: any) => (g.npc ?? g.data?.npc ?? 0) < 2).length;
    const npcCount = allGenerals.filter((g: any) => (g.npc ?? g.data?.npc ?? 0) === 3).length;
    
    // 다른 국가 NPC 수 조회 (전체 장수에서 필터)
    const allNations = await nationRepository.findAll(sessionId);
    let npcOtherCount = 0;
    for (const nation of allNations) {
      const nId = (nation as any).nation ?? (nation as any).data?.nation;
      if (nId !== nationID) {
        const otherGenerals = await generalRepository.findByNation(sessionId, nId);
        npcOtherCount += otherGenerals.filter((g: any) => (g.npc ?? g.data?.npc ?? 0) === 3).length;
      }
    }

    const genCountFit = Util.valueFit(genCount, 1);
    const npcCountFit = Util.valueFit(npcCount, 1);
    const npcOtherCountScore = Util.round(Math.sqrt(npcOtherCount + 1)) - 1;

    const logger = general!.getLogger();
    logger.pushGeneralActionLog(`${commandName} 발동! <1>${date}</>`);

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <M>${commandName}</>${josaUl} 발동하였습니다.`;

    // 국가 장수 목록 조회 (자신 제외) (MongoDB)
    const nationGeneralList = allGenerals.filter((g: any) => (g.no ?? g.data?.no) !== generalID).map((g: any) => g.no ?? g.data?.no);
    for (const nationGeneralID of nationGeneralList) {
      const nationGeneralLogger = new ActionLogger(nationGeneralID as number, nationID, year, month);
      nationGeneralLogger.pushGeneralActionLog(broadcastMessage, ActionLogger.PLAIN);
      await nationGeneralLogger.flush();
    }

    logger.pushGeneralHistoryLog(`<M>${commandName}</>${josaUl} 발동 <1>${date}</>`);
    logger.pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <M>${commandName}</>${josaUl} 발동`
    );

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const KVStorage = global.KVStorage;
    const gameStor = KVStorage.getStorage(db, 'game_env');

    // 평균 장수 수 계산 (MongoDB)
    const activeNations = allNations.filter((n: any) => (n.level ?? n.data?.level ?? 0) > 0);
    const avgGenCnt = activeNations.length > 0 
      ? activeNations.reduce((sum: number, n: any) => sum + (n.gennum ?? n.data?.gennum ?? 0), 0) / activeNations.length 
      : 10;
    const createGenCnt = 3 + Util.round(avgGenCnt / 8);
    const createGenIdx = gameStor?.npccount ? gameStor.npccount + 1 : 1;
    const lastCreatGenIdx = createGenIdx + createGenCnt;

    const pickTypeList: any = { 무: 5, 지: 5 };

    // 국가 장수 평균 능력치 계산 (MongoDB)
    const avgGen: any = {
      ded: allGenerals.length > 0 ? allGenerals.reduce((sum: number, g: any) => sum + (g.dedication ?? g.data?.dedication ?? 0), 0) / allGenerals.length : 100,
      exp: allGenerals.length > 0 ? allGenerals.reduce((sum: number, g: any) => sum + (g.experience ?? g.data?.experience ?? 0), 0) / allGenerals.length : 100,
      dex_t: 0,
      age: allGenerals.length > 0 ? allGenerals.reduce((sum: number, g: any) => sum + (g.age ?? g.data?.age ?? 30), 0) / allGenerals.length : 30,
      dex5: 0
    };

    const pickGeneralFromPool = global.pickGeneralFromPool;
    const pickedNPCs = pickGeneralFromPool(db, rng, 0, createGenCnt);

    for (const pickedNPC of pickedNPCs) {
      const newNPC = pickedNPC.getGeneralBuilder();

      newNPC.setCityID(general.getCityID());
      newNPC.setNationID(general!.getNationID());

      newNPC.setSpecial('None', 'None');
      newNPC.setLifeSpan(env['year'] - 20, env['year'] + 10);
      newNPC.setKillturn(rng.nextRangeInt(64, 70));
      newNPC.setNPCType(4);
      newNPC.setMoney(1000, 1000);
      newNPC.setSpecYear(19, 19);
      newNPC.setExpDed(avgGen['exp'], avgGen['ded']);
      newNPC.fillRemainSpecAsRandom(pickTypeList, avgGen, env);

      await newNPC.build(this.env);
      pickedNPC.occupyGeneralName();
    }

    if (gameStor) gameStor.npccount = lastCreatGenIdx;
    // 국가 장수 수 증가 (CQRS 패턴)
    await this.incrementNation(nationID, { gennum: createGenCnt });
    await this.updateNation(nationID, {
      strategic_cmd_limit: this.generalObj.onCalcStrategic(che_의병모집.getName(), 'globalDelay', 9)
    });

    this.setResultTurn(new LastTurn(che_의병모집.getName(), this.arg));
    await this.saveGeneral();

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    return true;
  }
}
