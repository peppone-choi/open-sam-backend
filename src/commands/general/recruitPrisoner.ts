/**
 * recruitPrisoner.ts - 포로 등용 커맨드
 *
 * 자국의 포로를 등용 시도합니다.
 * 성공률은 등용자의 매력과 포로의 충성도에 영향을 받습니다.
 */

import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { PrisonerService } from '../../services/general/Prisoner.service';
import { generalRepository } from '../../repositories/general.repository';
import { JosaUtil } from '../../utils/JosaUtil';

export class RecruitPrisonerCommand extends GeneralCommand {
  protected static actionName = '포로 등용';
  public static reqArg = true;

  /**
   * 인자 검증: destGeneralID (포로 장수 ID) 필요
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
      destGeneralID,
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gennum']);

    // 기본 권한 제약조건
    this.permissionConstraints = [
      ConstraintHelper.NotBeNeutral(),
    ];

    // 최소 조건 - 소속 국가가 있어야 함
    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
    ];
  }

  protected async initWithArg(): Promise<void> {
    const sessionId = this.generalObj.getSessionID?.() ?? this.env.session_id;

    // 대상 포로 장수 조회
    const destGeneral = await generalRepository.findOneByFilter({
      session_id: sessionId,
      no: this.arg.destGeneralID,
    });

    if (destGeneral) {
      this.setDestGeneral(destGeneral);
    }

    // 전체 조건
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ExistsDestGeneral(),
      // 대상이 포로인지 확인
      ConstraintHelper.ReqDestGeneralValue(
        'prisoner_of',
        '포로 상태',
        '>',
        0,
        '대상이 포로가 아닙니다.'
      ),
      // 자국 포로인지 확인
      ConstraintHelper.SameNationDestGeneralPrisoner(),
    ];
  }

  public canDisplay(): boolean {
    return true;
  }

  public getCost(): [number, number] {
    // 등용 비용: 금 100
    return [100, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const destGeneralName = this.destGeneralObj?.getName() ?? '알 수 없음';
    const name = RecruitPrisonerCommand.getName();
    const josaUl = JosaUtil.pick(destGeneralName, '을');
    return `【${destGeneralName}】${josaUl} ${name}`;
  }

  /**
   * 포로 등용 실행
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const sessionId = general.getSessionID?.() ?? this.env.session_id;
    const generalId = general.getID();
    const prisonerId = this.arg.destGeneralID;

    const [reqGold] = this.getCost();

    // 비용 차감
    general.increaseVarWithLimit('gold', -reqGold, 0);

    // 포로 등용 시도
    const result = await PrisonerService.recruitPrisoner(
      sessionId,
      generalId,
      prisonerId,
      rng
    );

    // 경험치 증가
    const exp = result.success ? 100 : 50;
    general.addExperience(exp);

    // 유산 포인트
    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        await general.increaseInheritancePoint('action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }

    this.setResultTurn(new LastTurn(RecruitPrisonerCommand.getName(), this.arg));
    await general.checkStatChange();
    await this.saveGeneral();

    return result.success;
  }

  /**
   * 프론트엔드에 전달할 변수
   */
  public async exportJSVars(): Promise<any> {
    const sessionId = this.generalObj.getSessionID?.() ?? this.env.session_id;
    const nationId = this.generalObj.getNationID();

    // 자국의 포로 목록 조회
    const prisoners = await PrisonerService.getPrisonersByNation(
      sessionId,
      nationId
    );

    const prisonerList = prisoners.map((p) => ({
      no: p.no,
      name: p.getName(),
      leadership: p.getVar('leadership') ?? 0,
      strength: p.getVar('strength') ?? 0,
      intel: p.getVar('intel') ?? 0,
      loyalty: p.getVar('loyalty') ?? 70,
      capturedAt: p.getVar('captured_at'),
    }));

    return {
      procRes: {
        prisoners: prisonerList,
        prisonersKey: ['no', 'name', 'leadership', 'strength', 'intel', 'loyalty', 'capturedAt'],
      },
    };
  }
}











