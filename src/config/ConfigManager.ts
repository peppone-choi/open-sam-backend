import { logger } from '../common/logger';
import dotenv from 'dotenv';
import path from 'path';

try {
  dotenv.config();
  dotenv.config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

export interface MasterConfig {
  system: {
    nodeEnv: string;
    port: number;
    frontendUrl: string;
    jwtSecret: string;
    jwtRefreshSecret: string;
    mongodbUri: string;
    redisUrl: string;
    redisKeyPrefix: string;
    corsOrigin: string;
    timezone: string;
    sessionId: string;
    serverId: string;
    serverName: string;
    disableCsrf: boolean;
    cookieSecure: boolean;
    cookieSameSite: string;
    hiddenSeed: string;
    seasonIndex: number;
    defaultSessionStartYear: number;
  };
  session: {
    secret: string;
    cookieName: string;
    cookieMaxAgeMs: number;
    ttlSeconds: number;
    redisPrefix: string;
    collectionName: string;
    storeType: 'redis' | 'mongo' | 'memory';
    disablePersistence: boolean;
  };
  rateLimit: {
    globalWindowMs: number;
    globalMax: number;
    authWindowMs: number;
    authMax: number;
    apiWindowMs: number;
    apiMax: number;
  };
  game: {
    mode: 'turn' | 'realtime';
    turnTerm: number;
    maxGeneralsPerUser: number;
    calendar: {
      turnsPerMonth: number;
      monthsPerYear: number;
    };
    balance: {
      defaultGold: number;
      defaultRice: number;
      defaultCrew: number;
      maxGold: number;
      maxRice: number;
      maxCrew: number;
      maxLeadership: number;
      maxStrength: number;
      maxIntel: number;
      maxPolitics: number;
      maxCharm: number;
      maxExperience: number;
      maxDedication: number;
      maxCityFarm: number;
      maxCityComm: number;
      maxCitySec: number;
      maxCityDef: number;
      maxCityWall: number;
      minAvailableRecruitPop: number;
      expandCityPopIncrease: number;
      recruitCostGold: number;
      recruitCostRice: number;
      trainCostGold: number;
      trainCostRice: number;
      researchCostGold: number;
      researchCostRice: number;
      buildCostGold: number;
      buildCostRice: number;
      experienceMultiplier: number;
      dedicationMultiplier: number;
      criticalSuccessRate: number;
      criticalFailRate: number;
      criticalSuccessMultiplier: number;
      criticalFailMultiplier: number;
      exchangeFee: number;
    };
    city: {
      maxTrust: number;
      defaultTrust: number;
      minValue: number;
    };
    unit: {
      defaultTrain: number;
      defaultAtmos: number;
      maxTrain: number;
      maxAtmos: number;
      maxDex: number;
    };
    npc: {
      aiMode: string;
      difficulty: string;
      statMax: number;
      chiefStatMin: number;
    };
  };
  battle: {
    mapWidth: number;
    mapHeight: number;
    tileSize: number;
    maxTurns: number;
    movementCost: number;
    attackCost: number;
    timeoutMs: number;
    hqCommandRadius: number;
    lockTtl: number;
    disconnectGraceMs: number;
    terrainBonus: {
      plains: number;
      forest: number;
      mountain: number;
      water: number;
    };
    weatherBonus: {
      normal: number;
      rain: number;
      snow: number;
    };
    moraleBonus: {
      high: number;
      normal: number;
      low: number;
    };
  };
  daemon: {
    turnIntervalMs: number;
    dbSyncIntervalMs: number;
    autoSaveIntervalMs: number;
    turnProcessorConcurrency: number;
    runImmediately: boolean;
  };
  timeouts: {
    session: number;
    autoSave: number;
    turnProcessing: number;
    battle: number;
  };
  features: {
    enableRedisAdapter: boolean;
    enablePwa: boolean;
    enableCdn: boolean;
    cdnUrl: string;
    enableFileWatcher: boolean;
    enableLegacyProcessWar: boolean;
    forceAutoBattle: boolean;
    enableLoghWebsocket: boolean;
    enableGin7Tactical: boolean;
  };
  oauth: {
    kakao: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      adminKey: string;
    };
  };
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
  };
}

