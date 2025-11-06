import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';

export class FoundNationCommand extends GeneralCommand {
  protected static actionName = '건국';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    const nationName = this.arg.nationName ?? null;
    const nationType = this.arg.nationType ?? null;
    const colorType = this.arg.colorType ?? null;

    if (nationName === null || nationType === null || colorType === null) {
      return false;
    }

    if (typeof nationName !== 'string' || typeof nationType !== 'string' || typeof colorType !== 'number') {
      return false;
    }

    if (nationName === '' || this.getStringWidth(nationName) > 18) {
      return false;
    }

    // TODO: GetNationColors validation
    // TODO: buildNationTypeClass validation

    this.arg = {
      nationName,
      nationType,
      colorType
    };

    return true;
  }

  private getStringWidth(str: string): number {
    return Array.from(str).reduce((width, char) => {
      return width + (char.charCodeAt(0) > 127 ? 2 : 1);
    }, 0);
  }

  protected init(): void {
    const env = this.env;
    this.setCity();
    this.setNation(['gennum', 'aux']);

    const relYear = env.year - env.startyear;

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // BeOpeningPart(relYear + 1),
      // ReqNationValue('level', '국가규모', '==', 0, '정식 국가가 아니어야합니다.'),
      // NoPenalty(PenaltyKey.NoFoundNation),
    ];
  }

  protected initWithArg(): void {
    const env = this.env;
    const relYear = env.year - env.startyear;

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // BeLord(),
      // WanderingNation(),
      // ReqNationValue('gennum', '수하 장수', '>=', 2),
      // BeOpeningPart(relYear + 1),
      // CheckNationNameDuplicate(this.arg.nationName),
      // AllowJoinAction(),
      // ConstructableCity(),
      // NoPenalty(PenaltyKey.NoFoundNation),
    ];
  }

  public getBrief(): string {
    const nationName = this.arg.nationName;
    const josaUl = JosaUtil.pick(nationName, '을');
    return `【${nationName}】${josaUl} 건국`;
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
    const logger = general.getLogger();

    const initYearMonth = Util.joinYearMonth(env.init_year, env.init_month);
    const yearMonth = Util.joinYearMonth(env.year, env.month);
    
    if (yearMonth <= initYearMonth) {
      logger.pushGeneralActionLog(`다음 턴부터 건국할 수 있습니다. <1>${date}</>`);
      // TODO: Alternative command (che_인재탐색)
      return false;
    }

    const josaYi = JosaUtil.pick(generalName, '이');

    const nationName = this.arg.nationName;
    const nationType = this.arg.nationType;
    const colorType = this.arg.colorType; // TODO: GetNationColors()[colorType]

    const cityName = this.city?.name || '';

    const josaUl = JosaUtil.pick(nationName, '을');

    // 국가 타입 이름 가져오기
    const { getNationTypeName } = await import('../../core/nation-type/NationTypeFactory');
    const nationTypeName = getNationTypeName(nationType);

    logger.pushGeneralActionLog(`<D><b>${nationName}</b></>${josaUl} 건국하였습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <G><b>${cityName}</b></>에 국가를 건설하였습니다.`);

    const josaNationYi = JosaUtil.pick(nationName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【건국】</b></>${nationTypeName} <D><b>${nationName}</b></>${josaNationYi} 새로이 등장하였습니다.`) as any;
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaUl} 건국`) as any;
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>${josaUl} 건국`);

    const exp = 1000;
    const ded = 1000;

    general.addExperience(exp);
    general.addDedication(ded);

    const aux = this.nation?.aux || {};
    aux.can_국기변경 = 1;

    await db.update('city', {
      nation: general.getNationID(),
      conflict: '{}'
    }, 'city=%i', general.getCityID());

    await db.update('nation', {
      name: nationName,
      color: colorType,
      level: 1,
      type: nationType,
      capital: general.getCityID(),
      aux: JSON.stringify(aux)
    }, 'nation=%i', general.getNationID());

    // TODO: refreshNationStaticInfo()
    // TODO: general.increaseInheritancePoint(InheritanceKey.active_action, 1)
    // TODO: general.increaseInheritancePoint(InheritanceKey.unifier, 250)

    this.setResultTurn(new LastTurn(FoundNationCommand.getName(), this.arg));
    general.checkStatChange();

    // StaticEventHandler 처리
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(
        general,
        null,
        this,
        this.env,
        this.arg
      );
    } catch (error: any) {
      console.error('StaticEventHandler failed:', error);
    }

    // tryUniqueItemLottery 처리 (건국 시 100% 확률)
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env['session_id'] || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '건국');
    } catch (error: any) {
      console.error('tryUniqueItemLottery failed:', error);
    }

    general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    // TODO: GameConst.$availableNationType
    // TODO: getAllNationStaticInfo()
    return {
      procRes: {
        available건국: false, // count(getAllNationStaticInfo()) < this.env.maxnation
        nationTypes: {},
        colors: {},
      }
    };
  }
}
