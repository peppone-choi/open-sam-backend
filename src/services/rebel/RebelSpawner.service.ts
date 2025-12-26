import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalRepository } from '../../repositories/general.repository';
import { NPCGenerationService } from '../npc/NPCGeneration.service';
import { logger } from '../../common/logger';
import { RandUtil } from '../../utils/RandUtil';

export class RebelSpawnerService {
  /**
   * 반란군/이민족 스폰 시도
   */
  static async spawnIfPossible(sessionId: string) {
    const rng = new RandUtil(Date.now());
    
    // 10% 확률로 스폰
    if (!rng.nextBool(0.1)) return;

    try {
      // 무주지(nation 0)인 도시 찾기
      const neutralCities = await cityRepository.findByFilter({ session_id: sessionId, nation: 0 });
      if (neutralCities.length === 0) return;

      const targetCity = neutralCities[rng.nextRangeInt(0, neutralCities.length - 1)];
      const cityName = targetCity.name;

      logger.info(`[Rebel] Spawning rebel in ${cityName} (${sessionId})`);

      // NPC 장수 생성 (반란군 타입 npc=4)
      const rebelGeneral = await NPCGenerationService.createNPC(sessionId, {
        nation: 0,
        city: targetCity.city,
        npc: 4, // REBEL
      });

      if (rebelGeneral) {
        // 즉시 건국 시도 (반란군 세력)
        const { FoundNationService } = await import('../command/FoundNationCommand.service');
        await FoundNationService.execute({
          session_id: sessionId,
          general_id: rebelGeneral.no,
          nationName: `${cityName} 반란군`,
          nationType: 'rebel',
          colorType: rng.nextRangeInt(0, 10)
        });

        logger.info(`[Rebel] Rebel nation formed in ${cityName}`);
        
        // 전역 공지
        const { GameEventEmitter } = await import('../gameEventEmitter');
        GameEventEmitter.broadcastMessage(sessionId, {
          type: 'rebel_spawn',
          message: `${cityName}에서 반란군이 봉기했습니다!`,
          timestamp: new Date()
        });
      }
    } catch (error: any) {
      logger.error('[Rebel] Spawn failed:', error);
    }
  }
}
