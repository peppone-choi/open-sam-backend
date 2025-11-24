import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import { refreshNationStaticInfo, getNationStaticInfo } from '../../utils/nation-utils';
import { Nation } from '../../models/nation.model';
import { General } from '../../models/general.model';
import { JosaUtil } from '../../utils/JosaUtil';
import { generalRepository } from '../../repositories/general.repository';
import type { RandUtil } from '../../utils/rand-util';
import { InheritanceKey } from '../../types/Enums';

/**
 * 장수를 따라 임관 커맨드
 * PHP: sammo/Command/General/che_장수대상임관.php
 * 
 * 재야 장수가 특정 장수를 따라 그 장수의 국가에 임관합니다.
 */
export class AppointGeneralCommand extends GeneralCommand {
  protected static actionName = '장수를 따라 임관';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destGeneralID = this.arg.destGeneralID ?? null;

    if (destGeneralID === null) {
      return false;
    }

    if (typeof destGeneralID !== 'number') {
      return false;
    }

    if (destGeneralID < 1) {
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

  protected async init(): Promise<void> {
    await this.setCity();
    await this.setNation();

    const relYear = this.env.year - this.env.startyear;

    this.permissionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다')
    ];

    this.minConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.AllowJoinAction()
    ];
  }

  public getCommandDetailTitle(): string {
    return '장수를 따라 임관';
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  protected async initWithArg(): Promise<void> {
    const destGeneralID = this.arg.destGeneralID;
    const destGeneral = await General.createObjFromDB(destGeneralID, this.env.session_id);
    
    if (destGeneral) {
      this.setDestGeneral(destGeneral);
      const destNationID = this.destGeneralObj?.getVar('nation') as number;
      await this.setDestNation(destNationID, ['gennum', 'scout']);
    }

    const relYear = this.env.year - this.env.startyear;
    
    this.fullConditionConstraints = [
      ConstraintHelper.ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다'),
      ConstraintHelper.BeNeutral(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.AllowJoinDestNation(relYear),
      ConstraintHelper.AllowJoinAction()
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
    const destGeneralName = this.destGeneralObj?.getName() || '알 수 없음';
    const josaUl = JosaUtil.pick(destGeneralName, '을');
    return `【${destGeneralName}】${josaUl} 따라 임관`;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!await this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const generalName = general.getName();

    const destNation = this.destNation;
    const gennum = destNation?.gennum || 0;
    const destNationID = destNation?.nation || 0;
    const destNationName = destNation?.name || '알 수 없음';

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    let exp = 100;
    if (gennum < GameConst.initialNationGenLimit) {
      exp = 700;
    }

    // 장수 정보 업데이트
    general.setVar('nation', destNationID);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.setVar('belong', 1);

    // 도시 설정
    if (this.destGeneralObj !== null) {
      general.setVar('city', this.destGeneralObj.getCityID());
    } else {
      // 군주(officer_level=12)의 도시로 이동
      const leaderGeneral = await General.findOne({
        session_id: this.env.session_id,
        nation: destNationID,
        'data.officer_level': 12
      });
      const targetCityID = leaderGeneral?.data?.city || 0;
      general.setVar('city', targetCityID);
    }

    // 국가 장수 수 증가
    await (Nation as any).updateOne(
      { session_id: this.env.session_id, nation: destNationID },
      { $inc: { gennum: 1 } }
    );
    
    await refreshNationStaticInfo(this.env.session_id || 'default', destNationID);

    general.increaseInheritancePoint(InheritanceKey.active_action, 1);
    general.addExperience(exp);
    this.setResultTurn(new LastTurn(AppointGeneralCommand.getName(), this.arg));
    general.checkStatChange();

    // 유니크 아이템 추첨
    await tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, AppointGeneralCommand.actionName),
      general,
      this.env.session_id || 'default'
    );

    await general.applyDB();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    // 모든 국가 목록 조회
    const rawNationList = await (Nation as any).find(
      { session_id: this.env.session_id },
      { nation: 1, name: 1, color: 1, 'data.power': 1 }
    );

    const nationList = [];
    for (const destNation of rawNationList) {
      nationList.push({
        id: destNation.nation,
        name: destNation.name,
        color: destNation.color,
        power: destNation.data?.power || 0,
        scoutMsg: ' ',
      });
    }

    // 모든 장수 목록 조회 (자신 제외)
    const generals = await generalRepository.findBySession(this.env.session_id);

    const generalsData = generals
      .filter(g => g.data?.no !== this.generalObj.getID())
      .map(g => ({
        no: g.data?.no || 0,
        name: g.data?.name || '',
        nationID: g.data?.nation || 0,
        officerLevel: g.data?.officer_level || 0,
        npc: g.data?.npc || 0,
        leadership: g.data?.leadership || 0,
        strength: g.data?.strength || 0,
        intel: g.data?.intel || 0,
      }));

    return {
      procRes: {
        nationList,
        generals: generalsData,
        generalsKey: ['no', 'name', 'nationID', 'officerLevel', 'npc', 'leadership', 'strength', 'intel']
      },
    };
  }
}
