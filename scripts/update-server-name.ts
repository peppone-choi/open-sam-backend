import mongoose from 'mongoose';
import { sessionRepository } from '../src/repositories/session.repository';

/**
 * sangokushi_default 서버 이름을 OpenSAM으로 업데이트
 */
async function updateDefaultServerName() {
  try {
    const mongoUrl = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/sangokushi';
    console.log('🔌 MongoDB 연결 중:', mongoUrl);
    await mongoose.connect(mongoUrl);
    
    const session = await sessionRepository.findBySessionId('sangokushi_default');
    if (!session) {
      console.log('⚠️  sangokushi_default 서버를 찾을 수 없습니다');
      process.exit(1);
    }
    
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    const oldName = session.data.game_env.serverName || session.data.game_env.scenario || 'sangokushi_default';
    session.data.game_env.serverName = 'OpenSAM';
    
    await sessionRepository.saveDocument(session);
    
    console.log(`✅ 서버 이름 업데이트 완료: "${oldName}" → "OpenSAM"`);
    
    await mongoose.disconnect();
    console.log('🔌 MongoDB 연결 종료');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

updateDefaultServerName();
