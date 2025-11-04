/**
 * Install Service
 * 게임 서버 초기 설정을 담당하는 서비스
 */

import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { SessionService } from './session.service';
import { InitService } from './init.service';
import { mongoConnection } from '../db/connection';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { logger } from '../common/logger';

export interface InstallResult {
  success: boolean;
  message: string;
  userId?: string;
  sessionId?: string;
  details?: any;
}

export class InstallService {
  /**
   * 설치 상태 확인
   */
  static async checkInstallation(): Promise<boolean> {
    try {
      // MongoDB 연결 확인
      if (!mongoConnection.getStatus()) {
        return false;
      }

      // 관리자 계정 존재 확인
      const adminCount = await (User as any).countDocuments({ grade: { $gte: 5 } });
      
      // 기본 세션 존재 확인
      const sessionCount = await (Session as any).countDocuments();
      
      return adminCount > 0 && sessionCount > 0;
    } catch (error: any) {
      logger.error('설치 상태 확인 실패', { error: error.message });
      return false;
    }
  }

  /**
   * 데이터베이스 연결 테스트
   */
  static async testDatabaseConnection(mongodbUri: string): Promise<InstallResult> {
    try {
      // 기존 연결이 있으면 닫기
      if (mongoConnection.getStatus()) {
        await mongoose.disconnect();
      }

      // 새 연결 테스트
      await mongoose.connect(mongodbUri, {
        serverSelectionTimeoutMS: 5000
      });

      // 연결 성공 확인
      const adminDb = mongoose.connection.db?.admin();
      if (adminDb) {
        await adminDb.ping();
      }

      return {
        success: true,
        message: '데이터베이스 연결 성공',
        details: {
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          readyState: mongoose.connection.readyState
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `데이터베이스 연결 실패: ${error.message}`,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * 관리자 계정 생성
   */
  static async createAdminUser(
    username: string,
    password: string,
    name: string
  ): Promise<InstallResult> {
    try {
      // 이미 관리자가 있는지 확인
      const existingAdmin = await (User as any).findOne({ grade: { $gte: 5 } });
      if (existingAdmin) {
        return {
          success: false,
          message: '이미 관리자 계정이 존재합니다'
        };
      }

      // 사용자명 중복 확인
      const existingUser = await (User as any).findOne({ username });
      if (existingUser) {
        return {
          success: false,
          message: '이미 사용 중인 사용자명입니다'
        };
      }

      // 비밀번호 해시
      const hashedPassword = await bcrypt.hash(password, 10);

      // 관리자 계정 생성
      const admin = new (User as any)({
        username,
        password: hashedPassword,
        name,
        grade: 10, // 최고 관리자
        acl: '*', // 모든 권한
        global_salt: this.generateGlobalSalt()
      });

      await admin.save();

      logger.info('관리자 계정 생성 완료', { username, userId: admin._id });

      return {
        success: true,
        message: '관리자 계정이 생성되었습니다',
        userId: admin._id.toString()
      };
    } catch (error: any) {
      logger.error('관리자 계정 생성 실패', { error: error.message });
      return {
        success: false,
        message: `관리자 계정 생성 실패: ${error.message}`
      };
    }
  }

  /**
   * 기본 세션 생성
   */
  static async createDefaultSession(
    sessionId: string,
    sessionName: string,
    scenarioId: string
  ): Promise<InstallResult> {
    try {
      // 이미 세션이 있는지 확인
      const existingSession = await (Session as any).findOne({ session_id: sessionId });
      if (existingSession) {
        return {
          success: false,
          message: '이미 존재하는 세션입니다'
        };
      }

      // 기본 세션 생성
      const session = await SessionService.createDefaultSangokushi();
      
      // 세션 ID와 이름 설정
      session.session_id = sessionId;
      session.name = sessionName;
      session.scenario_id = scenarioId;

      await (Session as any).create(session);

      // 세션 초기화 (도시, 국가 등)
      await InitService.initializeSession(sessionId);

      logger.info('기본 세션 생성 완료', { sessionId, sessionName });

      return {
        success: true,
        message: '기본 세션이 생성되었습니다',
        sessionId
      };
    } catch (error: any) {
      logger.error('기본 세션 생성 실패', { error: error.message });
      return {
        success: false,
        message: `기본 세션 생성 실패: ${error.message}`
      };
    }
  }

  /**
   * 설치 완료 처리
   */
  static async completeInstallation(config?: any): Promise<InstallResult> {
    try {
      // 설치 상태 확인
      const isInstalled = await this.checkInstallation();
      if (!isInstalled) {
        return {
          success: false,
          message: '설치가 완료되지 않았습니다. 관리자 계정과 기본 세션을 생성해주세요.'
        };
      }

      // 설정 저장 (필요한 경우)
      if (config) {
        // 환경 변수나 설정 파일에 저장할 수 있음
        logger.info('설치 설정 저장', { config });
      }

      logger.info('설치 완료');

      return {
        success: true,
        message: '설치가 완료되었습니다'
      };
    } catch (error: any) {
      logger.error('설치 완료 처리 실패', { error: error.message });
      return {
        success: false,
        message: `설치 완료 처리 실패: ${error.message}`
      };
    }
  }

  /**
   * Global Salt 생성
   */
  private static generateGlobalSalt(): string {
    return require('crypto').randomBytes(16).toString('hex');
  }
}


