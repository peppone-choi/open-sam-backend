import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
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

    nextTerm = this.generalObj!.onCalcStrategic(che_의병모집.getName(), 'delay', nextTerm);
    return nextTerm;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;
    const generalID = general!.getID();
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const year = this.env['year'];
    const month = this.env['month'];

    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

    const commandName = che_의병모집.getName();
    const josaUl = JosaUtil.pick(commandName, '을');

    const genCount = await db.queryFirstField(
      'SELECT count(no) FROM general WHERE nation=%i AND npc < 2',
      [nationID]
    );
    const npcCount = await db.queryFirstField(
      'SELECT count(no) FROM general WHERE nation=%i AND npc = 3',
      [nationID]
    );
    const npcOtherCount = await db.queryFirstField(
      'SELECT count(no) FROM general WHERE nation!=%i AND npc = 3',
      [nationID]
    );

    const genCountFit = Util.valueFit(genCount, 1);
    const npcCountFit = Util.valueFit(npcCount, 1);
    const npcOtherCountScore = Util.round(Math.sqrt(npcOtherCount + 1)) - 1;

    const logger = general!.getLogger();
    logger.pushGeneralActionLog(`${commandName} 발동! <1>${date}</>`);

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <M>${commandName}</>${josaUl} 발동하였습니다.`;

    const nationGeneralList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE nation=%i AND no != %i',
      [nationID, generalID]
    );
    for (const nationGeneralID of nationGeneralList) {
      const nationGeneralLogger = new ActionLogger(nationGeneralID as number, nationID, year, month);
      nationGeneralLogger.pushGeneralActionLog(broadcastMessage, ActionLogger.PLAIN);
      await nationGeneralLogger.flush();
    }

    logger.pushGeneralHistoryLog(`<M>${commandName}</>${josaUl} 발동`);
    (logger as any).pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <M>${commandName}</>${josaUl} 발동`
    );

    general!.addExperience(5 * (this.getPreReqTurn() + 1));
    general!.addDedication(5 * (this.getPreReqTurn() + 1));

    const KVStorage = (global as any).KVStorage;
    const gameStor = KVStorage.getStorage(db, 'game_env');

    const avgGenCnt = await db.queryFirstField('SELECT avg(gennum) FROM nation WHERE level > 0');
    const createGenCnt = 3 + Util.round(avgGenCnt / 8);
    const createGenIdx = gameStor.npccount + 1;
    const lastCreatGenIdx = createGenIdx + createGenCnt;

    const pickTypeList: any = { 무: 5, 지: 5 };

    const avgGen = await db.queryFirstRow(
      `SELECT avg(dedication) as ded,avg(experience) as exp,
       avg(dex1+dex2+dex3+dex4) as dex_t, avg(age) as age, avg(dex5) as dex5
       FROM general WHERE nation=%i`,
      [nationID]
    );

    const pickGeneralFromPool = (global as any).pickGeneralFromPool;
    const pickedNPCs = pickGeneralFromPool(db, rng, 0, createGenCnt);

    for (const pickedNPC of pickedNPCs) {
      const newNPC = pickedNPC.getGeneralBuilder();

      newNPC.setCityID(general!.getCityID());
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

    gameStor.npccount = lastCreatGenIdx;
    await db.update(
      'nation',
      {
        gennum: db.sqleval('gennum + %i', [createGenCnt]),
        strategic_cmd_limit: this.generalObj!.onCalcStrategic(che_의병모집.getName(), 'globalDelay', 9)
      },
      'nation=%i',
      [nationID]
    );

    this.setResultTurn(new LastTurn(che_의병모집.getName(), this.arg));
    await general!.applyDB(db);

    return true;
  }
}
