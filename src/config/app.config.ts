import dotenv from 'dotenv';

dotenv.config();

export const AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '3000', 10),
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://sangokushi:password@localhost:5432/sangokushi_db',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    streamsGroup: process.env.REDIS_STREAMS_GROUP || 'game-daemon',
  },
  
  cache: {
    l1Ttl: parseInt(process.env.L1_CACHE_TTL || '3', 10),
    l2Ttl: parseInt(process.env.L2_CACHE_TTL || '60', 10),
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  game: {
    loopInterval: parseInt(process.env.GAME_LOOP_INTERVAL || '100', 10),
    turnDurationHours: parseInt(process.env.TURN_DURATION_HOURS || '24', 10),
    speedMultiplier: parseInt(process.env.GAME_SPEED_MULTIPLIER || '24', 10),
  },
};
