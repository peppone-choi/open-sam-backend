import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { RaiseArmyCommandService } from '../../services/command/RaiseArmyCommand.service';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 거병 커맨드
 * 
 * 재야 장수가 새로운 세력을 만듭니다.
 */
export class RaiseArmyCommand extends GeneralCommand {
  protected static actionName = '거병';
  public static reqArg = false;

  protected argTest(): boolean {
    this.arg = [];
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const env = this.env;
    const relYear = env.year - env.startyear;

    this.fullConditionConstraints = [
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.BeOpeningPart(relYear + 1),
      ConstraintHelper.AllowJoinAction(),
      ConstraintHelper.NoPenalty('NoFoundNation'),
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

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const sessionId = general.session_id;

    // 서비스 레이어를 통해 거병 실행
    await RaiseArmyCommandService.execute(general, sessionId);

    // 결과 턴 설정
    this.setResultTurn(new LastTurn(RaiseArmyCommand.getName(), this.arg));

    // 로그 (서비스에서 처리 또는 여기서 처리)
    const logger = general.getLogger();
    const cityName = this.city.name;
    const generalName = general.name;
    
    logger.pushGeneralActionLog(`거병에 성공하였습니다.`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이(가) <G><b>${cityName}</b></>에 거병하였습니다.`);
    logger.pushGlobalHistoryLog(`<Y><b>【거병】</b></><D><b>${generalName}</b></>이(가) 세력을 결성하였습니다.`);
    logger.pushGeneralHistoryLog(`<G><b>${cityName}</b></>에서 거병`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>이(가) <G><b>${cityName}</b></>에서 거병`);

    // tryUniqueItemLottery
    const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
    await tryUniqueItemLottery(
      general.genGenericUniqueRNG(RaiseArmyCommand.actionName),
      general,
      sessionId
    );

    return true;
  }
}
