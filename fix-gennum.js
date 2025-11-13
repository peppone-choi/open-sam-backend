// gennum 재계산 스크립트
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';

async function fixGennum() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB 연결 성공');

    const db = mongoose.connection.db;
    
    // 세션별로 처리
    const sessions = await db.collection('sessions').find({}).toArray();
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      console.log(`\n세션 처리: ${sessionId}`);
      
      // 각 국가별 장수 수 계산
      const generals = await db.collection('generals').find({ session_id: sessionId }).toArray();
      const nationCounts = {};
      
      for (const general of generals) {
        const nationId = general.data?.nation || general.nation || 0;
        nationCounts[nationId] = (nationCounts[nationId] || 0) + 1;
      }
      
      console.log('국가별 장수 수:', nationCounts);
      
      // 각 국가의 gennum 업데이트
      for (const [nationId, count] of Object.entries(nationCounts)) {
        if (nationId == 0) continue; // 재야는 제외
        
        const result = await db.collection('nations').updateOne(
          { session_id: sessionId, 'data.nation': parseInt(nationId) },
          { $set: { 'data.gennum': count } }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`  국가 ${nationId}: gennum = ${count} 업데이트`);
        }
      }
    }

    console.log('\n✅ gennum 재계산 완료');
    await mongoose.disconnect();
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

fixGennum();
