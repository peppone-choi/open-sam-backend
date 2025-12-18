import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';

import { JosaUtil } from '../../utils/JosaUtil';
import { generalRepository } from '../../repositories/general.repository';
import { General } from '../../models/general.model';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { Util } from '../../utils/Util';

/**
 * 등용 커맨드
 * PHP: sammo/Command/General/che_등용.php
 * 
 * 다른 장수에게 등용 권유 서신(ScoutMessage)을 보냅니다.
 * 대상 장수가 수락하면 che_등용수락(AcceptRecruitCommand)이 실행되어 국가 이동이 처리됩니다.
 * 
 * 주의: PHP와 동일하게 즉시 등용이 아니라 메시지만 보내는 방식입니다.
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
   * PHP: sammo/Command/General/che_등용.php의 run() 메서드와 동일
   * 
   * 스카우트 메시지를 대상 장수에게 발송합니다.
   * 대상 장수가 수락하면 AcceptRecruitCommand가 실행되어 국가 이동이 처리됩니다.
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

    // PHP: ScoutMessage::buildScoutMessage() 호출 후 전송
    // 스카우트 메시지 빌드 및 전송
    const scoutResult = await this.buildAndSendScoutMessage(
      general.getID(),
      destGeneralID,
      date
    );

    if (scoutResult.success) {
      // PHP: $logger->pushGeneralActionLog("<Y>{$destGeneralName}</>에게 등용 권유 서신을 보냈습니다. <1>$date</>");
      logger.pushGeneralActionLog(`<Y>${destGeneralName}</>에게 등용 권유 서신을 보냈습니다. <1>${date}</>`);
    } else {
      // PHP: $logger->pushGeneralActionLog("<Y>{$destGeneralName}</>에게 등용 권유 서신을 보내지 못했습니다. {$reason} <1>$date</>");
      logger.pushGeneralActionLog(`<Y>${destGeneralName}</>에게 등용 권유 서신을 보내지 못했습니다. ${scoutResult.reason} <1>${date}</>`);
    }

    // PHP와 동일: 경험치/공헌 증가
    const exp = 100;
    const ded = 200;

    const [reqGold, reqRice] = this.getCost();

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);
    general.increaseVarWithLimit('gold', -reqGold, 0);

    this.setResultTurn(new LastTurn(RecruitCommand.getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);

    await this.saveGeneral();

    return true;
  }

  /**
   * 스카우트 메시지 빌드 및 전송
   * PHP: ScoutMessage::buildScoutMessage() + $msg->send(true) 구현
   */
  private async buildAndSendScoutMessage(
    srcGeneralID: number,
    destGeneralID: number,
    date: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (srcGeneralID === destGeneralID) {
      return { success: false, reason: '같은 장수에게 등용장을 보낼 수 없습니다' };
    }

    const general = this.generalObj;
    const destGeneral = this.destGeneralObj;

    if (!destGeneral) {
      return { success: false, reason: '대상 장수를 찾을 수 없습니다' };
    }

    // PHP: 군주에게 등용장을 보낼 수 없습니다
    if (destGeneral.data.officer_level === 12) {
      return { success: false, reason: '군주에게 등용장을 보낼 수 없습니다' };
    }

    // PHP: 재야 상태일 때에는 등용장을 보낼 수 없습니다
    if (!general.getNationID()) {
      return { success: false, reason: '재야 상태일 때에는 등용장을 보낼 수 없습니다' };
    }

    // PHP: 같은 소속의 장수에게 등용장을 보낼 수 없습니다
    if (general.getNationID() === destGeneral.getNationID()) {
      return { success: false, reason: '같은 소속의 장수에게 등용장을 보낼 수 없습니다' };
    }

    const nationName = this.nation?.name || '';
    const josaRo = JosaUtil.pick(nationName, '로');
    const msgText = `${nationName}${josaRo} 망명 권유 서신`;

    try {
      const { messageRepository } = await import('../../repositories/message.repository');
      await messageRepository.create({
        session_id: general.getSessionID(),
        type: 'private',
        mailbox: destGeneralID,
        from_general: srcGeneralID,
        from_name: general.getName(),
        from_nation: general.getNationID(),
        from_nation_name: nationName,
        from_nation_color: this.nation?.color || '',
        to_general: destGeneralID,
        to_name: destGeneral.getName(),
        to_nation: destGeneral.getNationID(),
        to_nation_name: destGeneral.getNation()?.name || '',
        to_nation_color: destGeneral.getNation()?.color || '',
        message: msgText,
        option: {
          action: 'scout',
          srcNationID: general.getNationID(),
          destNationID: destGeneral.getNationID()
        },
        time: new Date(date),
        valid_until: new Date('9999-12-31'),
        created_at: new Date()
      });
      
      return { success: true };
    } catch (error) {
      console.error('스카우트 메시지 발송 실패:', error);
      return { success: false, reason: '메시지 전송 오류' };
    }
  }

  /**
   * 커맨드 선택 시 필요한 데이터 export
   * PHP: exportJSVars()와 동일
   */
  public async exportJSVars(): Promise<any> {
    const sessionId = this.env.session_id || 'default';
    
    // PHP: $destRawGenerals = $db->queryAllLists('SELECT no,name,nation,officer_level,npc,leadership,strength,intel 
    //      FROM general WHERE npc < 2 AND officer_level != 12 AND no != %i ORDER BY npc,binary(name)', $this->generalObj->getID());
    const destGenerals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.npc': { $lt: 2 },
      'data.officer_level': { $ne: 12 },
      'data.no': { $ne: this.generalObj.getID() }
    });

    const destRawGenerals = destGenerals.map(g => [
      g.data?.no || 0,
      g.data?.name || '',
      g.data?.nation || 0,
      g.data?.officer_level || 0,
      g.data?.npc || 0,
      g.data?.leadership || 0,
      g.data?.strength || 0,
      g.data?.intel || 0
    ]);

    // 국가 목록
    const { nationRepository } = await import('../../repositories/nation.repository');
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    
    const nationList = [
      { id: 0, name: '재야', color: '#808080', power: 0 },
      ...nations.map(n => ({
        id: n.nation || 0,
        name: n.name || '',
        color: n.color || '',
        power: n.data?.power || 0
      }))
    ];

    return {
      procRes: {
        nationList,
        generals: destRawGenerals,
        generalsKey: ['no', 'name', 'nationID', 'officerLevel', 'npc', 'leadership', 'strength', 'intel']
      }
    };
  }
}
