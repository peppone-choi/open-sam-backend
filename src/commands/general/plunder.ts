import { FireAttackCommand } from './fireAttack';
import { DB } from '../../config/db';

/**
 * 탈취 커맨드
 * 
 * 적 도시에서 금과 쌀을 탈취합니다.
 * 화계의 변형으로 무력 기반이며, 장수를 부상시키지 않습니다.
 */
export class PlunderCommand extends FireAttackCommand {
  protected static actionName = '탈취';
  protected static statType = 'strength';
  protected static injuryGeneral = false;

  protected async affectDestCity(rng: any, injuryCount: number): Promise<void> {
    const general = this.generalObj;
    const nationID = general.getNationID();
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();
    const destCity = this.destCity;
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const destNationID = destCity.nation;
    const commandName = (this.constructor as typeof PlunderCommand).getName();
    const db = DB.db();

    const sabotageDamageMin = 800;
    const sabotageDamageMax = 6400;
    const minNationalGold = 10000;
    const minNationalRice = 10000;

    const yearCoef = Math.sqrt(1 + (this.env.year - this.env.startyear) / 4) / 2;
    const commRatio = destCity.comm / destCity.comm_max;
    const agriRatio = destCity.agri / destCity.agri_max;
    
    let gold = rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax) * destCity.level * yearCoef * (0.25 + commRatio / 4);
    let rice = rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax) * destCity.level * yearCoef * (0.25 + agriRatio / 4);

    if (destCity.supply) {
      const destNationResult = await db.queryFirstList(
        'SELECT gold, rice FROM nation WHERE nation=?',
        [destNationID]
      );
      
      let destNationGold = destNationResult[0];
      let destNationRice = destNationResult[1];

      destNationGold -= gold;
      destNationRice -= rice;

      if (destNationGold < minNationalGold) {
        gold += destNationGold - minNationalGold;
        destNationGold = minNationalGold;
      }
      if (destNationRice < minNationalRice) {
        rice += destNationRice - minNationalRice;
        destNationRice = minNationalRice;
      }

      await db.update('nation', {
        gold: destNationGold,
        rice: destNationRice
      }, 'nation=?', [destNationID]);
      
      await db.update('city', {
        state: 34
      }, 'city=?', [destCityID]);
    } else {
      await db.update('city', {
        comm: Math.max(0, destCity.comm - gold / 12),
        agri: Math.max(0, destCity.agri - rice / 12),
        state: 34
      }, 'city=?', [destCityID]);
    }

    if (nationID !== 0) {
      const goldToNation = Math.round(gold * 0.7);
      const riceToNation = Math.round(rice * 0.7);
      
      await db.update('nation', {
        gold: db.sqleval('gold + ?', [goldToNation]),
        rice: db.sqleval('rice + ?', [riceToNation])
      }, 'nation=?', [nationID]);
      
      general.increaseVar('gold', gold - goldToNation);
      general.increaseVar('rice', rice - riceToNation);
    } else {
      general.increaseVar('gold', gold);
      general.increaseVar('rice', rice);
    }

    await db.update('city', {
      state: 32,
      agri: destCity.agri,
      comm: destCity.comm
    }, 'city=?', [destCityID]);

    const goldText = gold.toLocaleString();
    const riceText = rice.toLocaleString();

    logger.pushGlobalActionLog(`<G><b>${destCityName}</b></>에서 금과 쌀을 도둑맞았습니다.`);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 성공했습니다. <1>${date}</>`);
    logger.pushGeneralActionLog(`금<C>${goldText}</> 쌀<C>${riceText}</>을 획득했습니다.`, 'PLAIN');
  }
}
