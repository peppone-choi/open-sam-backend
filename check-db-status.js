const mongoose = require('mongoose');

async function checkDBStatus() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samodev');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('\n=== 데이터베이스 상태 ===\n');
    console.log('컬렉션 목록:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  ${col.name}: ${count}개`);
    }
    
    // 세션 확인
    const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }), 'sessions');
    const session = await Session.findOne({ session_id: 'sangokushi_default' });
    
    if (session) {
      console.log('\n=== 세션 정보 ===');
      console.log(`세션 ID: ${session.session_id}`);
      console.log(`이름: ${session.name || '없음'}`);
      console.log(`시나리오: ${session.data?.scenario || '없음'}`);
      console.log(`turnterm: ${session.data?.game_env?.turnterm || session.data?.turnterm || session.turnterm || '없음'}`);
    } else {
      console.log('\n세션이 없습니다!');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDBStatus();
