import { InvestCommerceCommand } from './investCommerce';

/**
 * 농지 개간 커맨드
 * 
 * 도시의 농업 수치를 증가시킵니다.
 */
export class CultivateFarmCommand extends InvestCommerceCommand {
  protected static cityKey = 'agri';
  protected static statKey = 'intel'; // PHP 원본과 동일하게 지력 사용
  protected static actionKey = '농업';
  protected static actionName = '농지 개간';
  protected static debuffFront = 0.5;
}
