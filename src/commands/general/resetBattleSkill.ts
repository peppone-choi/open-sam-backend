import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';

export class ResetBattleSkillCommand extends GeneralCommand {
  protected static actionName = '전투 특기 초기화';
  protected static specialType = 'special2';
  protected static specageType = 'specage2';
  protected static specialText = '전투 특기';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    const specialType = (this.constructor as typeof ResetBattleSkillCommand).specialType;
    const specialText = (this.constructor as typeof ResetBattleSkillCommand).specialText;

    this.minConditionConstraints = [
      ConstraintHelper.ReqGeneralValue(specialType, specialText, '!=', 'None', '특기가 없습니다.'),
    ];

    this.fullConditionConstraints = [
      ConstraintHelper.ReqGeneralValue(specialType, specialText, '!=', 'None', '특기가 없습니다.')
    ];
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();
    const reqTurn = this.getPreReqTurn();
    
    let reqTurnText = '';
    if (reqTurn) {
      reqTurnText = `${reqTurn + 1}턴, `;
    } else {
      reqTurnText = '0';
    }

    const title = `${name}(${reqTurnText}5년마다 1회)`;
    return title;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 1;
  }

  public getPostReqTurn(): number {
    return 60;
  }

  public getTermString(): string {
    const term = this.getResultTurn().getTerm();
    const termMax = this.getPreReqTurn() + 1;
    return `새로운 적성을 찾는 중... (${term}/${termMax})`;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }


    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');

    const specialType = (this.constructor as typeof ResetBattleSkillCommand).specialType;
    const specageType = (this.constructor as typeof ResetBattleSkillCommand).specageType;
    const specialText = (this.constructor as typeof ResetBattleSkillCommand).specialText;

    const oldTypeKey = `prev_types_${specialType}`;
    const specialName = specialText;

    const env = this.env;

    const yearMonth = Util.joinYearMonth(env.year, env.month);
    let oldSpecialList = general.data.aux?.[oldTypeKey] ?? [];
    oldSpecialList.push(general.data[specialType]);

    const availableSpecialLength = GameConst.availableSpecialDomestic?.length || 0;
    const availableWarLength = GameConst.availableSpecialWar?.length || 0;
    
    if (specialType === 'special' && oldSpecialList.length === availableSpecialLength) {
      oldSpecialList = [general.data[specialType]];
    } else if (specialType === 'special2' && oldSpecialList.length === availableWarLength) {
      oldSpecialList = [general.data[specialType]];
    }
    
    if (!general.data.aux) {
      general.data.aux = {};
    }
    general.data.aux[oldTypeKey] = oldSpecialList;

    general.data[specialType] = 'None';
    general.data[specageType] = general.data.age + 1;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`새로운 ${specialName}를 가질 준비가 되었습니다. <1>${date}</>`);

    this.setResultTurn(new LastTurn(ResetBattleSkillCommand.getName(), this.arg));
    
    // 공통 후처리 (특기 초기화는 아이템 추첨 제외)
    await this.postRunHooks(rng, { skipItemLottery: true });
    
    await this.saveGeneral();

    return true;
  }
}
