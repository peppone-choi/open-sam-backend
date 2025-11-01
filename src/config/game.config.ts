/**
 * 게임 서버 설정
 */

export const GameConfig = {
  // 게임 모드 (서버 전체 설정)
  GAME_MODE: (process.env.GAME_MODE || 'turn') as 'turn' | 'realtime',
  
  // 턴제 설정
  TURN_DEFAULT_HOUR: 21,      // 기본 턴 시각: 21시
  TURN_DEFAULT_MINUTE: 0,
  
  // 리얼타임 설정
  REALTIME_SPEED: 1,          // 1배속 (나중에 조절 가능)
  
  // 공통
  SERVER_NAME: process.env.SERVER_NAME || '삼국지 서버',
  MAX_GENERALS_PER_USER: 3,
} as const;
