/**
 * PostBattleProcessor.ts - 전투 후처리 시스템
 * 
 * 기술력 증가, 외교 관계 업데이트, 군량 소모, 경험치/공헌도 분배 등을 처리
 */

import { GameConst } from '../constants/GameConst';
import { Util } from '../utils/Util';
import { nationRepository } from '../repositories/nation.repository';
import { cityRepository } from '../repositories/city.repository';
import { diplomacyRepository } from '../repositories/diplomacy.repository';
import { generalRepository } from '../repositories/general.repository';

interface BattleResult {
  attackerKilled: number;  // 공격자가 죽인 적
  attackerDead: number;    // 공격자 사망자
  defenderKilled: number;  // 수비자가 죽인 적
  defenderDead: number;    // 수비자 사망자
  winner: 'attacker' | 'defender' | 'draw';
  turns: number;
  conquerCity: boolean;
}

interface NationInfo {
  nationId: number;
  name: string;
  tech?: number;
  gennum?: number;
  rice?: number;
}

interface CityInfo {
  cityId: number;
  name: string;
  nationId: number;
  supply?: number;
}

interface GeneralInfo {
  generalId: number;
  name: string;
  nationId: number;
  cityId: number;
  experience?: number;
  dedication?: number;
}

/**
 * PostBattleProcessor - 전투 후처리 클래스
 */
export class PostBattleProcessor {
  private sessionId: string;
  private year: number;
  private month: number;

  constructor(sessionId: string, year: number, month: number) {
    this.sessionId = sessionId;
    this.year = year;
    this.month = month;
  }

  /**
   * 전투 후처리 실행
   * 
   * @param battleResult - 전투 결과
   * @param attackerNation - 공격 국가 정보
   * @param defenderNation - 수비 국가 정보
   * @param attackerCity - 공격자 도시
   * @param defenderCity - 수비자 도시
   * @param attackerGeneral - 공격 장수
   * @param defenderGenerals - 수비 장수 목록
   */
  async process(
    battleResult: BattleResult,
    attackerNation: NationInfo,
    defenderNation: NationInfo,
    attackerCity: CityInfo,
    defenderCity: CityInfo,
    attackerGeneral: GeneralInfo,
    defenderGenerals: GeneralInfo[]
  ): Promise<void> {
    // 1. 사망자 통계 업데이트
    await this.updateDeaths(battleResult, attackerCity, defenderCity);

    // 2. 기술력 증가
    await this.increaseTechnology(battleResult, attackerNation, defenderNation);

    // 3. 외교 관계 업데이트
    await this.updateDiplomacy(battleResult, attackerNation, defenderNation);

    // 4. 군량 소모 처리
    await this.consumeRice(battleResult, defenderNation, defenderCity);

    // 5. 경험치/공헌도 분배
    await this.distributeRewards(battleResult, attackerGeneral, defenderGenerals);
  }

  /**
   * 사망자 통계 업데이트
   */
  private async updateDeaths(
    battleResult: BattleResult,
    attackerCity: CityInfo,
    defenderCity: CityInfo
  ): Promise<void> {
    const totalDead = battleResult.attackerDead + battleResult.defenderDead;

    try {
      // 공격자 도시에 사망자 추가 (40%)
      if (attackerCity.cityId) {
        await cityRepository.updateByCityNum(
          this.sessionId,
          attackerCity.cityId,
          {
            dead: { $inc: Math.round(totalDead * 0.4) }
          }
        );
      }

      // 수비자 도시에 사망자 추가 (60%)
      if (defenderCity.cityId) {
        await cityRepository.updateByCityNum(
          this.sessionId,
          defenderCity.cityId,
          {
            dead: { $inc: Math.round(totalDead * 0.6) }
          }
        );
      }
    } catch (error) {
      console.error('[PostBattleProcessor] Failed to update deaths:', error);
    }
  }