class ConfigManager {
  private config: MasterConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): MasterConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isTest = nodeEnv === 'test';

    return {
      system: {
        nodeEnv,
        port: Number(process.env.PORT || 8080),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key-please-change',
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-please-change',
        mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi',
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
        redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'opensam:',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        timezone: process.env.TZ || 'Asia/Seoul',
        sessionId: process.env.SESSION_ID || 'sangokushi_default',
        serverId: process.env.SERVER_ID || process.env.SESSION_ID || 'opensam_default',
        serverName: process.env.SERVER_NAME || 'OpenSAM',
        disableCsrf: process.env.DISABLE_CSRF === 'true',
        cookieSecure: process.env.COOKIE_SECURE === 'true',
        cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
        hiddenSeed: process.env.SERVER_HIDDEN_SEED || 'opensam_hidden_seed',
        seasonIndex: Number(process.env.SERVER_SEASON_INDEX || 0),
        defaultSessionStartYear: Number(process.env.DEFAULT_SESSION_START_YEAR || 184),
      },
      session: {
        secret: process.env.SESSION_SECRET || 'change-session-secret',
        cookieName: process.env.SESSION_COOKIE_NAME || 'opensam.sid',
        cookieMaxAgeMs: Number(process.env.SESSION_COOKIE_MAX_AGE_MS || 24 * 60 * 60 * 1000),
        ttlSeconds: Number(process.env.SESSION_TTL_SECONDS || 24 * 60 * 60),
        redisPrefix: process.env.SESSION_REDIS_PREFIX || 'opensam:sess:',
        collectionName: process.env.SESSION_COLLECTION || 'app_sessions',
        storeType: (process.env.SESSION_STORE || 'redis') as 'redis' | 'mongo' | 'memory',
        disablePersistence: process.env.SESSION_DISABLE_PERSISTENCE === 'true' || isTest,
      },
      rateLimit: {
        globalWindowMs: Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || 15 * 60 * 1000),
        globalMax: Number(process.env.RATE_LIMIT_GLOBAL_MAX || 1000),
        authWindowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 15 * 60 * 1000),
        authMax: Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
        apiWindowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS || 15 * 60 * 1000),
        apiMax: Number(process.env.RATE_LIMIT_API_MAX || 100),
      },
      game: {
        mode: (process.env.GAME_MODE || 'turn') as 'turn' | 'realtime',
        turnTerm: Number(process.env.GAME_TURN_TERM || 60),
        maxGeneralsPerUser: Number(process.env.MAX_GENERALS_PER_USER || 3),
        calendar: {
          turnsPerMonth: Number(process.env.GAME_TURNS_PER_MONTH || 12),
          monthsPerYear: Number(process.env.GAME_MONTHS_PER_YEAR || 12),
        },
        balance: {
          defaultGold: Number(process.env.GAME_DEFAULT_GOLD || 1000),
          defaultRice: Number(process.env.GAME_DEFAULT_RICE || 1000),
          defaultCrew: Number(process.env.GAME_DEFAULT_CREW || 1000),
          maxGold: Number(process.env.GAME_MAX_GOLD || 1000000),
          maxRice: Number(process.env.GAME_MAX_RICE || 1000000),
          maxCrew: Number(process.env.GAME_MAX_CREW || 50000),
          maxLeadership: Number(process.env.GAME_MAX_LEADERSHIP || 150),
          maxStrength: Number(process.env.GAME_MAX_STRENGTH || 150),
          maxIntel: Number(process.env.GAME_MAX_INTEL || 150),
          maxPolitics: Number(process.env.GAME_MAX_POLITICS || 150),
          maxCharm: Number(process.env.GAME_MAX_CHARM || 150),
          maxExperience: Number(process.env.GAME_MAX_EXPERIENCE || 999999),
          maxDedication: Number(process.env.GAME_MAX_DEDICATION || 999999),
          maxCityFarm: Number(process.env.GAME_MAX_CITY_FARM || 100000),
          maxCityComm: Number(process.env.GAME_MAX_CITY_COMM || 100000),
          maxCitySec: Number(process.env.GAME_MAX_CITY_SEC || 100000),
          maxCityDef: Number(process.env.GAME_MAX_CITY_DEF || 100000),
          maxCityWall: Number(process.env.GAME_MAX_CITY_WALL || 100000),
          minAvailableRecruitPop: Number(process.env.GAME_MIN_RECRUIT_POP || 20000),
          expandCityPopIncrease: Number(process.env.GAME_EXPAND_CITY_POP || 100000),
          recruitCostGold: Number(process.env.GAME_RECRUIT_COST_GOLD || 100),
          recruitCostRice: Number(process.env.GAME_RECRUIT_COST_RICE || 50),
          trainCostGold: Number(process.env.GAME_TRAIN_COST_GOLD || 50),
          trainCostRice: Number(process.env.GAME_TRAIN_COST_RICE || 50),
          researchCostGold: Number(process.env.GAME_RESEARCH_COST_GOLD || 1000),
          researchCostRice: Number(process.env.GAME_RESEARCH_COST_RICE || 500),
          buildCostGold: Number(process.env.GAME_BUILD_COST_GOLD || 500),
          buildCostRice: Number(process.env.GAME_BUILD_COST_RICE || 300),
          experienceMultiplier: Number(process.env.GAME_EXP_MULTIPLIER || 1.0),
          dedicationMultiplier: Number(process.env.GAME_DEDICATION_MULTIPLIER || 1.0),
          criticalSuccessRate: Number(process.env.GAME_CRITICAL_SUCCESS_RATE || 0.1),
          criticalFailRate: Number(process.env.GAME_CRITICAL_FAIL_RATE || 0.1),
          criticalSuccessMultiplier: Number(process.env.GAME_CRITICAL_SUCCESS_MUL || 1.5),
          criticalFailMultiplier: Number(process.env.GAME_CRITICAL_FAIL_MUL || 0.5),
          exchangeFee: Number(process.env.GAME_EXCHANGE_FEE || 0.05),
        },
        city: {
          maxTrust: Number(process.env.GAME_MAX_CITY_TRUST || 100),
          defaultTrust: Number(process.env.GAME_DEFAULT_CITY_TRUST || 50),
          minValue: Number(process.env.GAME_MIN_CITY_VALUE || 0),
        },
        unit: {
          defaultTrain: Number(process.env.GAME_DEFAULT_TRAIN || 50),
          defaultAtmos: Number(process.env.GAME_DEFAULT_ATMOS || 50),
          maxTrain: Number(process.env.GAME_MAX_TRAIN || 100),
          maxAtmos: Number(process.env.GAME_MAX_ATMOS || 100),
          maxDex: Number(process.env.GAME_MAX_DEX || 100),
        },
        npc: {
          aiMode: process.env.NPC_AI_MODE || 'full',
          difficulty: process.env.AI_DIFFICULTY || 'normal',
          statMax: Number(process.env.NPC_STAT_MAX || 80),
          chiefStatMin: Number(process.env.NPC_CHIEF_STAT_MIN || 60),
        }
      },
      battle: {
        mapWidth: Number(process.env.BATTLE_MAP_WIDTH || 800),
        mapHeight: Number(process.env.BATTLE_MAP_HEIGHT || 600),
        tileSize: Number(process.env.BATTLE_TILE_SIZE || 40),
        maxTurns: Number(process.env.BATTLE_MAX_TURNS || 100),
        movementCost: Number(process.env.BATTLE_MOVE_COST || 1),
        attackCost: Number(process.env.BATTLE_ATTACK_COST || 1),
        timeoutMs: Number(process.env.BATTLE_TIMEOUT || 1800000),
        hqCommandRadius: Number(process.env.BATTLE_HQ_RADIUS || 250),
        lockTtl: Number(process.env.BATTLE_LOCK_TTL || 30),
        disconnectGraceMs: Number(process.env.BATTLE_DISCONNECT_GRACE || 60000),
        terrainBonus: {
          plains: Number(process.env.BATTLE_BONUS_PLAINS || 1.0),
          forest: Number(process.env.BATTLE_BONUS_FOREST || 1.1),
          mountain: Number(process.env.BATTLE_BONUS_MOUNTAIN || 1.2),
          water: Number(process.env.BATTLE_BONUS_WATER || 0.8),
        },
        weatherBonus: {
          normal: Number(process.env.BATTLE_WEATHER_NORMAL || 1.0),
          rain: Number(process.env.BATTLE_WEATHER_RAIN || 0.9),
          snow: Number(process.env.BATTLE_WEATHER_SNOW || 0.8),
        },
        moraleBonus: {
          high: Number(process.env.BATTLE_MORALE_HIGH || 1.2),
          normal: Number(process.env.BATTLE_MORALE_NORMAL || 1.0),
          low: Number(process.env.BATTLE_MORALE_LOW || 0.8),
        }
      },
      daemon: {
        turnIntervalMs: Number(process.env.TURN_INTERVAL || 10000),
        dbSyncIntervalMs: Number(process.env.DB_SYNC_INTERVAL || 5000),
        autoSaveIntervalMs: Number(process.env.AUTO_SAVE_INTERVAL || 300000),
        turnProcessorConcurrency: Number(process.env.TURN_SCHEDULER_MAX_CONCURRENCY || 3),
        runImmediately: process.env.TURN_PROCESSOR_RUN_IMMEDIATELY !== 'false',
      },
      timeouts: {
        session: Number(process.env.TIMEOUT_SESSION || 3600000),
        autoSave: Number(process.env.AUTO_SAVE_INTERVAL || 300000),
        turnProcessing: Number(process.env.TIMEOUT_TURN_PROCESS || 60000),
        battle: Number(process.env.TIMEOUT_BATTLE || 1800000),
      },
      features: {
        enableRedisAdapter: process.env.ENABLE_REDIS_ADAPTER === 'true',
        enablePwa: process.env.ENABLE_PWA !== 'false',
        enableCdn: process.env.ENABLE_CDN === 'true',
        cdnUrl: process.env.CDN_URL || '',
        enableFileWatcher: process.env.ENABLE_FILE_WATCHER === '1',
        enableLegacyProcessWar: process.env.ENABLE_LEGACY_PROCESS_WAR !== 'false',
        forceAutoBattle: process.env.FORCE_AUTO_BATTLE !== 'false',
        enableLoghWebsocket: process.env.ENABLE_LOGH_WEBSOCKET !== 'false',
        enableGin7Tactical: process.env.ENABLE_GIN7_TACTICAL !== 'false',
      },
      oauth: {
        kakao: {
          clientId: process.env.KAKAO_CLIENT_ID || '',
          clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
          redirectUri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:8080/api/oauth/kakao/callback',
          adminKey: process.env.KAKAO_ADMIN_KEY || '',
        }
      },
      email: {
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        }
      }
    };
  }

  get(): MasterConfig {
    return this.config;
  }

  reload() {
    this.config = this.loadConfig();
    logger.info('[ConfigManager] Config reloaded from process.env');
  }
}

export const configManager = new ConfigManager();
