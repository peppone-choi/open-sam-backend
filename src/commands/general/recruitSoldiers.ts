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

  protected static defaultTrain = GameConst.defaultTrainHigh || 80;
  protected static defaultAtmos = GameConst.defaultAtmosHigh || 80;

  // protected static initStatic(): void { ... } removed

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof RecruitSoldiersCommand).getName()}(통솔경험, 자금×2)`;
  }
}
