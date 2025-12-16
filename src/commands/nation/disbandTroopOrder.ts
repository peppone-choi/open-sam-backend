// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { generalRepository } from '../../repositories/general.repository';
import { troopRepository } from '../../repositories/troop.repository';
import { NationCommand } from '../base/NationCommand';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { General } from '../../models/General';
import { Util } from '../../utils/Util';

export class che_부대탈퇴지시 extends NationCommand {
  static getName(): string {
    return '부대 탈퇴 지시';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destGeneralID' in this.arg)) return false;

    const destGeneralID = this.arg['destGeneralID'];
    if (typeof destGeneralID !== 'number') return false;
    if (destGeneralID <= 0) return false;

    this.arg = { destGeneralID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.BeChief()
    ];
  }

  public getBrief(): string {
    const commandName = che_부대탈퇴지시.getName();
    const destGeneralName = this.destGeneralObj?.getName();
    return `【${destGeneralName}】${commandName}`;
  }

  protected async initWithArg(): Promise<void> {
    const destGeneral = await generalRepository.findById(this.arg['destGeneralID']);
    
    this.setDestGeneral(destGeneral);

    if (this.arg['destGeneralID'] === this.getGeneral()?.getID()) {
      this.fullConditionConstraints = [ConstraintHelper.AlwaysFail('본인입니다')];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.FriendlyDestGeneral()
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
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalName = general!.getName();

    const destGeneral = this.destGeneralObj;
    const destGeneralName = destGeneral!.getName();
    const logger = this.getLogger();

    const troopID = destGeneral!.data.troop ?? 0;
    if (troopID === 0) {
      const josaUn = JosaUtil.pick(destGeneralName, '은');
      logger.pushGeneralActionLog(`<Y>${destGeneralName}</>${josaUn} 부대원이 아닙니다.`);
      this.setResultTurn(new LastTurn(che_부대탈퇴지시.getName(), this.arg));
      return true;
    }

    if (troopID === destGeneral!.getID()) {
      const josaUn = JosaUtil.pick(destGeneralName, '은');
      logger.pushGeneralActionLog(`<Y>${destGeneralName}</>${josaUn} 부대장입니다.`);
      this.setResultTurn(new LastTurn(che_부대탈퇴지시.getName(), this.arg));
      return true;
    }

    destGeneral!.data.troop = 0;

    logger.pushGeneralActionLog(`<Y>${destGeneralName}</>에게 부대 탈퇴를 지시했습니다.`);
    destGeneral!.getLogger().pushGeneralActionLog(`<Y>${generalName}</>에게 부대 탈퇴를 지시 받았습니다.`);

    logger.pushNationalHistoryLog(`<Y>${destGeneralName}</>에게 부대 탈퇴 지시`);

    this.setResultTurn(new LastTurn(che_부대탈퇴지시.getName(), this.arg));
    await this.saveGeneral();
    await destGeneral!.applyDB(db);

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const nationID = this.getNationID();
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    // MongoDB로 부대 조회
    const troops = await troopRepository.findByNation(sessionId, nationID);
    const troopsDict = Util.convertArrayToDict(troops, 'troop_leader');
    
    // MongoDB로 장수 조회
    const generals = await generalRepository.findByNation(sessionId, nationID);
    const destRawGenerals = generals.map((g: any) => [
      g.no ?? g.data?.no, g.name ?? g.data?.name, g.officer_level ?? g.data?.officer_level ?? 0,
      g.npc ?? g.data?.npc ?? 0, g.gold ?? g.data?.gold ?? 0, g.rice ?? g.data?.rice ?? 0,
      g.leadership ?? g.data?.leadership ?? 0, g.strength ?? g.data?.strength ?? 0,
      g.intel ?? g.data?.intel ?? 0, g.city ?? g.data?.city ?? 0, g.crew ?? g.data?.crew ?? 0,
      g.train ?? g.data?.train ?? 0, g.atmos ?? g.data?.atmos ?? 0, g.troop ?? g.data?.troop ?? 0,
    ]);

    return {
      procRes: {
        troops: troopsDict,
        generals: destRawGenerals,
        generalsKey: [
          'no',
          'name',
          'officerLevel',
          'npc',
          'gold',
          'rice',
          'leadership',
          'strength',
          'intel',
          'cityID',
          'crew',
          'train',
          'atmos',
          'troopID'
        ],
        cities: await global.JSOptionsForCities()
      }
    };
  }
}
