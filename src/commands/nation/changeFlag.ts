// @ts-nocheck - Legacy db usage needs migration to Mongoose
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';

export class che_국기변경 extends NationCommand {
  static getName(): string {
    return '국기변경';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('colorType' in this.arg)) return false;

    const colorType = this.arg['colorType'];
    const nationColors = this.getNationColors();
    
    if (!(colorType in nationColors)) return false;

    this.arg = { colorType };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['aux']);

    const actionName = this.constructor.getName();

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqNationAuxValue(`can_${actionName}`, 0, '>', 0, '더이상 변경이 불가능합니다.')
    ];
  }

  protected initWithArg(): void {
    const actionName = this.constructor.getName();

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqNationAuxValue(`can_${actionName}`, 0, '>', 0, '더이상 변경이 불가능합니다.')
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

  public getBrief(): string {
    const nationColors = this.getNationColors();
    const color = nationColors[this.arg['colorType']];
    return `【<span style='color:${color};'>국기</span>】를 변경`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const actionName = this.constructor.getName();

    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const colorType = this.arg['colorType'];
    const nationColors = this.getNationColors();
    const color = nationColors[colorType];

    const nationID = general.getNationID();
    const nationName = this!.nation['name'];

    const logger = general!.getLogger();

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const aux = this!.nation['aux'];
    aux[`can_${actionName}`] = 0;

    await db.update('nation', {
      color: color,
      aux: JSON.stringify(aux)
    },  'nation=%i', [nationID]);

    logger.pushGeneralActionLog(`<span style='color:${color};'><b>국기</b></span>를 변경하였습니다 <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<span style='color:${color};'><b>국기</b></span>를 변경 <1>${date}</>`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <span style='color:${color};'><b>국기</b></span>를 변경하였습니다`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <span style='color:${color};'><b>국기</b></span>를 변경하였습니다`);
    logger.pushGlobalHistoryLog(`<S><b>【국기변경】</b></><D><b>${nationName}</b></>${josaYiNation} <span style='color:${color};'><b>국기</b></span>를 변경하였습니다.`);

    try {
      const { InheritancePointService, InheritanceKey } = await import('../../services/inheritance/InheritancePoint.service');
      const sessionId = this.env.session_id || 'sangokushi_default';
      const inheritanceService = new InheritancePointService(sessionId);
      const userId = general.data.owner ?? general.data.user_id ?? general.getID();
      await inheritanceService.recordActivity(userId, InheritanceKey.ACTIVE_ACTION, 1);
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }
    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await general.applyDB(db);

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        colors: this.getNationColors()
      }
    };
  }

  private getNationColors(): Record<string, string> {
    return {
      red: '#FF0000',
      blue: '#0000FF',
      green: '#00FF00',
      yellow: '#FFFF00',
      purple: '#800080',
      orange: '#FFA500'
    };
  }
}
