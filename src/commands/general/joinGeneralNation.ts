import { GeneralCommand } from '../base/GeneralCommand';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { LastTurn } from '../base/BaseCommand';

import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * 장수대상임관 커맨드
 * PHP che_장수대상임관과 동일한 구조
 */
export class JoinGeneralNationCommand extends GeneralCommand {
  protected static actionName = '장수를 따라 임관';
  public static reqArg = true;

  protected destGeneral: any = null;
  protected destNation: any = null;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destGeneralID = this.arg['destGeneralID'];
    if (destGeneralID === null || destGeneralID === undefined) {
      return false;
    }

    if (!Number.isInteger(destGeneralID)) {
      return false;
    }

    if (destGeneralID < 1) {
      return false;
    }

    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }

    this.arg = {
      destGeneralID: destGeneralID
    };

    return true;
  }

  protected init(): void {
    const general = this.generalObj;
    const env = this.env;

    this.setCity();
    this.setNation();

    const relYear = env['year'] - env['startyear'];

    this.permissionConstraints = [
      // ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다')
    ];

    this.minConditionConstraints = [
      // ConstraintHelper.BeNeutral(),
      // ConstraintHelper.AllowJoinAction()
    ];
  }

  protected initWithArg(): void {
    const relYear = this.env['year'] - this.env['startyear'];

    // fullConditionConstraints를 먼저 설정
    this.fullConditionConstraints = [
      // ConstraintHelper.BeNeutral(),
      // ConstraintHelper.ExistsDestGeneral(),
      // ConstraintHelper.FriendlyDestGeneral(),
      // ConstraintHelper.AllowJoinDestNation(relYear),
      // ConstraintHelper.AllowJoinAction()
    ];
    
    // destGeneral, destNation은 run() 메서드에서 로드됨
  }

  public getCommandDetailTitle(): string {
    return '장수를 따라 임관';
  }

  public canDisplay(): boolean {
    return this.env['join_mode'] !== 'onlyRandom';
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
    if (!this.destGeneral) {
      return '장수를 따라 임관';
    }

    const destGeneralName = this.destGeneral.data?.name || '무명';
    const josaUl = JosaUtil.pick(destGeneralName, '을');
    return `【${destGeneralName}】${josaUl} 따라 임관`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const env = this.env;
    const sessionId = env['session_id'] || 'sangokushi_default';

    const general = this.generalObj;
    const date = general.getTurnTime();
    const generalName = general.data.name || general.name;
    const josaYi = JosaUtil.pick(generalName, '이');

    const destNation = this.destNation;
    if (!destNation) {
      throw new Error('대상 국가를 찾을 수 없습니다');
    }

    const gennum = destNation.gennum || 0;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    const initialGenLimit = GameConst.initialNationGenLimit || 10;
    let exp = 100;
    if (gennum < initialGenLimit) {
      exp = 700;
    }

    general.data.nation = destNationID;
    general.data.officer_level = 1;
    general.data.officer_city = 0;
    general.data.belong = 1;
    
    let targetCityID: number;
    if (this.destGeneral) {
      targetCityID = this.destGeneral.data?.city || this.destGeneral.data?.location || 0;
    } else {
      const lordGeneral = await generalRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': destNationID,
        'data.officer_level': 12
      });
      targetCityID = lordGeneral?.data?.city || this.destNation?.capital || 1;
    }
    await this.updateGeneralCity(targetCityID);

    const nationRepoAny = nationRepository as any;
    if (typeof nationRepoAny?.incrementValue === 'function') {
      await nationRepoAny.incrementValue(sessionId, destNationID, 'gennum', 1);
    }

    try {
      const { refreshNationStaticInfo } = await import('../../func/refreshNationStaticInfo');
      await refreshNationStaticInfo();
    } catch (error) {
      console.error('refreshNationStaticInfo 실패:', error);
    }

    try {
      const { InheritancePointService, InheritanceKey } = await import('../../services/inheritance/InheritancePoint.service');
      const inheritanceService = new InheritancePointService(sessionId);
      const userId = general.data.owner ?? general.data.user_id ?? general.getID();
      await inheritanceService.recordActivity(userId, InheritanceKey.ACTIVE_ACTION, 1);
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }

    general.addExperience(exp);
    this.setResultTurn(new LastTurn(JoinGeneralNationCommand.getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (임관은 유산 포인트가 위에서 이미 처리됨)
    await this.postRunHooks(rng, { skipInheritancePoint: true });

    await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<Record<string, any>> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    const currentGeneralID = this.generalObj.getID();
    
    const generals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.no': { $ne: currentGeneralID },
      'data.officer_level': 12
    });
    
    const generalList = generals.map(g => ({
      no: g.data?.no,
      name: g.data?.name,
      nationID: g.data?.nation,
      officerLevel: g.data?.officer_level,
      npc: g.data?.npc,
      leadership: g.data?.leadership,
      strength: g.data?.strength,
      intel: g.data?.intel
    }));
    
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    const nationList = nations.map(n => ({
      nation: n.nation || n.data?.nation,
      name: n.name || n.data?.name
    }));
    
    return {
      procRes: {
        nationList,
        generals: generalList,
        generalsKey: ['no', 'name', 'nationID', 'officerLevel', 'npc', 'leadership', 'strength', 'intel']
      }
    };
  }
}

