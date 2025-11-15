// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

export class CrFoundNationCommand extends GeneralCommand {
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

    // GetNationColors validation - colorType은 숫자로 검증됨
    // buildNationTypeClass validation - nationType은 string으로 검증됨

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
      ConstraintHelper.BeOpeningPart(relYear + 1),
      ConstraintHelper.ReqNationValue('level', '국가규모', '==', 0, '정식 국가가 아니어야합니다.')
    ];
  }

  protected initWithArg(): void {
    const env = this.env;
    const relYear = env.year - env.startyear;

    this.fullConditionConstraints = [
      ConstraintHelper.BeLord(),
      ConstraintHelper.WanderingNation(),
      ConstraintHelper.ReqNationValue('gennum', '수하 장수', '>=', 2),
      ConstraintHelper.BeOpeningPart(relYear + 1),
      ConstraintHelper.CheckNationNameDuplicate(this.arg.nationName),
      ConstraintHelper.AllowJoinAction(),
      ConstraintHelper.NeutralCity(),
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
    const generalName = general.data.name || general.name;
    const logger = general.getLogger();

    const initYearMonth = Util.joinYearMonth(env.init_year, env.init_month);
    const yearMonth = Util.joinYearMonth(env.year, env.month);
    
    if (yearMonth <= initYearMonth) {
      logger.pushGeneralActionLog(`다음 턴부터 건국할 수 있습니다. <1>${date}</>`);
      // Alternative command: 인재탐색 권장
      return false;
    }

    const josaYi = JosaUtil.pick(generalName, '이');

    const nationName = this.arg.nationName;
    const nationType = this.arg.nationType;
    const colorType = this.arg.colorType;

    const cityName = this.city?.name || '';

    const josaUl = JosaUtil.pick(nationName, '을');

    // 국가 타입 이름 가져오기
    const { getNationTypeName } = await import('../../core/nation-type/NationTypeFactory');
    const nationTypeName = getNationTypeName(nationType);

    logger.pushGeneralActionLog(`<D><b>${nationName}</b></>${josaUl} 건국하였습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <G><b>${cityName}</b></>에 국가를 건설하였습니다.`);

    const josaNationYi = JosaUtil.pick(nationName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【건국】</b></>${nationTypeName} <D><b>${nationName}</b></>${josaNationYi} 새로이 등장하였습니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaUl} 건국`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>${josaUl} 건국`);

    const exp = 1000;
    const ded = 1000;

    general.addExperience(exp);
    general.addDedication(ded);

    const aux = this.nation?.aux || {};
    aux.can_국기변경 = 1;

    const { cityRepository } = await import('../../repositories/city.repository');
    const { nationRepository } = await import('../../repositories/nation.repository');
    const sessionId = env.session_id || 'sangokushi_default';

    await cityRepository.updateOneByFilter(
      { session_id: sessionId, city: general.getCityID() },
      { nation: general.getNationID(), conflict: {} }
    );

    await nationRepository.updateOneByFilter(
      { session_id: sessionId, 'data.nation': general.getNationID() },
      {
        name: nationName,
        color: colorType,
        level: 1,
        type: nationType,
        capital: general.getCityID(),
        aux: aux
      }
    );

    // refreshNationStaticInfo 호출
    try {
      const { refreshNationStaticInfo } = await import('../../func/refreshNationStaticInfo');
      await refreshNationStaticInfo(sessionId, general.getNationID());
    } catch (error: any) {
      console.error('refreshNationStaticInfo 실패:', error);
    }

    // InheritancePoint 처리
    try {
      // TODO: general.increaseInheritancePoint('active_action', 1);
    } catch (error: any) {
      console.error('InheritancePoint 실패:', error);
    }

    this.setResultTurn(new LastTurn(CrFoundNationCommand.getName(), this.arg));
    general.checkStatChange();

    // StaticEventHandler 처리
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error: any) {
      console.error('StaticEventHandler 실패:', error);
    }

    // tryUniqueItemLottery 처리
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      await tryUniqueItemLottery(rng, general, sessionId, '건국');
    } catch (error: any) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    // 전체 국가 수 조회
    const { nationRepository } = await import('../../repositories/nation.repository');
    const nationDocs = await nationRepository.findByFilter({
      session_id: sessionId,
      'data.level': { $gt: 0 }
    });
    
    const nationCount = nationDocs.length;
    const maxNation = this.env.maxnation || 30;
    
    // 사용 가능한 국가 타입
    const nationTypes = {};
    
    // 사용 가능한 색상 (기본 12색)
    const colors = Array.from({ length: 12 }, (_, i) => i);

    return {
      procRes: {
        available건국: nationCount < maxNation,
        nationTypes,
        colors,
      }
    };
  }
}
