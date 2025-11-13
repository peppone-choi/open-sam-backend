// join_mode 설정 추가 스크립트
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';

async function fixJoinMode() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB 연결 성공');

    const db = mongoose.connection.db;
    const collection = db.collection('sessions');

    // 모든 세션에 join_mode 추가
    const result = await collection.updateMany(
      { 'data.game_env.join_mode': { $exists: false } },
      { $set: { 'data.game_env.join_mode': 'full' } }
    );

    console.log(`✅ ${result.modifiedCount}개 세션에 join_mode='full' 추가 완료`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

fixJoinMode();
