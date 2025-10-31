import { ResetBattleSkillCommand } from './resetBattleSkill';

export class ResetAdminSkillCommand extends ResetBattleSkillCommand {
  protected static actionName = '내정 특기 초기화';
  protected static specialType = 'special';
  protected static specageType = 'specage';
  protected static specialText = '내정 특기';
}
