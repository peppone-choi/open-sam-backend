import { sessionRepository } from '../../repositories/session.repository';

export class GetGlobalMenuService {
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };
      }

      const sessionData = session.data as any || {};
      
      // PHP 버전 GlobalMenu.php와 동일한 메뉴 구조
      const menu = [
        {
          type: 'item',
          name: '천통국 베팅',
          url: '/nation/betting',
          condHighlightVar: 'nationBetting'
        },
        {
          type: 'multi',
          name: '게임정보',
          subMenu: [
            { type: 'item', name: '세력일람', url: '/archive/kingdom-list', newTab: true },
            { type: 'item', name: '장수일람', url: '/archive/gen-list', newTab: true },
            { type: 'item', name: '명장일람', url: '/archive/best-general', newTab: true },
            { type: 'line' },
            { type: 'item', name: '명예의전당', url: '/archive/hall-of-fame', newTab: true },
            { type: 'item', name: '왕조일람', url: '/archive/emperior', newTab: true }
          ]
        },
        {
          type: 'item',
          name: '연감',
          url: '/history',
          newTab: true
        },
        {
          type: 'split',
          name: '게시판',
          main: {
            name: '게시판',
            url: '/board/community',
            newTab: true
          },
          subMenu: [
            { type: 'item', name: '건의/제안', url: '/board/request', newTab: true },
            { type: 'item', name: '팁/강좌', url: '/board/tip', newTab: true },
            { type: 'line' },
            { type: 'item', name: '패치 내역', url: '/board/patch', newTab: true }
          ]
        },
        {
          type: 'split',
          name: '공식 오픈 톡',
          main: {
            name: '공식 오픈 톡',
            url: 'https://open.kakao.com/o/',
            newTab: true
          },
          subMenu: [
            { type: 'item', name: '잡담 오픈 톡', url: 'https://open.kakao.com/o/', newTab: true }
          ]
        },
        {
          type: 'item',
          name: '전투 시뮬레이터',
          url: '/battle-simulator',
          newTab: true
        },
        {
          type: 'multi',
          name: '기타 정보',
          subMenu: [
            { type: 'item', name: '접속량정보', url: '/archive/traffic', newTab: true },
            { type: 'item', name: '빙의일람', url: '/archive/npc-list', newTab: true, condShowVar: 'npcMode' }
          ]
        },
        {
          type: 'item',
          name: '설문조사',
          url: '/vote',
          newTab: true,
          condHighlightVar: 'vote'
        }
      ];

      return {
        success: true,
        result: true,
        menu,
        version: 2
      };
    } catch (error: any) {
      console.error('GetGlobalMenu error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
