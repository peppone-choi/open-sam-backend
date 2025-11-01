import { FireAttackCommand } from './fireAttack';
import { DB } from '../../config/db';

/**
 * 파괴 커맨드
 * 
 * 적 도시의 수비와 성벽을 파괴하고 적 장수를 부상시킵니다.
 * 화계의 변형으로 무력 기반입니다.
 */
export class DestroyCommand extends FireAttackCommand {
  protected static actionName = '파괴';
  protected static statType = 'strength';
  protected static injuryGeneral = true;

  protected async affectDestCity(rng: any, injuryCount: number): Promise<void> {
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();
    const destCity = this.destCity;
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const commandName = (this.constructor as typeof DestroyCommand).getName();

    const sabotageDamageMin = 800;
    const sabotageDamageMax = 6400;

    let defAmount = Math.min(rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax), destCity.def);
    let wallAmount = Math.min(rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax), destCity.wall);
    
    if (defAmount < 0) defAmount = 0;
    if (wallAmount < 0) wallAmount = 0;

    destCity.def -= defAmount;
    destCity.wall -= wallAmount;

    await DB.db().update('city', {
      state: 32,
      def: destCity.def,
      wall: destCity.wall
    }, 'city=?', [destCityID]);

    const defAmountText = defAmount.toLocaleString();
    const wallAmountText = wallAmount.toLocaleString();

    logger.pushGlobalActionLog(`누군가가 <G><b>${destCityName}</b></>의 성벽을 허물었습니다.`);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 성공했습니다. <1>${date}</>`);
    logger.pushGeneralActionLog(
      `도시의 수비가 <C>${defAmountText}</>, 성벽이 <C>${wallAmountText}</>만큼 감소하고, 장수 <C>${injuryCount}</>명이 부상 당했습니다.`,
      'PLAIN'
    );
  }
}
