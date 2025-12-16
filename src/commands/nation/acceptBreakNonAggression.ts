// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { generalRepository } from '../../repositories/general.repository';
import { NationCommand } from '../base/NationCommand';

import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { General } from '../../models/General';
import { DiplomacyStateService, DiplomacyState } from '../../services/diplomacy/DiplomacyState.service';

export class che_불가침파기수락 extends NationCommand {
  static getName(): string {
    return '불가침 파기 수락';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destNationID' in this.arg)) return false;
    const destNationID = this.arg['destNationID'];
    if (typeof destNationID !== 'number') return false;
    if (destNationID < 1) return false;

    if (!('destGeneralID' in this.arg)) return false;
    const destGeneralID = this.arg['destGeneralID'];
    if (typeof destGeneralID !== 'number') return false;
    if (destGeneralID <= 0) return false;
    if (destGeneralID === this.generalObj?.getID()) return false;

    this.arg = { destNationID, destGeneralID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.permissionConstraints = [
      ConstraintHelper.AlwaysFail('예약 불가능 커맨드')
    ];
  }

  protected async initWithArg(): Promise<void> {
    const destGeneral = await generalRepository.findById(this.arg['destGeneralID']);
    
    this.setDestGeneral(destGeneral);
    this.setDestNation(this.arg['destNationID']);

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.ReqDestNationValue('nation', '소속', '==', this.destGeneralObj!.getNationID()),
      ConstraintHelper.AllowDiplomacyBetweenStatus([7], '불가침 중인 상대국에게만 가능합니다.'),
    ];
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

  public getBrief(): string {
    const getNationStaticInfo = global.getNationStaticInfo;
    const destNationName = getNationStaticInfo(this.arg['destNationID'])['name'];
    return `${destNationName}국과 불가침 파기 합의`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }


    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalName = general!.getName();

        if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

        if (!this.destNation) {
      throw new Error('대상 국가 정보가 없습니다');
    }
    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];

    const logger = general!.getLogger();
    const destLogger = this.destGeneralObj!.getLogger();

    // 서비스를 통해 외교 상태 업데이트
    const sessionId = this.env['session_id'] || 'sangokushi_default';
    await DiplomacyStateService.updateBilateralState(
      sessionId,
      nationID,
      destNationID,
      DiplomacyState.PEACE,
      0
    );

    const josaYiGeneral = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    let josaWa = JosaUtil.pick(destNationName, '와');
    logger.pushGeneralActionLog(`<D><b>${destNationName}</b></>${josaWa}의 불가침을 파기했습니다.`, ActionLogger.PLAIN);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>${josaWa}의 불가침 파기 수락`);

    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYiGeneral} <D><b>${destNationName}</b></>${josaWa}의 불가침 조약을 <M>파기</> 하였습니다.`);
    logger.pushGlobalHistoryLog(`<Y><b>【파기】</b></><D><b>${nationName}</b></>${josaYiNation} <D><b>${destNationName}</b></>${josaWa}의 불가침 조약을 <M>파기</> 하였습니다.`);

    logger.pushNationalHistoryLog(`<D><b>${destNationName}</b></>${josaWa}의 불가침 파기`);

    josaWa = JosaUtil.pick(nationName, '와');
    destLogger.pushGeneralActionLog(`<D><b>${nationName}</b></>${josaWa}의 불가침 파기에 성공했습니다.`, ActionLogger.PLAIN);
    destLogger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaWa}의 불가침 파기 성공`);

    // PHP: StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, this.destGeneralObj, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    await this.saveGeneral();
    await destLogger.flush();

    return true;
  }
}
