import { FireAttackCommand } from './fireAttack';
import { DB } from '../../config/db';

/**
 * 함정 커맨드
 * 
 * 적 도시에 함정을 설치하여 적 장수들에게 부상을 입히고 도시 치안을 감소시킵니다.
 * 지력 기반 계략입니다.
 */
export class TrapCommand extends FireAttackCommand {
  protected static actionName = '함정';
  protected static statType = 'intel';
  protected static injuryGeneral = true;

  protected async affectDestCity(rng: any, injuryCount: number): Promise<void> {
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();
    const destCity = this.destCity;
    
    if (!destCity) {
      throw new Error('목적 도시 정보가 없습니다');
    }
    
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const commandName = (this.constructor as typeof TrapCommand).getName();

    const trapDamageMin = 500;
    const trapDamageMax = 3000;

    // 치안 감소
    const secuAmount = Math.min(rng.nextRangeInt(trapDamageMin, trapDamageMax), destCity.secu || 0);
    destCity.secu = Math.max(0, (destCity.secu || 0) - secuAmount);

    // 인구 소량 감소 (함정 피해)
    const popLoss = rng.nextRangeInt(100, 500);
    destCity.pop = Math.max(0, (destCity.pop || 0) - popLoss);

    await DB.db().update('city', {
      state: 34, // 함정 상태
      secu: destCity.secu,
      pop: destCity.pop,
    }, 'city=?', [destCityID]);

    const secuAmountText = secuAmount.toLocaleString();
    const popLossText = popLoss.toLocaleString();

    logger.pushGlobalActionLog(`<G><b>${destCityName}</b></>에서 함정이 발동했습니다!`);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 성공했습니다. <1>${date}</>`);
    logger.pushGeneralActionLog(
      `도시 치안 <C>${secuAmountText}</> 감소, 인구 <C>${popLossText}</> 감소, 장수 <C>${injuryCount}</>명 부상`,
      'PLAIN'
    );
  }
}










