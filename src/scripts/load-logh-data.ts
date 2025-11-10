/**
 * LOGH 시나리오 데이터 로드 스크립트
 * 
 * 사용법:
 *   npx ts-node src/scripts/load-logh-data.ts [session_id]
 */

import mongoose from 'mongoose';
import { LoadScenarioDataService } from '../services/logh/LoadScenarioData.service';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sam3';

async function main() {
  try {
    // MongoDB 연결
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // 세션 ID 가져오기
    const sessionId = process.argv[2] || 'logh_test_session';
    console.log(`\n[LOGH] Loading data for session: ${sessionId}\n`);

    // 데이터 로더 서비스 생성
    const loader = new LoadScenarioDataService();

    // 기존 데이터 삭제
    console.log('[LOGH] Clearing existing data...');
    await loader.clearSession(sessionId);

    // 새 데이터 로드
    console.log('[LOGH] Loading new data...\n');
    await loader.loadAll(sessionId);

    console.log('\n[LOGH] ✓ Data loading completed successfully!');
    console.log(`\nSession ID: ${sessionId}`);
    console.log('You can now start the game with this session.\n');

  } catch (error) {
    console.error('\n[LOGH] ✗ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
