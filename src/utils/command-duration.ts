/**
 * 커맨드별 실행 시간 (초 단위)
 * 
 * SAM의 턴 시간을 실시간으로 변환
 * 예: 1턴 = 60초
 */

export const COMMAND_DURATION: Record<string, number> = {
  // 즉시 실행
  'rest': 0,
  
  // 이동 (거리에 따라 다름, 기본 5분)
  'move': 300,
  'return_home': 300,
  
  // 군사 (10분)
  'recruit': 600,
  'train': 600,
  'deploy': 600,
  
  // 내정 (30분)
  'farm': 1800,
  'invest_commerce': 1800,
  'improve_security': 1800,
  'repair_walls': 1800,
  
  // 인사 (즉시)
  'recruit_officer': 0,
  'join_nation': 0,
  'found_nation': 0,
  
  // 경제 (즉시)
  'trade_food': 0,
  'gift': 0,
  
  // 국가 커맨드
  'assign': 0,
  'reward': 0,
  'relocate_capital': 3600, // 1시간
  'expand_city': 7200, // 2시간
  
  // 외교 (즉시)
  'declare_war': 0,
  'propose_peace': 0,
  
  // 기본값
  'default': 60
};

export function getCommandDuration(action: string, arg?: any): number {
  // 이동은 거리에 따라 계산
  if (action === 'move' && arg?.distance) {
    return arg.distance * 60; // 1칸당 1분
  }
  
  return COMMAND_DURATION[action] || COMMAND_DURATION['default'];
}