  /**
   * 기술력 증가
   * 
   * 공식:
   * - 공격국: (적 사망자 * 0.012) / 국가 장수 수
   * - 수비국: (적 사망자 * 0.009) / 국가 장수 수
   */
  private async increaseTechnology(
    battleResult: BattleResult,
    attackerNation: NationInfo,
    defenderNation: NationInfo
  ): Promise<void> {
    try {
      // 공격국 기술력 증가
      const attackerIncTech = battleResult.defenderDead * 0.012;
      const attackerGennum = Math.max(
        GameConst.initialNationGenLimit || 5,
        attackerNation.gennum || 5
      );

      await nationRepository.updateByNationNum(
        this.sessionId,
        attackerNation.nationId,
        {
          tech: { $inc: attackerIncTech / attackerGennum }
        }
      );

      // 수비국 기술력 증가 (재야가 아닌 경우)
      if (defenderNation.nationId !== 0) {
        const defenderIncTech = battleResult.attackerDead * 0.009;
        const defenderGennum = Math.max(
          GameConst.initialNationGenLimit || 5,
          defenderNation.gennum || 5
        );

        await nationRepository.updateByNationNum(
          this.sessionId,
          defenderNation.nationId,
          {
            tech: { $inc: defenderIncTech / defenderGennum }
          }
        );
      }

      console.log(
        `[PostBattleProcessor] Tech increase - Attacker: +${(attackerIncTech / attackerGennum).toFixed(2)}, Defender: +${defenderNation.nationId !== 0 ? ((battleResult.attackerDead * 0.009) / Math.max(5, defenderNation.gennum || 5)).toFixed(2) : 0}`
      );
    } catch (error) {
      console.error('[PostBattleProcessor] Failed to increase technology:', error);
    }
  }

  /**
   * 외교 관계 업데이트
   * 
   * 전투 사망자 수를 외교 통계에 기록
   */
  private async updateDiplomacy(
    battleResult: BattleResult,
    attackerNation: NationInfo,
    defenderNation: NationInfo
  ): Promise<void> {
    if (defenderNation.nationId === 0) {
      return; // 재야는 외교 관계 없음
    }

    try {
      // 공격국 → 수비국에게 입힌 피해
      await diplomacyRepository.updateDeaths(
        this.sessionId,
        attackerNation.nationId,
        defenderNation.nationId,
        battleResult.defenderDead
      );

      // 수비국 → 공격국에게 입힌 피해
      await diplomacyRepository.updateDeaths(
        this.sessionId,
        defenderNation.nationId,
        attackerNation.nationId,
        battleResult.attackerDead
      );

      console.log(
        `[PostBattleProcessor] Diplomacy updated - ${attackerNation.name} → ${defenderNation.name}: ${battleResult.defenderDead} deaths`
      );
    } catch (error) {
      console.error('[PostBattleProcessor] Failed to update diplomacy:', error);
    }
  }

  /**
   * 군량 소모 처리
   * 
   * 보급 도시인 경우:
   * - 전투가 발생했으면: 사망자 기반 군량 소모
   * - 도시가 점령당했으면: 군량 보너스
   */
  private async consumeRice(
    battleResult: BattleResult,
    defenderNation: NationInfo,
    defenderCity: CityInfo
  ): Promise<void> {
    if (!defenderCity.supply || defenderNation.nationId === 0) {
      return;
    }

    try {
      if (battleResult.turns > 0 && !battleResult.conquerCity) {
        // 전투가 발생한 경우 군량 소모
        let riceConsumption = battleResult.defenderDead / 100 * 0.8;

        // 기술력 보정
        const tech = defenderNation.tech || 0;
        const techLevel = Math.floor(tech / 1000);
        riceConsumption *= 1 + techLevel * 0.15;

        // 훈련도/사기 보정 (간단화)
        riceConsumption *= 0.8; // 평균 80%

        const finalRice = Math.round(riceConsumption);
        const currentRice = defenderNation.rice || 0;

        await nationRepository.updateByNationNum(
          this.sessionId,
          defenderNation.nationId,
          {
            rice: Math.max(0, currentRice - finalRice)
          }
        );

        console.log(`[PostBattleProcessor] Rice consumed: ${finalRice}`);
      } else if (battleResult.conquerCity) {
        // 도시 점령 시 군량 보너스
        const riceBonus = defenderCity.cityId === defenderNation.nationId ? 1000 : 500;

        await nationRepository.updateByNationNum(
          this.sessionId,
          defenderNation.nationId,
          {
            rice: { $inc: riceBonus }
          }
        );

        console.log(`[PostBattleProcessor] Rice bonus: ${riceBonus}`);
      }
    } catch (error) {
      console.error('[PostBattleProcessor] Failed to consume rice:', error);
    }
  }

