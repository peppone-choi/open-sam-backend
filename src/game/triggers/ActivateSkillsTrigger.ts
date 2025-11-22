import { WarUnit } from '../../battle/WarUnit';
import { RandUtil } from '../../utils/RandUtil';
import { BaseWarUnitTrigger } from './BaseWarUnitTrigger';
import { ObjectTrigger } from './ObjectTrigger';

export class ActivateSkillsTrigger extends BaseWarUnitTrigger {
  private readonly target: 'self' | 'oppose';
  private readonly skills: string[];

  constructor(unit: WarUnit, target: 'self' | 'oppose', ...skills: string[]) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BEGIN + 100);
    this.target = target;
    this.skills = skills;
  }

  protected actionWar(self: WarUnit, oppose: WarUnit, selfEnv: Record<string, any>, opposeEnv: Record<string, any>, _rng: RandUtil): boolean {
    if (!this.skills.length) {
      return true;
    }

    if (this.target === 'self') {
      self.activateSkill(...this.skills);
    } else {
      oppose.activateSkill(...this.skills);
    }

    return true;
  }
}
