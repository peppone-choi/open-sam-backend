import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';

/**
 * GetCommandTable Service (커맨드 테이블 조회)
 * 장수가 사용 가능한 커맨드 목록을 카테고리별로 반환
 * PHP: /sam/hwe/sammo/API/General/GetCommandTable.php
 */
export class GetCommandTableService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 ID가 필요합니다'
      };
    }

    try {
      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const commandTable = await this.buildCommandTable(general, session);

      return {
        success: true,
        result: true,
        commandTable
      };
    } catch (error: any) {
      console.error('GetCommandTable error:', error);
      return {
        success: false,
        message: error.message || '커맨드 테이블 조회 중 오류가 발생했습니다'
      };
    }
  }

  private static async buildCommandTable(general: any, session: any): Promise<any[]> {
    const generalData = general.data || {};
    const nationId = generalData.nation || 0;
    const officerLevel = generalData.officer_level || 0;
    const gold = generalData.gold || 0;
    const rice = generalData.rice || 0;
    const crew = generalData.crew || 0;

    const commandCategories = [
      {
        category: '내정',
        values: [
          { value: 'che_농업개발', simpleName: '농업개발', reqArg: 0, possible: gold >= 100, compensation: 0, title: '농업개발 (자금 100)' },
          { value: 'che_상업개발', simpleName: '상업개발', reqArg: 0, possible: gold >= 100, compensation: 0, title: '상업개발 (자금 100)' },
          { value: 'che_치안강화', simpleName: '치안강화', reqArg: 0, possible: gold >= 100, compensation: 0, title: '치안강화 (자금 100)' },
          { value: 'che_성벽강화', simpleName: '성벽강화', reqArg: 0, possible: gold >= 100, compensation: 0, title: '성벽강화 (자금 100)' },
        ]
      },
      {
        category: '군사',
        values: [
          { value: 'che_징병', simpleName: '징병', reqArg: 0, possible: gold >= 100, compensation: 0, title: '징병 (자금 100)' },
          { value: 'che_훈련', simpleName: '훈련', reqArg: 0, possible: crew > 0, compensation: 0, title: '훈련' },
          { value: 'che_사기', simpleName: '사기', reqArg: 0, possible: crew > 0, compensation: 0, title: '사기' },
        ]
      },
      {
        category: '이동',
        values: [
          { value: 'che_이동', simpleName: '이동', reqArg: 1, possible: true, compensation: 0, title: '이동' },
        ]
      },
      {
        category: '외교',
        values: [
          { value: 'che_등용', simpleName: '등용', reqArg: 1, possible: nationId !== 0, compensation: 0, title: '등용' },
          { value: 'che_추방', simpleName: '추방', reqArg: 0, possible: officerLevel >= 5, compensation: 0, title: '추방' },
        ]
      },
      {
        category: '기타',
        values: [
          { value: 'che_휴식', simpleName: '휴식', reqArg: 0, possible: true, compensation: 0, title: '휴식' },
          { value: 'che_수송', simpleName: '수송', reqArg: 0, possible: gold >= 100 || rice >= 100, compensation: 0, title: '수송' },
        ]
      }
    ];

    return commandCategories;
  }
}
