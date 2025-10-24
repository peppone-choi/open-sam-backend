export const GameConfig = {
  GAME_SPEED: 24,
  
  TIME: {
    TICK_INTERVAL: 1000,
    PERSIST_INTERVAL: 300000,
  },
  
  CACHE: {
    L1_TTL: 3,
    L2_TTL: 300,
  },
  
  COMMAND: {
    TRAIN_COST: { pcp: 5, mcp: 0, time: 3600 },
    MOVE_COST: { pcp: 2, mcp: 0, time: 1800 },
    RECRUIT_COST: { pcp: 0, mcp: 10, time: 7200 },
  },
  
  CP_RECOVERY: {
    PCP_PER_TICK: 0.1,
    MCP_PER_TICK: 0.05,
  }
};

export const TimeUtil = {
  toGameTime(realMs: number): number {
    return realMs * GameConfig.GAME_SPEED;
  },
  
  toRealMs(gameMs: number): number {
    return gameMs / GameConfig.GAME_SPEED;
  }
};
