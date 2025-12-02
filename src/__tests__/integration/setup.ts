/**
 * 통합 테스트 설정 파일
 * MongoDB Memory Server와 테스트 헬퍼 제공
 */

/// <reference types="jest" />

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Express } from 'express';
import jwt from 'jsonwebtoken';

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
process.env.CACHE_ENABLE_REDIS = 'false'; // 테스트에서 Redis 비활성화

let mongoServer: MongoMemoryServer;

/**
 * MongoDB Memory Server 시작
 */
export async function setupTestDatabase(): Promise<string> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.TEST_MONGODB_URI = uri;
  return uri;
}

/**
 * MongoDB 연결
 */
export async function connectTestDatabase(uri?: string): Promise<void> {
  const mongoUri = uri || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MongoDB URI가 필요합니다');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
}

/**
 * 테스트 데이터베이스 정리
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

/**
 * MongoDB 연결 해제 및 서버 종료
 */
export async function teardownTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * 테스트용 JWT 토큰 생성
 */
export function createTestToken(payload: {
  userId: string;
  username: string;
  grade?: number;
}): string {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      grade: payload.grade || 1,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

/**
 * 테스트용 세션 데이터 생성
 */
export function createTestSession(overrides?: Partial<any>) {
  return {
    session_id: 'test_session',
    name: '테스트 서버',
    game_mode: 'sangokushi',
    status: 'running',
    data: {
      year: 184,
      month: 1,
      turn: 1,
      turnterm: 60,
      turntime: new Date().toISOString(),
      starttime: Date.now(),
    },
    resources: {
      gold: { min: 0, max: 999999999, display_name: '금' },
      rice: { min: 0, max: 999999999, display_name: '쌀' },
    },
    attributes: {
      leadership: { min: 1, max: 150, display_name: '통솔' },
      strength: { min: 1, max: 150, display_name: '무력' },
      intel: { min: 1, max: 150, display_name: '지력' },
    },
    ...overrides,
  };
}

/**
 * 테스트용 유저 데이터 생성
 */
export function createTestUser(overrides?: Partial<any>) {
  const timestamp = Date.now();
  return {
    username: `testuser_${timestamp}`,
    password: 'test1234',
    name: 'Test User',
    grade: 1,
    ...overrides,
  };
}

/**
 * 테스트용 장수 데이터 생성
 */
export function createTestGeneral(overrides?: Partial<any>) {
  const timestamp = Date.now();
  return {
    session_id: 'test_session',
    no: Math.floor(Math.random() * 10000),
    name: `장수_${timestamp}`,
    owner: null,
    npc: 0,
    data: {
      nation: 1,
      city: 1,
      leadership: 80,
      strength: 70,
      intel: 60,
      gold: 1000,
      rice: 500,
      crew: 1000,
      crewtype: 1,
      train: 80,
      atmos: 80,
      experience: 0,
      explevel: 0,
      officer_level: 0,
      ...overrides?.data,
    },
    ...overrides,
  };
}

/**
 * 테스트용 국가 데이터 생성
 */
export function createTestNation(overrides?: Partial<any>) {
  return {
    session_id: 'test_session',
    nation: 1,
    name: '테스트 국가',
    data: {
      nation: 1,
      name: '테스트 국가',
      color: 1,
      capital: 1,
      level: 1,
      gold: 10000,
      rice: 5000,
      type: 'None',
      ...overrides?.data,
    },
    ...overrides,
  };
}

/**
 * 테스트용 도시 데이터 생성
 */
export function createTestCity(overrides?: Partial<any>) {
  return {
    session_id: 'test_session',
    city: 1,
    name: '테스트 도시',
    data: {
      city: 1,
      name: '테스트 도시',
      nation: 1,
      region: 1,
      level: 1,
      pop: 5000,
      pop_max: 10000,
      agri: 5000,
      agri_max: 10000,
      comm: 5000,
      comm_max: 10000,
      secu: 5000,
      secu_max: 10000,
      def: 5000,
      def_max: 10000,
      wall: 3000,
      wall_max: 10000,
      trust: 50,
      ...overrides?.data,
    },
    ...overrides,
  };
}

/**
 * 테스트 타임아웃 설정 (Jest 기본 30초)
 */
export const TEST_TIMEOUT = 30000;

/**
 * 비동기 대기 헬퍼
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

