// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';

import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';

export class event_대검병연구 extends NationCommand {
  protected static actionName = '대검병 연구';
  protected static auxType = 'can_대검병사용';

  static getName(): string {
    return '대검병 연구';
  }

  static getCategory(): string {
    return 'nation';
  }

  protected argTest(): boolean {
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gold', 'rice', 'aux']);

    const name = this.constructor.actionName;
    const [reqGold, reqRice] = this.getCost();
    const GameConst = global.GameConst;

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.ReqNationAuxValue(this.constructor.auxType, 0, '<', 1, `${name}가 이미 완료되었습니다.`),
      ConstraintHelper.ReqNationGold(GameConst.basegold + reqGold),
      ConstraintHelper.ReqNationRice(GameConst.baserice + reqRice),
    ];

    this.fullConditionConstraints = this.minConditionConstraints;
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();
    const [reqGold, reqRice] = this.getCost();
    const reqTurn = this.getPreReqTurn() + 1;
    const reqGoldD5 = (reqGold / 10000).toLocaleString();
    const reqRiceD5 = (reqRice / 10000).toLocaleString();
    return `${name}/${reqTurn}턴(금/쌀 ${reqGoldD5}만)`;
  }

  public getPreReqTurn(): number {
    return 23;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getCost(): [number, number] {
    return [100000, 100000];
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    
    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const nationID = general!.getNationID();

    const actionName = this.constructor.actionName;
    const auxType = this.constructor.auxType;

    const aux = this.nation['aux'];
    aux[auxType] = 1;
    const [reqGold, reqRice] = this.getCost();

    const logger = general!.getLogger();

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const generalName = general!.getName();
    const josaYi = JosaUtil.pick(generalName, '이');

    // MongoDB로 국가 업데이트 (CQRS 패턴)
    await this.incrementNation(nationID, { gold: -reqGold, rice: -reqRice });
    await this.updateNation(nationID, { aux: JSON.stringify(aux) });

    logger.pushGeneralActionLog(`<M>${actionName}</> 완료`);
    logger.pushGeneralHistoryLog(`<M>${actionName}</> 완료`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <M>${actionName}</> 완료`);

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
    
    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }
    
    await this.saveGeneral();

    return true;
  }
}
