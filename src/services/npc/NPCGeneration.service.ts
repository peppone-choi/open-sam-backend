import { generalRepository } from '../../repositories/general.repository';

/**
 * NPC 생성 서비스
 */
export class NPCGenerationService {
  /**
   * 새로운 NPC 장수 생성
   */
  static async createNPC(sessionId: string, options: {
    nation?: number;
    npc?: number;
    created_by?: number;
    city?: number;
  }): Promise<any> {
    try {
      // 새로운 NPC 번호 생성 (실제로는 다음 가용한 번호를 조회해야 함)
      const nextNo = Date.now() % 1000000;
      
      // 기본값 설정
      const npcData = {
        session_id: sessionId,
        no: nextNo,
        data: {
          no: nextNo,
          nation: options.nation || 0,
          npc: options.npc || 3,
          city: options.city || 1,
          officer_level: 1,
          leadership: Math.floor(Math.random() * 50) + 30,
          strength: Math.floor(Math.random() * 50) + 30,
          intel: Math.floor(Math.random() * 50) + 30,
          experience: 0,
          dedication: 0,
          crew: 0,
          gold: 1000,
          rice: 1000,
          name: `재야장수${Date.now() % 10000}`,
          affinity: Math.floor(Math.random() * 150),
          belong: 0,
          officer_city: 0,
          turntime: Date.now()
        }
      };

      // MongoDB에 NPC 생성
      const result = await generalRepository.create(npcData);
      
      return result;
    } catch (error) {
      console.error('NPC 생성 실패:', error);
      throw error;
    }
  }
}
