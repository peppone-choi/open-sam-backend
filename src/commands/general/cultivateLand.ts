import { InvestCommerceCommand } from './investCommerce';

/**
 * 농지개간 커맨드
 * 
 * 상업투자 커맨드를 상속받아 농업 개발을 수행합니다.
 */
export class CultivateLandCommand extends InvestCommerceCommand {
  protected static cityKey = 'agri';
  protected static statKey = 'intel'; // PHP 원본과 동일하게 지력 사용
  protected static actionKey = '농업';
  protected static actionName = '농지 개간';
  protected static debuffFront = 0.5;
}

