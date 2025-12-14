import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { JosaUtil } from '../../utils/JosaUtil';
import { generalRepository } from '../../repositories/general.repository';
import { General } from '../../models/general.model';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

/**
 * 등용 커맨드
 * 
 * 다른 장수를 등용합니다.
 * 대상 장수에게 등용 제안을 보내고, 수락하면 아군이 됩니다.
 */
export class RecruitCommand extends GeneralCommand {
  protected static actionName = '등용';
  public static reqArg = true;

  /**
   * 인자 검증: destGeneralID가 필요
   */
  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destGeneralID' in this.arg)) {
      return false;
    }
    const destGeneralID = this.arg.destGeneralID;
    if (typeof destGeneralID !== 'number') {
      return false;
    }
    if (destGeneralID <= 0) {
      return false;
    }
    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }
    this.arg = {
      destGeneralID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gennum', 'scout']);

    const relYear = this.env.year - this.env.startyear;

    // PHP와 일치
    this.permissionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
    ];

    this.minConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
    ];
  }

  /**
   * 인자와 함께 초기화
   */
  protected initWithArg(): void {
    const [reqGold, reqRice] = this.getCost();

    // PHP: fullConditionConstraints
    this.fullConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.DifferentNationDestGeneral(), // PHP: DifferentNationDestGeneral
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      // 추가: 군주 등용 금지는 initWithArg에서 destGeneralObj 로드 후 별도 처리
    ];
    
    // destGeneral은 run() 메서드에서 로드됨
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  public getCost(): [number, number] {
    const env = this.env;
    if (!this.isArgValid) {
      return [env.develcost, 0];
    }
    
    const destGeneral = this.destGeneralObj;
    if (!destGeneral) {
      return [env.develcost, 0];
    }
    
    const reqGold = Math.round(
      env.develcost +
      (destGeneral.data.experience + destGeneral.data.dedication) / 1000
    ) * 10;
    
    return [reqGold, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const destGeneralName = this.destGeneralObj?.getName() ?? '알 수 없음';
    const name = RecruitCommand.getName();
    const josaUl = JosaUtil.pick(destGeneralName, '을');
    return `【${destGeneralName}】${josaUl} ${name}`;
  }

  /**
   * 등용 실행
   * 
   * - 등용 메시지 발송
   * - 대상 장수의 승낙률 계산
   * - 성공 시 아군으로 영입
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const destGeneral = this.destGeneralObj;
    
    if (!destGeneral) {
      throw new Error('대상 장수 정보가 없습니다');
    }
    if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    
    const destGeneralName = destGeneral.getName();
    const destGeneralID = destGeneral.getID();

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);

    // 등용 성공률 계산 (통무지정매 시스템: 매력 기반)
    // 매력 + 국가 정탐력으로 등용력 계산
    const myCharm = general.getCharm(true, true, true, false);
    const destCharm = destGeneral.getCharm ? destGeneral.getCharm(true, true, true, false) : 50;
    const scoutPower = this.nation.scout * 3 + myCharm;
    const destScoutPower = (destGeneral.getNation()?.scout || 0) * 3 + destCharm;
    
    let recruitProb = 0.3; // 기본 30%
    
    if (scoutPower > destScoutPower * 2) {
      recruitProb = 0.7; // 70%
    } else if (scoutPower > destScoutPower) {
      recruitProb = 0.5; // 50%
    }
    
    // 매력 차이 보정 (매력이 20 이상 높으면 +10% 추가)
    if (myCharm - destCharm >= 20) {
      recruitProb = Math.min(0.9, recruitProb + 0.1);
    }

    const success = rng.nextBool(recruitProb);

    const [reqGold, reqRice] = this.getCost();

    // 비용 차감
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);

    if (success) {
      // 등용 성공
      logger.pushGeneralActionLog(`<Y><b>${destGeneralName}</b></>을(를) 등용하였습니다! <1>${date}</>`);
      logger.pushGeneralHistoryLog(`${destGeneralName} 등용 성공`);
      
      // 대상 장수를 아군으로
      const targetCityId = general.data.city;
      destGeneral.data.nation = general.getNationID();
      destGeneral.data.city = targetCityId;
      destGeneral.data.belongs = general.getNationID();
      
      await unitStackRepository.updateOwnerCity(general.getSessionID(), 'general', destGeneralID, targetCityId);
      await destGeneral.save();
    } else {
      // 등용 실패
      logger.pushGeneralActionLog(`<Y><b>${destGeneralName}</b></>이(가) 등용을 거절했습니다. <1>${date}</>`);
      logger.pushGeneralHistoryLog(`${destGeneralName} 등용 실패`);
      
      try {
        const { messageRepository } = await import('../../repositories/message.repository');
        await messageRepository.create({
          session_id: general.getSessionID(),
          type: 'scout',
          from_general: general.getID(),
          to_general: destGeneralID,
          nation: general.getNationID(),
          message: `${general.data.name || general.name}이(가) 등용을 제안했습니다.`,
          created_at: new Date()
        });
      } catch (error) {
        console.error('스카우트 메시지 발송 실패:', error);
      }
    }

    // 경험치 증가
    const exp = 50;
    general.addExperience(exp);
    // 통무지정매 시스템: 등용은 매력 경험치 획득
    general.increaseVar('charm_exp', 1);

    this.setResultTurn(new LastTurn(RecruitCommand.getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);

    await this.saveGeneral();

    return true;
  }
}
