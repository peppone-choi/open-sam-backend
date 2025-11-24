import { ResetWarSkillCommand } from './resetWarSkill';

/**
 * 내정특기초기화 커맨드
 * 
 * 내정 특기를 초기화하여 새로운 특기를 얻을 수 있게 합니다.
 * 5년(60턴)마다 1회 사용 가능합니다.
 * 
 * ResetWarSkillCommand를 상속하여 특기 타입만 변경합니다.
 */
export class ResetDomesticSkillCommand extends ResetWarSkillCommand {
  protected static actionName = '내정 특기 초기화';
  protected static specialType = 'special';
  protected static specialAge = 'specage';
  protected static specialText = '내정 특기';
}
