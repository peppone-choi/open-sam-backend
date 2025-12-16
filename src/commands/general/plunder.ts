// @ts-nocheck - Type issues need review
import { FireAttackCommand } from './fireAttack';

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

    const sabotageDamageMin = 800;
    const sabotageDamageMax = 6400;
    const minNationalGold = 10000;
    const minNationalRice = 10000;

    const yearCoef = Math.sqrt(1 + (this.env.year - this.env.startyear) / 4) / 2;
    // 0으로 나누기 방지: _max 값들이 0일 수 있음
    const commMax = Math.max(1, destCity.comm_max ?? 1);
    const agriMax = Math.max(1, destCity.agri_max ?? 1);
    const commRatio = (destCity.comm ?? 0) / commMax;
    const agriRatio = (destCity.agri ?? 0) / agriMax;
    
    let gold = rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax) * destCity.level * yearCoef * (0.25 + commRatio / 4);
    let rice = rng.nextRangeInt(sabotageDamageMin, sabotageDamageMax) * destCity.level * yearCoef * (0.25 + agriRatio / 4);

    if (destCity.supply) {
      try {
        // MongoDB에서 destNation 정보 사용 (이미 로드됨)
        const destNation = this.destNation;
        if (!destNation) {
          throw new Error(`국가 ${destNationID}의 자원 정보를 찾을 수 없습니다`);
        }
        
        let destNationGold = destNation.gold ?? 0;
        let destNationRice = destNation.rice ?? 0;

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

        // MongoDB로 적 국가 자원 업데이트
        await this.updateDestNation(destNationID, {
          gold: destNationGold,
          rice: destNationRice
        });
        
        // MongoDB로 적 도시 상태 업데이트
        await this.updateDestCity(destCityID, { state: 34 });
      } catch (error: any) {
        console.error(`약탈 처리 중 DB 업데이트 실패:`, error);
        throw new Error(`약탈 처리 실패: ${error.message}`);
      }
    } else {
      // MongoDB로 적 도시 업데이트
      await this.updateDestCity(destCityID, {
        comm: Math.max(0, destCity.comm - gold / 12),
        agri: Math.max(0, destCity.agri - rice / 12),
        state: 34
      });
    }

    if (nationID !== 0) {
      const goldToNation = Math.round(gold * 0.7);
      const riceToNation = Math.round(rice * 0.7);
      
      // MongoDB로 우리 국가 자원 증가
      await this.incrementNation(nationID, {
        gold: goldToNation,
        rice: riceToNation
      });
      
      general.increaseVar('gold', gold - goldToNation);
      general.increaseVar('rice', rice - riceToNation);
    } else {
      general.increaseVar('gold', gold);
      general.increaseVar('rice', rice);
    }

    // MongoDB로 적 도시 상태 업데이트
    await this.updateDestCity(destCityID, {
      state: 32,
      agri: destCity.agri,
      comm: destCity.comm
    });

    const goldText = gold.toLocaleString();
    const riceText = rice.toLocaleString();

    logger.pushGlobalActionLog(`<G><b>${destCityName}</b></>에서 금과 쌀을 도둑맞았습니다.`);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>에 ${commandName}이(가) 성공했습니다. <1>${date}</>`);
    logger.pushGeneralActionLog(`금<C>${goldText}</> 쌀<C>${riceText}</>을 획득했습니다.`, 'PLAIN');
  }

  // 적 도시 업데이트 (dest city)
  private async updateDestCity(cityId: number, update: Record<string, any>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    const { cityRepository } = await import('../../repositories/city.repository');
    await cityRepository.updateByCityNum(sessionId, cityId, update);
    this.markCityDirty(cityId);
  }

  // 적 국가 업데이트 (dest nation)
  private async updateDestNation(nationId: number, update: Record<string, any>): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    const { nationRepository } = await import('../../repositories/nation.repository');
    await nationRepository.updateBySessionAndNationId(sessionId, nationId, update);
    this.markNationDirty(nationId);
  }
}
