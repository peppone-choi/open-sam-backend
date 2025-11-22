import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { JosaUtil } from '../../utils/JosaUtil';

/**
 * 등용 수락 커맨드
 * 
 * 다른 장수가 보낸 등용 제안을 수락하여 그 장수의 국가로 망명합니다.
 * 재야가 아닌 경우 배신 횟수만큼 명성/공헌이 감소합니다.
 */
export class AcceptRecruitCommand extends GeneralCommand {
  protected static actionName = '등용 수락';
  public static reqArg = true;

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

    if (!('destNationID' in this.arg)) {
      return false;
    }
    const destNationID = this.arg.destNationID;
    if (typeof destNationID !== 'number') {
      return false;
    }
    if (destNationID <= 0) {
      return false;
    }
    if (destNationID === this.generalObj.getNationID()) {
      return false;
    }

    this.arg = {
      destGeneralID,
      destNationID,
    };
    return true;
  }

  protected init(): void {
    this.setNation(['gennum', 'scout']);

    this.permissionConstraints = [
      ConstraintHelper.AlwaysFail('예약 불가능 커맨드')
    ];
  }

  protected initWithArg(): void {
    const relYear = this.env.year - this.env.startyear;

    // destNation 먼저 설정
    this.setDestNation(this.arg.destNationID);

    // fullConditionConstraints 설정 (PHP와 동일)
    this.fullConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.AllowJoinDestNation(relYear),
      ConstraintHelper.ReqDestNationValue('level', '>', 0, '방랑군에는 임관할 수 없습니다.'),
      ConstraintHelper.DifferentDestNation(),
      ConstraintHelper.ReqGeneralValue('officer_level', '직위', '!=', 12, '군주는 등용장을 수락할 수 없습니다'),
    ];
    
    // destGeneral, destNation은 run() 메서드에서 로드됨
  }

  public canDisplay(): boolean {
    return false;
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

    const env = this.env;

    const general = this.generalObj;
    const generalID = general.getID();
    const generalName = general.data.name || general.name;
    const cityID = general.data.city;
    const nationID = general.getNationID();

    const destGeneral = this.destGeneralObj;
    
    if (!this.destNation) {
      throw new Error('목적 국가 정보가 없습니다');
    }
    
    const destNationID = this.destNation.nation;
    const destNationName = this.destNation.name;

    const isTroopLeader = generalID === general.data.troop;

    destGeneral.addExperience(100);
    destGeneral.addDedication(100);

    // 원래 국가의 장수 수 감소
    await nationRepository.updateOneByFilter(
      {
        session_id: general.getSessionID(),
        nation: nationID
      },
      {
        $inc: { gennum: -1 }
      }
    );

    // 스카웃 국가의 장수 수 증가
    await nationRepository.updateOneByFilter(
      {
        session_id: general.getSessionID(),
        nation: destGeneral.getNationID()
      },
      {
        $inc: { gennum: 1 }
      }
    );

    if (nationID !== 0) {
      const defaultGold = 1000; // GameConst::$defaultGold
      const defaultRice = 1000; // GameConst::$defaultRice

      if (general.data.gold > defaultGold) {
        const goldDiff = general.data.gold - defaultGold;
        await nationRepository.updateOneByFilter(
          {
            session_id: general.getSessionID(),
            nation: nationID
          },
          {
            $inc: { gold: goldDiff }
          }
        );
        general.data.gold = defaultGold;
      }

      if (general.data.rice > defaultRice) {
        const riceDiff = general.data.rice - defaultRice;
        await nationRepository.updateOneByFilter(
          {
            session_id: general.getSessionID(),
            nation: nationID
          },
          {
            $inc: { rice: riceDiff }
          }
        );
        general.data.rice = defaultRice;
      }

      // 배신 횟수만큼 명성/공헌 감소 (N*10%)
      const betrayCount = general.data.betray ?? 0;
      general.data.experience = (general.data.experience ?? 0) * (1 - 0.1 * betrayCount);
      general.addExperience(0, false);
      general.data.dedication = (general.data.dedication ?? 0) * (1 - 0.1 * betrayCount);
      general.addDedication(0, false);
      general.increaseVarWithLimit('betray', 1, null, 5); // GameConst::$maxBetrayCnt
    } else {
      general.addExperience(100);
      general.addDedication(100);
    }

    if (general.data.npc ?? general.npc ?? 0 < 2) {
      general.data.killturn = env.killturn;
    }

    const logger = general.getLogger();
    const destLogger = destGeneral.getLogger();

    const josaRo = JosaUtil.pick(destNationName, '로');
    logger.pushGeneralActionLog(`<D>${destNationName}</>${josaRo} 망명하여 수도로 이동합니다.`);
    destLogger.pushGeneralActionLog(`<Y>${generalName}</> 등용에 성공했습니다.`);

    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>로 망명`);
    destLogger.pushGeneralHistoryLog(`<Y>${generalName}</> 등용에 성공`);

    const josaYi = JosaUtil.pick(generalName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【망명】</b></><Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>${josaRo} 망명했습니다.`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>${josaRo} <S>망명</>하였습니다.`);

    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        // TODO: general.increaseInheritancePoint('active_action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }

    if (general.data.npc ?? general.npc ?? 0 < 2) {
      const belongCount = general.data.belong || 0;
      general.data.max_belong = Math.max(belongCount, general.data.max_belong || 0);
    }

    general.data.permission = 'normal';
    general.data.belong = 1;
    general.data.officer_level = 1;
    general.data.officer_city = 0;
    general.data.nation = destNationID;
    const recruitCityId = this.destNation?.capital ?? 0;
    await this.updateGeneralCity(recruitCityId);
    general.data.troop = 0;

    if (isTroopLeader) {
      // 부대원들의 부대 해제
      const sessionId = general.getSessionID();
      await generalRepository.updateManyByFilter(
        { session_id: sessionId, 'data.troop': generalID },
        { 'data.troop': 0 }
      );
      
      // 부대 삭제는 troopRepository가 있다면 사용
      try {
        const { troopRepository } = await import('../../repositories/troop.repository');
        await troopRepository.deleteByFilter({
          session_id: sessionId,
          troop_leader: generalID
        });
      } catch (error) {
        console.error('부대 삭제 실패:', error);
      }
    }

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, destGeneral, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    this.setResultTurn(new LastTurn(AcceptRecruitCommand.getName(), this.arg));
    await this.saveGeneral();
    await destGeneral.save();

    return true;
  }
}
