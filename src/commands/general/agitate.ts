import { FireAttackCommand } from './fireAttack';
import { cityRepository } from '../../repositories/city.repository';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { GameConst } from '../../constants/GameConst';


/**
 * 선동 커맨드
 * PHP che_선동과 동일한 구조 (che_화계 상속)
 */
export class AgitateCommand extends FireAttackCommand {
  protected static actionName = '선동';
  protected static statType = 'leadership';
  protected static injuryGeneral = true;

  protected async affectDestCity(rng: any, injuryCount: number): Promise<void> {
    const general = this.generalObj;
    const date = general.getTurnTime();

    const logger = general.getLogger();
    const destCity = this.destCity;

    const destCityName = destCity.name;
    const destCityID = destCity.city;

    const commandName = AgitateCommand.getName();

    // 선동 최대 10
    const saboDamageMin = GameConst.sabotageDamageMin || 5;
    const saboDamageMax = GameConst.sabotageDamageMax || 10;

    const secuAmount = Util.valueFit(
      rng.nextRangeInt(saboDamageMin, saboDamageMax),
      null,
      destCity.secu
    );

    const trustAmount = Util.valueFit(
      rng.nextRange(saboDamageMin, saboDamageMax) / 50,
      null,
      destCity.trust
    );

    destCity.secu -= secuAmount;
    destCity.trust -= trustAmount;

    const { City } = await import('../../models/city.model');
    await cityRepository.updateOneByFilter(
      {
        session_id: general.getSessionID(),
        city: destCityID
      },
      {
        $set: {
          state: 32,
          secu: destCity.secu,
          trust: destCity.trust
        }
      }
    );

    const secuAmountText = Util.numberFormat(secuAmount);
    const trustAmountText = Util.numberFormat(trustAmount, 1);

    logger.pushGlobalActionLog(`<G><b>${destCityName}</b></>의 백성들이 동요하고 있습니다.`);
    const josaYi = JosaUtil.pick(commandName, '이');
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}${josaYi} 성공했습니다. <1>${date}</>`);

    logger.pushGeneralActionLog(
      `도시의 치안이 <C>${secuAmountText}</>, 민심이 <C>${trustAmountText}</>만큼 감소하고, 장수 <C>${injuryCount}</>명이 부상 당했습니다.`,
      'PLAIN'
    );
  }
}

