// MongoDB 인덱스 수정 스크립트
// 기존 잘못된 인덱스 삭제 후 올바른 인덱스 생성

require('dotenv').config();
const mongoose = require('mongoose');

async function fixIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
    await mongoose.connect(mongoUri);
    console.log('MongoDB 연결 성공');

    const db = mongoose.connection.db;
    
    // 1. general_turns 인덱스 수정
    console.log('\n=== general_turns 인덱스 수정 ===');
    const turnCollection = db.collection('general_turns');

    // 기존 인덱스 목록 확인
    const turnIndexes = await turnCollection.indexes();
    console.log('현재 인덱스 목록:');
    turnIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // 기존 잘못된 인덱스 삭제
    try {
      await turnCollection.dropIndex('session_id_1_data.id_1');
      console.log('✅ 기존 인덱스 삭제: session_id_1_data.id_1');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  기존 인덱스가 없거나 이미 삭제됨');
      } else {
        throw err;
      }
    }

    // 올바른 인덱스 생성
    try {
      await turnCollection.createIndex(
        { session_id: 1, 'data.general_id': 1, 'data.turn_idx': 1 },
        { unique: true, name: 'session_general_turn_unique' }
      );
      console.log('✅ 새 인덱스 생성: session_id + data.general_id + data.turn_idx');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  새 인덱스가 이미 존재함');
      } else {
        throw err;
      }
    }

    // 2. general_records 인덱스 수정
    console.log('\n=== general_records 인덱스 수정 ===');
    const recordCollection = db.collection('general_records');

    // 기존 인덱스 목록 확인
    const recordIndexes = await recordCollection.indexes();
    console.log('현재 인덱스 목록:');
    recordIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // 기존 잘못된 유니크 인덱스 삭제
    try {
      await recordCollection.dropIndex('session_id_1_data.id_1');
      console.log('✅ 기존 인덱스 삭제: session_id_1_data.id_1');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  기존 인덱스가 없거나 이미 삭제됨');
      } else {
        throw err;
      }
    }

    // 올바른 인덱스 생성 (유니크 아님)
    try {
      await recordCollection.createIndex(
        { session_id: 1, 'data.general_id': 1, 'data.log_type': 1, 'data.year': 1, 'data.month': 1 },
        { name: 'session_general_logtype_date' }
      );
      console.log('✅ 새 인덱스 생성: session_id + data.general_id + data.log_type + data.year + data.month');
      
      await recordCollection.createIndex(
        { session_id: 1, 'data.general_id': 1, 'data.log_type': 1 },
        { name: 'session_general_logtype' }
      );
      console.log('✅ 새 인덱스 생성: session_id + data.general_id + data.log_type');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  새 인덱스가 이미 존재함');
      } else {
        throw err;
      }
    }

    // 최종 인덱스 목록 확인
    console.log('\n=== 최종 인덱스 목록 ===');
    const finalTurnIndexes = await turnCollection.indexes();
    console.log('\ngeneral_turns:');
    finalTurnIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    const finalRecordIndexes = await recordCollection.indexes();
    console.log('\ngeneral_records:');
    finalRecordIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ 인덱스 수정 완료');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 에러:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixIndexes();
