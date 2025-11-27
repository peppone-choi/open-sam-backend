// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 임관 커맨드
 * 
 * 재야 장수가 특정 국가를 선택하여 임관합니다.
 */
export class JoinNationCommand extends GeneralCommand {
  protected static actionName = '임관';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destNationID = this.arg.destNationID;

    if (destNationID === null || destNationID === undefined) {
      return false;
    }

    if (typeof destNationID !== 'number') {
      return false;
    }
    if (destNationID < 1) {
      return false;
    }

    this.arg = {
      destNationID,
    };

    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const relYear = this.env.year - this.env.startyear;
    
    this.permissionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다')
    ];

    this.minConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.AllowJoinAction(),
      ConstraintHelper.NoPenalty('NoChosenAssignment'),
    ];
  }

  public getCommandDetailTitle(): string {
    return '지정한 국가로 임관';
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  protected initWithArg(): void {
    const relYear = this.env.year - this.env.startyear;

    // fullConditionConstraints - PHP와 일치
    this.fullConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.AllowJoinDestNation(relYear),
      ConstraintHelper.AllowJoinAction(),
      ConstraintHelper.NoPenalty('NoChosenAssignment'),
    ];
    
    // setDestNation은 비동기 작업이므로 나중에 처리
    const destNationID = this.arg.destNationID;
    this.setDestNation(destNationID, ['gennum', 'scout']);
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
    const commandName = JoinNationCommand.getName();
    const destNationName = this.destNation?.name || '국가명';
    return `【${destNationName}】로 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const env = this.env;

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const generalName = general.data.name || general.name;

    const destNation = this.destNation;
    const gennum = destNation.gennum;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    let exp: number;
    const initialNationGenLimit = 6; // GameConst::$initialNationGenLimit
    if (gennum < initialNationGenLimit) {
      exp = 700;
    } else {
      exp = 100;
    }

    general.data.nation = destNationID;
    general.data.officer_level = 1;
    general.data.officer_city = 0;
    general.data.belong = 1;
    general.data.troop = 0;

    console.log(`[JoinNation] 장수 #${general.getID()} ${general.data.name || general.name}: nation=${destNationID}, officer_level=1 설정완료`);

    let targetCityID: number;
    if (this.destGeneralObj !== null) {
      targetCityID = this.destGeneralObj.getCityID();
    } else {
      const { generalRepository } = await import('../../repositories/general.repository');
      const sessionId = env.session_id || 'sangokushi_default';
      
      const lordDoc = await generalRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': destNationID,
        'data.officer_level': 12
      });
      
      targetCityID = lordDoc?.data?.city || destNation.capital || 1;
    }
    await this.updateGeneralCity(targetCityID);

    const { nationRepository } = await import('../../repositories/nation.repository');
    const sessionId = env.session_id || 'sangokushi_default';
    
    await nationRepository.updateOneByFilter(
      { session_id: sessionId, 'data.nation': destNationID },
      { gennum: (destNation.gennum || 0) + 1 }
    );

    // refreshNationStaticInfo 호출
    try {
      const { refreshNationStaticInfo } = await import('../../func/refreshNationStaticInfo');
      await refreshNationStaticInfo(sessionId, destNationID);
    } catch (error: any) {
      console.error('refreshNationStaticInfo 실패:', error);
    }

    // InheritancePoint 처리
    try {
      // TODO: general.increaseInheritancePoint('active_action', 1);
    } catch (error: any) {
      console.error('InheritancePoint 실패:', error);
    }

    general.addExperience(exp);
    this.setResultTurn(new LastTurn(JoinNationCommand.getName(), this.arg));
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
      await tryUniqueItemLottery(rng, general, sessionId, '임관');
    } catch (error: any) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    console.log(`[JoinNation] 저장 전 데이터 확인:`, {
      no: general.getID(),
      name: general.data.name || general.name,
      nation: general.data.nation,
      officer_level: general.data.officer_level,
      city: general.data.city
    });

    await this.saveGeneral();

    console.log(`[JoinNation] 저장 완료`);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj.getNationID();
    const sessionId = this.env.session_id || 'sangokushi_default';

    // 국가 목록 쿼리
    const { nationRepository } = await import('../../repositories/nation.repository');
    const nationDocs = await nationRepository.findByFilter({
      session_id: sessionId,
      'data.level': { $gt: 0 }
    });

    const nationList = nationDocs.map((doc: any) => ({
      nation: doc.data.nation,
      name: doc.data.name,
      color: doc.data.color,
      level: doc.data.level,
      gennum: doc.data.gennum,
      capital: doc.data.capital
    }));

    return {
      procRes: {
        nationList,
        startYear: this.env.startyear,
      },
    };
  }
}
