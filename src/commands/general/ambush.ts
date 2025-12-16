import { FireAttackCommand } from './fireAttack';


/**
 * 매복 커맨드
 * 
 * 적 도시에 매복을 설치하여 적 장수의 병력을 감소시키고 사기를 떨어뜨립니다.
 * 지력 기반 계략입니다.
 */
export class AmbushCommand extends FireAttackCommand {
  protected static actionName = '매복';
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
    const destNationID = destCity.nation;
    const commandName = (this.constructor as typeof AmbushCommand).getName();

    // 적 장수들의 병력 감소 및 사기 감소
    const { generalRepository } = await import('../../repositories/general.repository');
    const destGenerals = await generalRepository.findByFilter({
      session_id: general.getSessionID(),
      'data.city': destCityID,
      'data.nation': destNationID,
    });

    let totalCrewLoss = 0;
    let totalAtmosLoss = 0;
    const affectedCount = destGenerals.length;

    for (const destGen of destGenerals) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const genData = destGen as any;
      const crew = genData.data?.crew || genData.crew || 0;
      const atmos = genData.data?.atmos || genData.atmos || 100;
      
      // 병력 5-15% 손실
      const crewLossRate = rng.nextRangeInt(5, 15) / 100;
      const crewLoss = Math.floor(crew * crewLossRate);
      
      // 사기 10-25 감소
      const atmosLoss = rng.nextRangeInt(10, 25);
      
      totalCrewLoss += crewLoss;
      totalAtmosLoss += atmosLoss;
      
      await generalRepository.updateOneByFilter(
        { 
          session_id: general.getSessionID(), 
          $or: [{ 'data.no': destGen.data?.no || destGen.no }, { no: destGen.data?.no || destGen.no }]
        },
        {
          $inc: {
            'data.crew': -crewLoss,
            'data.atmos': -atmosLoss,
          }
        }
      );
    }

    // 도시 상태 변경 (CQRS 패턴)
    await this.updateCity(destCityID, { state: 33 });

    const crewLossText = totalCrewLoss.toLocaleString();
    const atmosLossText = Math.floor(totalAtmosLoss / Math.max(1, affectedCount)).toLocaleString();

    logger.pushGlobalActionLog(`<G><b>${destCityName}</b></>에서 매복 공격이 발생했습니다!`);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 성공했습니다. <1>${date}</>`);
    logger.pushGeneralActionLog(
      `적 병력 <C>${crewLossText}</>명 손실, 평균 사기 <C>${atmosLossText}</> 감소, 장수 <C>${injuryCount}</>명 부상`,
      'PLAIN'
    );
  }
}





