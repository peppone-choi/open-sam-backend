import { configManager } from './ConfigManager';

const { game, system } = configManager.get();

/**
 * 게임 서버 설정
 */
export const GameConfig = {
  // 게임 모드
  GAME_MODE: game.mode,
  
  // 턴제 설정
  TURN_DEFAULT_HOUR: 21,
  TURN_DEFAULT_MINUTE: 0,
  
  // 리얼타임 설정
  REALTIME_SPEED: 1,
  
  // 공통
  SERVER_NAME: system.serverName,
  MAX_GENERALS_PER_USER: game.maxGeneralsPerUser,
} as const;
