import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';

export class che_국호변경 extends NationCommand {
  static getName(): string {
    return '국호변경';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('nationName' in this.arg)) return false;

    const nationName = this.arg['nationName'];
    
    if (typeof nationName !== 'string') return false;
    if (nationName.length > 18 || nationName === '') return false;

    this.arg = { nationName };
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
      (ConstraintHelper as any).ReqNationAuxValue(`can_${actionName}`, 0,  '>', [0, '더이상 변경이 불가능합니다.'])
    ];
  }

  protected initWithArg(): void {
    const actionName = this.constructor.getName();

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      (ConstraintHelper as any).ReqNationAuxValue(`can_${actionName}`, 0,  '>', [0, '더이상 변경이 불가능합니다.'])
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
    const newNationName = this.arg['nationName'];
    const josaRo = JosaUtil.pick(newNationName, '로');
    return `국호를 【${newNationName}】${josaRo} 변경`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const actionName = this.constructor.getName();

    const general = this.generalObj;
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const nationID = (general as any).getNationID();
    const nationName = this!.nation['name'];

    const logger = general!.getLogger();
    const newNationName = this.arg['nationName'];

    const existingNation = await db.queryFirstField(
      'SELECT name FROM nation WHERE name = %s LIMIT 1',
      newNationName
    );

    if (existingNation) {
      const text = `이미 같은 국호를 가진 곳이 있습니다. ${actionName} 실패 <1>${date}</>`;
      general!.getLogger().pushGeneralActionLog(text);
      return false;
    }

    const josaRo = JosaUtil.pick(newNationName, '로');

    general!.addExperience(5 * (this.getPreReqTurn() + 1));
    general!.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const aux = this!.nation['aux'];
    aux[`can_${actionName}`] = 0;

    await db.update('nation', {
      name: newNationName,
      aux: JSON.stringify(aux)
    },  'nation=%i', [nationID]);

    logger.pushGeneralActionLog(`국호를 <D><b>${newNationName}</b></>${josaRo} 변경합니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`국호를 <D><b>${newNationName}</b></>${josaRo} 변경`) as any;
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} 국호를 <D><b>${newNationName}</b></>${josaRo} 변경`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} 국호를 <D><b>${newNationName}</b></>${josaRo} 변경합니다.`);
    logger.pushGlobalHistoryLog(`<S><b>【국호변경】</b></><D><b>${nationName}</b></>${josaYiNation} 국호를 <D><b>${newNationName}</b></>${josaRo} 변경합니다.`) as any;

    general!.increaseInheritancePoint('active_action', 1);
    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await general!.applyDB(db);

    return true;
  }
}
