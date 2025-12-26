// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';

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

    if (typeof nationName !== 'string' || typeof nationType !== 'string') {
      return false;
    }

    if (typeof colorType !== 'number' && typeof colorType !== 'string') {
      return false;
    }

    if (nationName === '' || this.getStringWidth(nationName) > 18) {
      return false;
    }

    if (typeof colorType === 'string' && !/^#[0-9A-Fa-f]{6}$/.test(colorType)) {
      return false;
    }

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
    const generalName = general.data.name || general.name;
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
      await this.updateGeneralCity(cityID);
      this.setCity();
      
      const affectedGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': general.getNationID()
      });
      await generalRepository.updateManyByFilter(
        { session_id: sessionId, 'data.nation': general.getNationID() },
        { city: cityID }
      );
      const affectedIds = affectedGenerals
        .map((doc: any) => doc.data?.no ?? doc.no)
        .filter((id: any) => id !== undefined);
      await this.updateOtherGeneralsCity(affectedIds, cityID);
    }

    const josaYi = JosaUtil.pick(generalName, '이');

    const nationName = this.arg.nationName;
    const nationType = this.arg.nationType;
    let colorType = this.arg.colorType;

    if (typeof colorType === 'number') {
        const { getNationColor } = await import('../../utils/functions');
        colorType = getNationColor(colorType);
    }

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
      const { resolveFallbackDefender } = await import('../../services/helpers/garrison.helper');
      const fallbackDefender = resolveFallbackDefender(sessionId, currentCity);
      if (!fallbackDefender) {
        logger.pushGeneralActionLog(`<G><b>${cityName}</b></>에는 저항 세력이 없어 건국을 진행합니다.`);
      }
      const cityLevel = currentCity.level || 1;
      
      // 방어 세력 타입 결정
      const defenderType = fallbackDefender?.label ?? '지역 세력';
      const militiaUnit = fallbackDefender
        ? {
            name: fallbackDefender.unit.name,
            crew: fallbackDefender.unit.crew,
            crewtype: fallbackDefender.unit.crewtype,
            train: fallbackDefender.unit.train,
            atmos: fallbackDefender.unit.morale,
            leadership: fallbackDefender.unit.leadership,
            strength: fallbackDefender.unit.strength,
            intel: fallbackDefender.unit.intel,
          }
        : null;
      
      // 이민족 도시의 경우 특별 메시지
      if (cityLevel === 5) {
        if (militiaUnit) {
          logger.pushGeneralActionLog(
            `<G><b>${cityName}</b></>의 ${defenderType} 세력과 전투를 시작합니다! [적 ${militiaUnit.crew}명]`
          );
          logger.pushGlobalActionLog?.(
            `<Y>${generalName}</>${josaYi} 이민족 땅 <G><b>${cityName}</b></>를 정복하여 건국을 시도합니다!`
          );
        }
      } else {
        if (militiaUnit) {
          logger.pushGeneralActionLog(
            `<G><b>${cityName}</b></>의 ${defenderType}과(와) 전투를 시작합니다! [적 ${militiaUnit.crew}명]`
          );
          logger.pushGlobalActionLog?.(
            `<Y>${generalName}</>${josaYi} <G><b>${cityName}</b></>의 ${defenderType}과(와) 건국을 위한 전투를 시작합니다!`
          );
        }
      }

      // 자동 전투 실행
      let battleResult = { winner: 'attacker', attackerLoss: 0 } as any;
      if (militiaUnit) {
        battleResult = await (ProcessWarService as any).executeAutoBattle(
          sessionId,
          general,
          militiaUnit,
          currentCity,
          rng
        );
      }

      if (militiaUnit && battleResult.winner === 'defender') {
        // 전투 패배 - 건국 실패
        logger.pushGeneralActionLog(
          `${defenderType}에게 패배했습니다! 건국에 실패했습니다. [손실: ${battleResult.attackerLoss}명] <1>${date}</>`
        );
        logger.pushGlobalActionLog?.(
          `<Y>${generalName}</>${josaYi} <G><b>${cityName}</b></>에서 건국을 시도했으나 ${defenderType}에게 패배했습니다!`
        );
        
        // 병력 손실만 반영
        general.data.crew = Math.max(0, (general.data.crew ?? 0) - battleResult.attackerLoss);
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
      general.data.crew = Math.max(0, (general.data.crew ?? 0) - battleResult.attackerLoss);
      
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
      const { InheritancePointService, InheritanceKey } = await import('../../services/inheritance/InheritancePoint.service');
      const inheritanceService = new InheritancePointService(sessionId);
      const userId = general.data.owner ?? general.data.user_id ?? general.getID();
      await inheritanceService.recordActivity(userId, InheritanceKey.ACTIVE_ACTION, 1);
    } catch (error: any) {
      console.error('InheritancePoint 실패:', error);
    }

    this.setResultTurn(new LastTurn(RandomFoundNationCommand.getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (건국은 유산 포인트가 위에서 이미 처리됨)
    await this.postRunHooks(rng, { skipInheritancePoint: true });

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
