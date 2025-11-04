/**
 * 도시 초기화 스크립트
 * 세션의 도시 데이터를 초기화합니다.
 */

import mongoose from 'mongoose';
import { InitService } from '../src/services/init.service';
import { SessionService } from '../src/services/session.service';
import { Session } from '../src/models/session.model';

async function main() {
  const sessionId = process.argv[2] || 'sangokushi_default';
  
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';
    await mongoose.connect(mongoUri);
    console.log('MongoDB 연결 성공');

    // 세션이 없으면 생성
    let session = await (Session as any).findOne({ session_id: sessionId });
    if (!session) {
      console.log('세션이 없어 생성 중...');
      const sessionData = await SessionService.createDefaultSangokushi();
      // DB에 직접 저장 (스크립트에서는 데몬이 없으므로)
      session = await (Session as any).create(sessionData);
      console.log('세션 생성 완료');
    }

    // 도시 초기화
    await InitService.initializeSession(sessionId);
    
    console.log(`✅ 세션 ${sessionId}의 도시 초기화 완료`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 오류 발생:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

