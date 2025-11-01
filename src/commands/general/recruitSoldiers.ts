import { ConscriptCommand } from './conscript';
import { GameConst } from '../../constants/GameConst';

/**
 * 모병 커맨드
 * 
 * 징병보다 높은 훈련도/사기로 병사를 모집하지만 자금이 2배 소모됩니다.
 */
export class RecruitSoldiersCommand extends ConscriptCommand {
  protected static actionName = '모병';
  protected static costOffset = 2;

  protected static defaultTrain: number;
  protected static defaultAtmos: number;

  protected static initStatic(): void {
    this.defaultTrain = (GameConst as any).defaultTrainHigh || 80;
    this.defaultAtmos = (GameConst as any).defaultAtmosHigh || 80;
  }

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof RecruitSoldiersCommand).getName()}(통솔경험, 자금×2)`;
  }
}
