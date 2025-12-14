import { InvestCommerceCommand } from './investCommerce';

/**
 * 농지 개간 커맨드
 * 
 * 도시의 농업 수치를 증가시킵니다.
 * 
 * 능력치: 정치(政) - 내정 효율에 영향
 */
export class CultivateFarmCommand extends InvestCommerceCommand {
  protected static cityKey = 'agri';
  protected static statKey = 'politics'; // 정치 능력치 사용 (통무지정매 시스템)
  protected static actionKey = '농업';
  protected static actionName = '농지 개간';
  protected static debuffFront = 0.5;
}
