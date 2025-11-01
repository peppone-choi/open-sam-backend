import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';

/**
 * 랜덤 임관 커맨드
 * 
 * 재야 장수가 무작위 국가로 임관합니다.
 * 국력이 약한 국가에 우선적으로 배정됩니다.
 */
export class RandomJoinNationCommand extends GeneralCommand {
  protected static actionName = '무작위 국가로 임관';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // BeNeutral(),
      // AllowJoinAction(),
    ];
  }

  public getCommandDetailTitle(): string {
    return '무작위 국가로 임관';
  }

  public getBrief(): string {
    return '무작위 국가로 임관';
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

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const generalName = general.getName();

    const relYear = env.year - env.startyear;

    let destNation: any = null;

    const initialNationGenLimit = 6; // GameConst::$initialNationGenLimit
    const defaultMaxGeneral = 50; // GameConst::$defaultMaxGeneral

    // NPC이고 역사 시나리오인 경우
    if (general.getNPCType() >= 2 && !env.fiction && env.scenario >= 1000 && env.scenario < 2000) {
      const genLimit = relYear < 3 ? initialNationGenLimit : defaultMaxGeneral;
      const nations = await (db as any)('nation')
        .join('general', function(this: any) {
          this.on('general.nation', '=', 'nation.nation')
            .andOn('general.officer_level', '=', (db as any).raw('?', [12]));
        })
        .where('nation.scout', 0)
        .where('nation.gennum', '<', genLimit)
        .select('nation.name', 'nation.nation', 'nation.scout', 'nation.gennum', 'general.affinity')
        .then((rows: any) => rows);

      if (nations.length > 0) {
        // 친화도 기반 선택
        let maxScore = 1 << 30;
        const generalAffinity = general.getVar('affinity');

        for (const testNation of nations) {
          let affinityDiff = Math.abs(generalAffinity - testNation.affinity);
          affinityDiff = Math.min(affinityDiff, Math.abs(affinityDiff - 150));

          let score = Math.log2(affinityDiff + 1);
          score += rng.nextFloat1();

          const allGen = nations.reduce((sum, n) => sum + n.gennum, 0);
          score += Math.sqrt(testNation.gennum / allGen);

          if (score < maxScore) {
            maxScore = score;
            destNation = testNation;
          }
        }
      }
    } else {
      // 일반 장수 - 국력 기반 선택
      const genLimit = relYear < 3 ? initialNationGenLimit : defaultMaxGeneral;

      const rawGeneralsCnt = await (db as any)('general as g')
        .leftJoin('rank_data as ra', function(this: any) {
          this.on('g.no', '=', 'ra.general_id').andOn('ra.type', '=', (db as any).raw('?', ['killcrew_person']));
        })
        .leftJoin('rank_data as rb', function(this: any) {
          this.on('g.no', '=', 'rb.general_id').andOn('rb.type', '=', (db as any).raw('?', ['deathcrew_person']));
        })
        .leftJoin('nation as n', 'g.nation', 'n.nation')
        .whereIn('g.npc', [0, 1, 2, 3, 6])
        .where('g.nation', '!=', 0)
        .where('n.scout', 0)
        .where('n.gennum', '<', genLimit)
        .groupBy('g.nation')
        .select(
          'g.nation',
          'n.gennum',
          'n.name',
          (db as any).raw(`SUM((COALESCE(ra.value, 0) + 50000)/(COALESCE(rb.value, 0) + 50000) * 
            (CASE WHEN g.npc < 2 THEN 1.15 ELSE 1 END) * 
            (CASE WHEN g.leadership >= 40 THEN g.leadership ELSE 0 END)) as warpower`),
          (db as any).raw(`SUM(SQRT(g.intel * g.strength) * 2 + g.leadership / 2)/5 as develpower`)
        );

      const generalsCnt: any[] = [];
      for (const nation of rawGeneralsCnt) {
        let calcCnt = (nation.warpower || 0) + (nation.develpower || 0);

        if (general.getNPCType() < 2 && nation.name.startsWith('ⓤ')) {
          calcCnt *= 100;
        }

        generalsCnt.push([nation, Math.pow(1 / calcCnt, 3)]);
      }

      if (generalsCnt.length > 0) {
        destNation = rng.choiceUsingWeightPair(generalsCnt);
      }
    }

    const logger = general.getLogger();

    if (!destNation) {
      logger.pushGeneralActionLog(`임관 가능한 국가가 없습니다. <1>${date}</>`);
      // TODO: alternative = new SearchTalentCommand
      return false;
    }

    const gennum = destNation.gennum;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const talkList = [
      '어쩌다 보니',
      '인연이 닿아',
      '발길이 닿는 대로',
      '소문을 듣고',
      '점괘에 따라',
      '천거를 받아',
      '유명한',
      '뜻을 펼칠 곳을 찾아',
      '고향에 가까운',
      '천하의 균형을 맞추기 위해',
      '오랜 은거를 마치고',
    ];
    const randomTalk = rng.choice(talkList);

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 랜덤 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 랜덤 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 ${randomTalk} <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    let exp: number;
    if (gennum < initialNationGenLimit) {
      exp = 700;
    } else {
      exp = 100;
    }

    general.setVar('nation', destNationID);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.setVar('belong', 1);

    if (this.destGeneralObj !== null) {
      general.setVar('city', this.destGeneralObj.getCityID());
    } else {
      const targetCityID = await (db as any)('general')
        .where('nation', destNationID)
        .where('officer_level', 12)
        .first()
        .then((r: any) => r?.city);
      general.setVar('city', targetCityID);
    }

    await (db as any)('nation')
      .where('nation', destNationID)
      .update({
        gennum: (db as any).raw('gennum + 1'),
      });

    // TODO: InheritancePoint
    general.addExperience(exp);
    this.setResultTurn(new LastTurn(RandomJoinNationCommand.getName(), this.arg));
    general.checkStatChange();
    // TODO: StaticEventHandler
    // TODO: tryUniqueItemLottery
    general.applyDB(db);

    return true;
  }
}
