import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { LastTurn } from '../base/BaseCommand';

export class RestCommand extends NationCommand {
  static getName(): string {
    return '휴식';
  }

  static getCategory(): string {
    return 'nation';
  }

  protected argTest(): boolean {
    return true;
  }

  protected init(): void {
    this.minConditionConstraints = [];
    this.fullConditionConstraints = [];
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
    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    return true;
  }
}
