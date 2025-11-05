import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import { mountRoutes } from './api';
import { errorMiddleware } from './common/middleware/error.middleware';
import { requestLogger } from './common/middleware/request-logger.middleware';
import { logger } from './common/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoConnection.getStatus(),
    uptime: process.uptime()
  });
});

// Mount all routes
mountRoutes(app);

// Error handling middleware (last)
app.use(errorMiddleware);

async function start() {
  try {
    console.log('🚀 [1/4] Starting OpenSAM Backend (Simplified Mode)...');
    logger.info('🚀 Starting OpenSAM Backend (Simplified Mode)...', {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT,
      nodeVersion: process.version
    });

    // MongoDB connection
    console.log('📦 [2/4] Connecting to MongoDB...');
    logger.info('📦 Connecting to MongoDB...');
    await mongoConnection.connect(process.env.MONGODB_URI);
    console.log('✅ [3/4] MongoDB connected successfully');
    logger.info('✅ MongoDB connected successfully');
    
    // Start server
    console.log(`🎯 [4/4] Starting HTTP server on port ${PORT}...`);
    app.listen(PORT, () => {
      logger.info('🎮 OpenSAM Backend is running!', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        mongodbUri: process.env.MONGODB_URI?.replace(/\/\/.*:.*@/, '//***:***@') || 'mongodb://localhost:27017/sangokushi',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001'
      });
      console.log('\n╔════════════════════════════════════════════╗');
      console.log('║   🚀 OpenSAM Backend Server Started! 🚀   ║');
      console.log('╚════════════════════════════════════════════╝');
      console.log(`\n📍 Server URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Active Routes: 20 endpoints\n`);
      console.log('📚 Available Endpoints:');
      console.log('   - /api/auth       (Authentication)');
      console.log('   - /api/command    (Command System)');
      console.log('   - /api/nation     (Nation Management)');
      console.log('   - /api/general    (General Management)');
      console.log('   - /api/game       (Game Core)');
      console.log('   - /api/troop      (Military Units)');
      console.log('   - /api/battle     (Battle System)');
      console.log('   - /api/message    (Messaging)');
      console.log('   - /api/auction    (Auctions)');
      console.log('   - /api/betting    (Betting)');
      console.log('   - /api/vote       (Voting)');
      console.log('   - And more...\n');
    });
  } catch (error) {
    logger.error('❌ Server startup failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Process error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('⚠️  Unhandled Promise Rejection', {
    reason: String(reason),
    promise: String(promise)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('⚠️  Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await mongoConnection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await mongoConnection.disconnect();
  process.exit(0);
});

start();
