// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

export class RandomFoundNationCommand extends GeneralCommand {
  protected static actionName = '무작위 도시 건국';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    const nationName = this.arg.nationName ?? null;
    const nationType = this.arg.nationType ?? null;
    const colorType = this.arg.colorType ?? null;

    if (nationName === null || nationType === null || colorType === null) {
      return false;
    }

    if (typeof nationName !== 'string' || typeof nationType !== 'string' || typeof colorType !== 'number') {
      return false;
    }

    if (nationName === '' || this.getStringWidth(nationName) > 18) {
      return false;
    }

    // GetNationColors validation - colorType은 숫자로 검증됨
    // buildNationTypeClass validation - nationType은 string으로 검증됨

    this.arg = {
      nationName,
      nationType,
      colorType
    };

    return true;
  }

  private getStringWidth(str: string): number {
    return Array.from(str).reduce((width, char) => {
      return width + (char.charCodeAt(0) > 127 ? 2 : 1);
    }, 0);
  }

  protected init(): void {
    this.setNation(['gennum', 'aux']);

    this.minConditionConstraints = [
      ConstraintHelper.ReqNationValue('level', '국가규모', '==', 0, '정식 국가가 아니어야합니다.')
    ];
  }

  protected initWithArg(): void {
    this.fullConditionConstraints = [
      ConstraintHelper.BeLord(),
      ConstraintHelper.WanderingNation(),
      ConstraintHelper.ReqNationValue('gennum', '수하 장수', '>=', 2),
      ConstraintHelper.CheckNationNameDuplicate(this.arg.nationName),
    ];
  }

  public getBrief(): string {
    const nationName = this.arg.nationName;
    const josaUl = JosaUtil.pick(nationName, '을');
    return `【${nationName}】${josaUl} 무작위 도시에 건국`;
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
    const date = general.getTurnTime('HM');
    const generalName = general.getName();
    const logger = general.getLogger();

    const { cityRepository } = await import('../../repositories/city.repository');
    const { generalRepository } = await import('../../repositories/general.repository');
    const sessionId = env.session_id || 'sangokushi_default';

    // 레벨 5 이상 도시만 건국 가능 (5: 이민족, 6~10: 일반 도시)
    const cityDocs = await cityRepository.findByFilter({
      session_id: sessionId,
      'data.level': { $gte: 5 },
      'data.nation': 0
    });

    const cities = cityDocs.map((doc: any) => doc.data.city);

    if (!cities || cities.length === 0) {
      logger.pushGeneralActionLog(`건국할 수 있는 도시가 없습니다. <1>${date}</>`);
      // Alternative command: 해산 권장
      return false;
    }

    const cityID = rng.choice(cities);
    if (general.getCityID() === cityID) {
      this.setCity();
    } else {
      this.generalObj.setVar('city', cityID);
      this.setCity();
      
      await generalRepository.updateManyByFilter(
        { session_id: sessionId, 'data.nation': general.getNationID() },
        { city: cityID }
      );
    }

    const josaYi = JosaUtil.pick(generalName, '이');

    const nationName = this.arg.nationName;
    const nationType = this.arg.nationType;
    const colorType = this.arg.colorType;

    const cityName = this.city?.name || '';

    const josaUl = JosaUtil.pick(nationName, '을');

    // === 공백지 호족과의 전투 ===
    const currentCityID = general.getCityID();
    const currentCity = await cityRepository.findOneByFilter({
      session_id: sessionId,
      city: currentCityID
    });

    const currentNationID = general.getNationID();

    // 공백지인 경우 (nation === 0) 호족과 전투
    // 이미 방랑군이 점령한 도시(nation === currentNationID)는 전투 스킵
    if (currentCity && currentCity.nation === 0) {
      const { ProcessWarService } = await import('../../services/war/ProcessWar.service');
      const { RandUtil } = await import('../../utils/RandUtil');
      const cityLevel = currentCity.level || 1;
      
      // 호족 세력 생성
      const localRng = new RandUtil(rng.seed);
      const localMilitia = (ProcessWarService as any).createLocalMilitia(currentCity, localRng);
      
      // 방어 세력 타입 결정
      let defenderType: string;
      if (cityLevel >= 7) {
        defenderType = '한 태수';
      } else if (cityLevel === 6) {
        defenderType = '한 현령';
      } else if (cityLevel === 5) {
        defenderType = '이민족';
      } else if (cityLevel === 4) {
        defenderType = '한 관문 수비대';
      } else if (cityLevel === 3) {
        defenderType = '한 진영 수비대';
      } else if (cityLevel === 2) {
        defenderType = '항구 호족';
      } else if (cityLevel === 1) {
        defenderType = '향촌 호족';
      } else {
        defenderType = '유민 무리';
      }
      
      // 이민족 도시의 경우 특별 메시지
      if (cityLevel === 5) {
        logger.pushGeneralActionLog(
          `<G><b>${cityName}</b></>의 ${defenderType} 세력과 전투를 시작합니다! [적 ${localMilitia.crew}명]`
        );
        logger.pushGlobalActionLog?.(
          `<Y>${generalName}</>${josaYi} 이민족 땅 <G><b>${cityName}</b></>를 정복하여 건국을 시도합니다!`
        );
      } else {
        logger.pushGeneralActionLog(
          `<G><b>${cityName}</b></>의 ${defenderType}과(와) 전투를 시작합니다! [적 ${localMilitia.crew}명]`
        );
        logger.pushGlobalActionLog?.(
          `<Y>${generalName}</>${josaYi} <G><b>${cityName}</b></>의 ${defenderType}과(와) 건국을 위한 전투를 시작합니다!`
        );
      }

      // 자동 전투 실행
      const battleResult = await (ProcessWarService as any).executeAutoBattle(
        sessionId,
        general,
        localMilitia,
        currentCity,
        rng
      );

      if (battleResult.winner === 'defender') {
        // 전투 패배 - 건국 실패
        logger.pushGeneralActionLog(
          `${defenderType}에게 패배했습니다! 건국에 실패했습니다. [손실: ${battleResult.attackerLoss}명] <1>${date}</>`
        );
        logger.pushGlobalActionLog?.(
          `<Y>${generalName}</>${josaYi} <G><b>${cityName}</b></>에서 건국을 시도했으나 ${defenderType}에게 패배했습니다!`
        );
        
        // 병력 손실만 반영
        general.setVar('crew', Math.max(0, general.getVar('crew') - battleResult.attackerLoss));
        await this.saveGeneral();
        
        return false;
      }

      // 전투 승리
      if (cityLevel === 5) {
        logger.pushGeneralActionLog(
          `${defenderType} 세력을 격파했습니다! [피해: ${battleResult.attackerLoss}명]`
        );
      } else {
        logger.pushGeneralActionLog(
          `${defenderType}을(를) 격파했습니다! [피해: ${battleResult.attackerLoss}명]`
        );
      }
      
      // 병력 손실 반영
      general.setVar('crew', Math.max(0, general.getVar('crew') - battleResult.attackerLoss));
      
      // 도시 점령은 건국 성공 후에 처리 (아래에서 cityRepository.updateOneByFilter)
    }

    // === 건국 진행 ===
    // 국가 타입 이름 가져오기
    const { getNationTypeName } = await import('../../core/nation-type/NationTypeFactory');
    const nationTypeName = getNationTypeName(nationType);

    logger.pushGeneralActionLog(`<D><b>${nationName}</b></>${josaUl} 건국하였습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <G><b>${cityName}</b></>에 국가를 건설하였습니다.`);

    const josaNationYi = JosaUtil.pick(nationName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【건국】</b></>${nationTypeName} <D><b>${nationName}</b></>${josaNationYi} 새로이 등장하였습니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>${josaUl} 건국`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <D><b>${nationName}</b></>${josaUl} 건국`);

    const exp = 1000;
    const ded = 1000;

    general.addExperience(exp);
    general.addDedication(ded);

    const aux = this.nation?.aux || {};
    aux.can_국기변경 = 1;
    aux.can_무작위수도이전 = 1;

    const { nationRepository } = await import('../../repositories/nation.repository');

    // 건국 진행 (원자적 처리 시도)
    try {
      // 1. 먼저 국가 승격 (방랑군 → 정식 국가)
      await nationRepository.updateOneByFilter(
        { session_id: sessionId, 'data.nation': general.getNationID() },
        {
          name: nationName,
          color: colorType,
          level: 1,
          type: nationType,
          capital: general.getCityID(),
          aux: aux
        }
      );

      // 2. 그 다음 도시 점령 (국가 수도로 설정)
      const cityUpdateResult = await cityRepository.updateOneByFilter(
        { session_id: sessionId, city: general.getCityID() },
        { nation: general.getNationID(), conflict: {} }
      );

      if (!cityUpdateResult) {
        throw new Error('도시 점령에 실패했습니다. 관리자에게 문의하세요.');
      }
    } catch (error: any) {
      console.error('[건국 실패] 국가 생성 중 오류 발생:', error);
      logger.pushGeneralActionLog(`건국 중 오류가 발생했습니다. 관리자에게 문의하세요. <1>${date}</>`);
      throw error;
    }

    // refreshNationStaticInfo 호출
    try {
      const { refreshNationStaticInfo } = await import('../../func/refreshNationStaticInfo');
      await refreshNationStaticInfo(sessionId, general.getNationID());
    } catch (error: any) {
      console.error('refreshNationStaticInfo 실패:', error);
    }

    // InheritancePoint 처리
    try {
      general.increaseInheritancePoint('active_action', 1);
    } catch (error: any) {
      console.error('InheritancePoint 실패:', error);
    }

    this.setResultTurn(new LastTurn(RandomFoundNationCommand.getName(), this.arg));
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
      await tryUniqueItemLottery(rng, general, sessionId, '무작위 도시 건국');
    } catch (error: any) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    // 전체 국가 수 조회
    const { nationRepository } = await import('../../repositories/nation.repository');
    const nationDocs = await nationRepository.findByFilter({
      session_id: sessionId,
      'data.level': { $gt: 0 }
    });
    
    const nationCount = nationDocs.length;
    const maxNation = this.env.maxnation || 30;
    
    // 사용 가능한 국가 타입
    const nationTypes = {};
    
    // 사용 가능한 색상 (기본 12색)
    const colors = Array.from({ length: 12 }, (_, i) => i);

    return {
      procRes: {
        available건국: nationCount < maxNation,
        nationTypes,
        colors,
      }
    };
  }
}
