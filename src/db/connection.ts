import mongoose from 'mongoose';
import { logger } from '../common/logger';
import { configManager } from '../config/ConfigManager';

export class MongoConnection {
  private static instance: MongoConnection;
  private isConnected = false;

  private constructor() {}

  static getInstance(): MongoConnection {
    if (!MongoConnection.instance) {
      MongoConnection.instance = new MongoConnection();
    }
    return MongoConnection.instance;
  }

  async connect(uri?: string): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    const { mongodbUri } = configManager.get().system;
    const mongoUri = uri || mongodbUri || 'mongodb://localhost:27017/sangokushi';
    
    try {
      await mongoose.connect(mongoUri, {
        // 연결 풀링 최적화
        maxPoolSize: 50,          // 최대 연결 수 (기본값 5 → 50)
        minPoolSize: 10,          // 최소 연결 수 (유휴 상태에서도 유지)
        maxIdleTimeMS: 30000,     // 유휴 연결 유지 시간 (30초)
        
        // 자동 재연결 설정
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        
        // 쓰기 성능 최적화
        writeConcern: {
          w: 1,                   // 단일 노드 확인 (속도 우선)
          j: false                // 저널 확인 비활성화 (속도 우선)
        }
      });
      this.isConnected = true;
      logger.info('MongoDB connected successfully');

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB disconnected - attempting to reconnect...');
        
        // 자동 재연결 시도 (5초 후)
        setTimeout(() => {
          if (!this.isConnected) {
            logger.info('Attempting MongoDB reconnection...');
            this.connect(mongoUri).catch(err => {
              logger.error('MongoDB reconnection failed:', err);
            });
          }
        }, 5000);
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        logger.info('MongoDB reconnected successfully');
      });
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    await mongoose.disconnect();
    this.isConnected = false;
    logger.info('MongoDB disconnected');
  }

  getStatus(): boolean {
    return this.isConnected;
  }

  getConnection(): typeof mongoose {
    return mongoose;
  }
}

export const mongoConnection = MongoConnection.getInstance();
