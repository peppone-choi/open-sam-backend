import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { GameConst } from '../../constants/GameConst';

/**
 * 테스트용 NPC 장수 생성 서비스
 */
export class CreateTestNPCsService {
  /**
   * 테스트 NPC 생성
   * @param sessionId - 세션 ID
   * @param count - 생성할 NPC 수
   * @param options - 추가 옵션
   */
  static async execute(
    sessionId: string,
    count: number = 10,
    options: {
      cityId?: number;
      nationId?: number;
      autoRaiseArmy?: boolean; // 자동 거병
      minStats?: number;
      maxStats?: number;
    } = {}
  ): Promise<{ success: boolean; npcs: any[] }> {
    const {
      cityId,
      nationId = 0,
      autoRaiseArmy = false,
      minStats = 50,
      maxStats = 100
    } = options;

    const npcs: any[] = [];

    // 도시 목록 가져오기
    let targetCityId = cityId;
    if (!targetCityId) {
      const cities = await cityRepository.findBySession(sessionId);
      if (cities.length > 0) {
        targetCityId = cities[0].city || cities[0].data?.city || 1;
      } else {
        targetCityId = 1;
      }
    }

    // 기존 장수 수 확인하여 번호 생성
    const existingGenerals = await generalRepository.findBySession(sessionId);
    let maxNo = existingGenerals.reduce((max, g) => {
      const no = g.no || g.data?.no || 0;
      return Math.max(max, no);
    }, 0);

    const npcNames = [
      '여포', '조조', '유비', '손권', '관우', '장비', '제갈량', '주유', '사마의', '강유',
      '황충', '마초', '조운', '육손', '육항', '가후', '순욱', '곽가', '방통', '서서',
      '태사자', '감녕', '문앙', '악진', '우금', '하후돈', '하후연', '장료', '서황', '조인'
    ];

    for (let i = 0; i < count; i++) {
      maxNo++;
      const npcName = npcNames[i % npcNames.length] + (i >= npcNames.length ? `${Math.floor(i / npcNames.length) + 1}` : '');
      
      const leadership = Math.floor(Math.random() * (maxStats - minStats + 1)) + minStats;
      const strength = Math.floor(Math.random() * (maxStats - minStats + 1)) + minStats;
      const intel = Math.floor(Math.random() * (maxStats - minStats + 1)) + minStats;

      const npcData = {
        session_id: sessionId,
        no: maxNo,
        name: npcName,
        owner: 'NPC',
        picture: '',
        data: {
          no: maxNo,
          name: npcName,
          npc: 2, // NPC 타입
          nation: nationId,
          city: targetCityId,
          leadership: leadership,
          strength: strength,
          intel: intel,
          gold: 10000,
          rice: 10000,
          crew: 1000,
          crewtype: Math.floor(Math.random() * 7) + 1, // 1-7 병종
          train: 50,
          atmos: 50,
          officer_level: 1,
          killturn: 30,
          experience: 0,
          explevel: 0,
          dedication: 0,
          injury: 0,
          age: Math.floor(Math.random() * 30) + 20,
          special: 'None',
          special2: 'None',
          personal: 'None',
          item0: 'None',
          item2: 'None',
          item3: 'None',
          item4: 'None',
          belong: 1
        }
      };

      await generalRepository.create(npcData);
      npcs.push(npcData);

      // 자동 거병 옵션
      if (autoRaiseArmy && i === 0) {
        // 첫 번째 NPC를 군주로 만들고 거병
        const { RaiseArmyCommandService } = await import('../command/RaiseArmyCommand.service');
        const general = await generalRepository.findOneByFilter({
          session_id: sessionId,
          $or: [
            { 'data.no': maxNo },
            { no: maxNo }
          ]
        });
        
        if (general) {
          await RaiseArmyCommandService.execute(general, sessionId);
        }
      }
    }

    return {
      success: true,
      npcs
    };
  }

  /**
   * 모든 NPC 삭제
   */
  static async deleteAllNPCs(sessionId: string): Promise<{ success: boolean; count: number }> {
    const result = await generalRepository.deleteManyByFilter({
      session_id: sessionId,
      'data.npc': { $gte: 2 }
    });

    return {
      success: true,
      count: result.deletedCount || 0
    };
  }
}
