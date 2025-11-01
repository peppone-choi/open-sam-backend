import mongoose from 'mongoose';
import { logger } from '../common/logger';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

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

    const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
    console.log('🔌 MongoDB URI:', mongoUri);

    try {
      await mongoose.connect(mongoUri);
      this.isConnected = true;
      logger.info('MongoDB connected successfully');

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB disconnected');
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
}

export const mongoConnection = MongoConnection.getInstance();
