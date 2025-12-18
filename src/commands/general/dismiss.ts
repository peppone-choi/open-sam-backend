import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { cityRepository } from '../../repositories/city.repository';

/**
 * 소집해제 커맨드
 * 
 * 병사들을 전원 해산하고 도시 인구로 되돌립니다.
 * 스택 시스템 제거됨 - 장수의 crew만 사용
 */
export class DismissCommand extends GeneralCommand {
  protected static actionName = '소집해제';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.ReqGeneralCrew(),
    ];
  }

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof GeneralCommand).getName()}`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number { return 0; }
  public getPostReqTurn(): number { return 0; }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const logger = general.getLogger();
    const date = `${this.env.year}년 ${this.env.month}월`;

    const crew = general.data.crew ?? 0;
    
    if (crew <= 0) {
      logger.pushGeneralActionLog(`해산할 병사가 없습니다. <1>${date}</>`);
      return false;
    }

    // 도시 인구로 복귀
    if (this.city?.city) {
      const sessionId = this.env.session_id || 'sangokushi_default';
      const newPop = (this.city.pop ?? 0) + crew;
      
      await cityRepository.updateByCityNum(sessionId, this.city.city, {
        pop: newPop
      });
      
      this.city.pop = newPop;
    }

    // 장수 병력 초기화
    general.setVar('crew', 0);
    general.setVar('train', 0);
    general.setVar('atmos', 0);

    logger.pushGeneralActionLog(`병사 <C>${crew.toLocaleString()}</>명을 해산했습니다. <1>${date}</>`);

    general.addExperience(1);
    general.addDedication(1);

    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    general.checkStatChange();

    await this.postRunHooks(rng);
    await this.saveGeneral();

    return true;
  }
}