  /**
   * 경험치/공헌도 분배
   * 
   * 승리 시:
   * - 공격자: 경험치 +1000, 공헌도 +500
   * - 수비자: 경험치 -100, 공헌도 -50
   * 
   * 패배 시:
   * - 공격자: 경험치 -50, 공헌도 -25
   * - 수비자: 경험치 +500, 공헌도 +250
   */
  private async distributeRewards(
    battleResult: BattleResult,
    attackerGeneral: GeneralInfo,
    defenderGenerals: GeneralInfo[]
  ): Promise<void> {
    try {
      if (battleResult.winner === 'attacker') {
        // 공격자 승리
        const attackerExp = (attackerGeneral.experience || 0) + 1000;
        const attackerDed = (attackerGeneral.dedication || 0) + 500;

        await generalRepository.updateById(attackerGeneral.generalId, {
          'data.experience': attackerExp,
          'data.dedication': attackerDed
        });

        // 수비자 패배
        for (const defender of defenderGenerals) {
          const defenderExp = Math.max(0, (defender.experience || 0) - 100);
          const defenderDed = Math.max(0, (defender.dedication || 0) - 50);

          await generalRepository.updateById(defender.generalId, {
            'data.experience': defenderExp,
            'data.dedication': defenderDed
          });
        }
      } else if (battleResult.winner === 'defender') {
        // 공격자 패배
        const attackerExp = Math.max(0, (attackerGeneral.experience || 0) - 50);
        const attackerDed = Math.max(0, (attackerGeneral.dedication || 0) - 25);

        await generalRepository.updateById(attackerGeneral.generalId, {
          'data.experience': attackerExp,
          'data.dedication': attackerDed
        });

        // 수비자 승리
        for (const defender of defenderGenerals) {
          const defenderExp = (defender.experience || 0) + 500;
          const defenderDed = (defender.dedication || 0) + 250;

          await generalRepository.updateById(defender.generalId, {
            'data.experience': defenderExp,
            'data.dedication': defenderDed
          });
        }
      }

      console.log(`[PostBattleProcessor] Rewards distributed - Winner: ${battleResult.winner}`);
    } catch (error) {
      console.error('[PostBattleProcessor] Failed to distribute rewards:', error);
    }
  }

  /**
   * 인구/신뢰도 변화 계산
   * 
   * @param city - 도시 정보
   * @param casualties - 사망자 수
   * @returns 새로운 인구/신뢰도
   */
  static calculatePopulationTrust(
    city: { pop: number; trust: number },
    casualties: number
  ): { pop: number; trust: number } {
    // 인구 감소 (사망자의 60%)
    const popDecrease = Math.floor(casualties * 0.6);
    const newPop = Math.max(0, city.pop - popDecrease);

    // 신뢰도 감소 (사망자에 비례, 최대 -20)
    const trustDecrease = Math.min(20, Math.floor(casualties / 1000));
    const newTrust = Math.max(0, Math.min(100, city.trust - trustDecrease));

    return {
      pop: newPop,
      trust: newTrust
    };
  }
}

/**
 * 헬퍼 함수: 전투 후처리 실행
 */
export async function processBattleAftermath(
  sessionId: string,
  year: number,
  month: number,
  battleResult: BattleResult,
  attackerNation: NationInfo,
  defenderNation: NationInfo,
  attackerCity: CityInfo,
  defenderCity: CityInfo,
  attackerGeneral: GeneralInfo,
  defenderGenerals: GeneralInfo[]
): Promise<void> {
  const processor = new PostBattleProcessor(sessionId, year, month);
  await processor.process(
    battleResult,
    attackerNation,
    defenderNation,
    attackerCity,
    defenderCity,
    attackerGeneral,
    defenderGenerals
  );
}
