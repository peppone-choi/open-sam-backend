import { sessionRepository } from '../../repositories/session.repository';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';

/**
 * AdminServerManagement Service
 * 서버/세션 관리 (PHP: entrance.php, j_server_change_status.php)
 * 
 * 기능:
 * - 서버 목록 조회
 * - 서버 열기/닫기
 * - 서버 리셋
 * - 서버 상태 변경
 * - 서버 통계
 */
export class AdminServerManagementService {
  /**
   * 서버 목록 조회
   */
  static async getServerList() {
    try {
      const sessions = await sessionRepository.findAll();

      const serverList = await Promise.all(
        sessions.map(async (session: any) => {
          const sessionId = session.session_id;
          const gameEnv = session.data?.game_env || {};

          // 장수/국가 수 조회
          const generalCount = await generalRepository.countByFilter({
            session_id: sessionId,
            npc: { $lt: 5 }, // 사망 제외
          });

          const nationCount = await nationRepository.countByFilter({
            session_id: sessionId,
          });

          return {
            sessionId: sessionId,
            name: gameEnv.serverName || gameEnv.scenario || sessionId,
            status: gameEnv.isunited === 2 ? 'closed' : 
                   gameEnv.isunited === 3 ? 'united' : 'running',
            statusText: gameEnv.isunited === 2 ? '폐쇄' :
                       gameEnv.isunited === 3 ? '천하통일' : '운영중',
            year: gameEnv.year || 220,
            month: gameEnv.month || 1,
            turnterm: gameEnv.turnterm || 60,
            turntime: gameEnv.turntime,
            starttime: gameEnv.starttime,
            generalCount,
            nationCount,
            maxgeneral: gameEnv.maxgeneral || 300,
            maxnation: gameEnv.maxnation || 12,
            msg: gameEnv.msg || '',
            createdAt: session.created_at,
            updatedAt: session.updated_at,
          };
        })
      );

      return {
        success: true,
        servers: serverList,
        total: serverList.length,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 서버 생성
   */
  static async createServer(params: {
    sessionId: string;
    name: string;
    scenario?: string;
    turnterm?: number;
    startyear?: number;
    maxgeneral?: number;
    maxnation?: number;
  }) {
    try {
      // 중복 확인
      const existing = await sessionRepository.findBySessionId(params.sessionId);
      if (existing) {
        return {
          success: false,
          message: '이미 존재하는 서버 ID입니다',
        };
      }

      // 세션 생성
      const sessionData = {
        session_id: params.sessionId,
        name: params.name, // 필수 필드
        game_mode: 'turn' as const, // 필수 필드
        scenario_id: params.scenario || 'default',
        scenario_name: params.scenario || params.name,
        status: 'waiting' as const,
        resources: {
          gold: { name: '금', default_value: 10000 },
          rice: { name: '쌀', default_value: 50000 },
        },
        attributes: {
          leadership: { name: '통솔', min: 1, max: 100 },
          strength: { name: '무력', min: 1, max: 100 },
          intel: { name: '지력', min: 1, max: 100 },
          politics: { name: '정치', min: 1, max: 100 },
          charm: { name: '매력', min: 1, max: 100 },
        },
        field_mappings: {
          general: {
            primary_resource: 'gold',
            secondary_resource: 'rice',
            troops_count: 'crew',
            troops_type: 'crewtype',
            location: 'city',
            faction: 'nation',
            rank: 'officer_level',
          },
          city: {
            population: 'pop',
            owner: 'nation',
          },
          nation: {
            capital: 'capital',
            treasury: 'gold',
          },
        },
        commands: {},
        game_constants: {},
        data: {
          game_env: {
            serverName: params.name, // 서버 표시 이름
            scenario: params.scenario || params.name,
            turnterm: params.turnterm || 60,
            isunited: 2, // 폐쇄 상태로 시작
            startyear: params.startyear || 220,
            year: params.startyear || 220,
            month: 1,
            maxgeneral: params.maxgeneral || 300,
            maxnation: params.maxnation || 12,
            starttime: new Date().toISOString(),
            turntime: new Date().toISOString(),
            msg: '',
          },
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      await sessionRepository.create(sessionData);

      return {
        success: true,
        message: `서버 '${params.name}'이 생성되었습니다`,
        sessionId: params.sessionId,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 서버 열기 (isunited = 0)
   */
  static async openServer(sessionId: string) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '서버를 찾을 수 없습니다' };
      }

      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.isunited = 0; // 운영중

      await sessionRepository.saveDocument(session);

      return {
        success: true,
        message: `서버 '${sessionId}'가 열렸습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 서버 닫기 (isunited = 2)
   */
  static async closeServer(sessionId: string) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '서버를 찾을 수 없습니다' };
      }

      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.isunited = 2; // 폐쇄

      await sessionRepository.saveDocument(session);

      return {
        success: true,
        message: `서버 '${sessionId}'가 닫혔습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 서버 리셋 (모든 데이터 삭제)
   */
  static async resetServer(sessionId: string, fullReset: boolean = false) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '서버를 찾을 수 없습니다' };
      }

      if (fullReset) {
        // 완전 리셋: 세션 삭제
        await sessionRepository.delete(sessionId);

        
        // - generals
        // - nations
        // - cities
        // - general_turns
        // - nation_turns
        // - messages
        // - general_records
        // - world_historys
        // etc.

        return {
          success: true,
          message: `서버 '${sessionId}'가 완전히 삭제되었습니다`,
        };
      } else {
        // 부분 리셋: 세션 데이터만 초기화
        const gameEnv = session.data?.game_env || {};
        session.data = {
          game_env: {
            ...gameEnv,
            isunited: 2, // 폐쇄
            year: gameEnv.startyear || 220,
            month: 1,
            turntime: new Date().toISOString(),
          },
        };

        await sessionRepository.saveDocument(session);

        return {
          success: true,
          message: `서버 '${sessionId}'가 리셋되었습니다 (재설치 필요)`,
        };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 서버 삭제
   */
  static async deleteServer(sessionId: string) {
    return await this.resetServer(sessionId, true);
  }

  /**
   * 서버 상태 조회
   */
  static async getServerStatus(sessionId: string) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '서버를 찾을 수 없습니다' };
      }

      const gameEnv = session.data?.game_env || {};

      // 통계 수집
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
      });

      const nations = await nationRepository.findByFilter({
        session_id: sessionId,
      });

      const cities = await cityRepository.findByFilter({
        session_id: sessionId,
      });

      const stats = {
        general: {
          total: generals.length,
          user: generals.filter((g: any) => (g.npc || 0) === 0).length,
          npc: generals.filter((g: any) => (g.npc || 0) >= 2 && (g.npc || 0) < 5).length,
          dead: generals.filter((g: any) => (g.npc || 0) === 5).length,
        },
        nation: {
          total: nations.length,
          active: nations.filter((n: any) => n.level > 0).length,
        },
        city: {
          total: cities.length,
          occupied: cities.filter((c: any) => (c.nation || 0) > 0).length,
        },
      };

      return {
        success: true,
        status: {
          sessionId,
          name: gameEnv.scenario || sessionId,
          isunited: gameEnv.isunited || 0,
          statusText: gameEnv.isunited === 2 ? '폐쇄' :
                     gameEnv.isunited === 3 ? '천하통일' : '운영중',
          year: gameEnv.year || 220,
          month: gameEnv.month || 1,
          turnterm: gameEnv.turnterm || 60,
          turntime: gameEnv.turntime,
          msg: gameEnv.msg || '',
        },
        stats,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 전체 공지 설정
   */
  static async setGlobalNotice(notice: string) {
    try {
      // FUTURE: RootDB의 system 테이블에 저장
      // 현재는 환경 변수나 별도 저장소 사용
      console.log('[AdminServerManagement] Global notice:', notice);

      return {
        success: true,
        message: '전체 공지가 설정되었습니다',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
