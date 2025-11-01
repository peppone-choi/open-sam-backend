import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi');
    console.log('✅ MongoDB 연결 성공');
    
    // 세션 확인
    const sessions = await mongoose.connection.db.collection('sessions').find({}).toArray();
    console.log(`\n📋 세션 목록 (${sessions.length}개):`);
    for (const session of sessions) {
      console.log(`  - ${session.session_id}: ${session.name}`);
      console.log(`    Cities: ${Object.keys(session.cities || {}).length}개`);
    }
    
    // 도시 확인
    const cities = await mongoose.connection.db.collection('cities').find({}).toArray();
    console.log(`\n🏙️  도시 목록 (${cities.length}개):`);
    
    const cityBySession = {};
    for (const city of cities) {
      if (!cityBySession[city.session_id]) {
        cityBySession[city.session_id] = [];
      }
      cityBySession[city.session_id].push(city);
    }
    
    for (const [sessionId, cities] of Object.entries(cityBySession)) {
      console.log(`  - ${sessionId}: ${cities.length}개`);
      console.log(`    샘플: ${cities.slice(0, 3).map(c => c.name).join(', ')}`);
    }
    
    if (cities.length === 0) {
      console.log('\n❌ 도시가 없습니다!');
      console.log('\n세션 데이터 샘플:');
      if (sessions.length > 0) {
        const s = sessions[0];
        console.log(`  session_id: ${s.session_id}`);
        console.log(`  name: ${s.name}`);
        console.log(`  cities 키 개수: ${Object.keys(s.cities || {}).length}`);
        if (s.cities) {
          const firstKey = Object.keys(s.cities)[0];
          console.log(`  첫 번째 도시 키: ${firstKey}`);
          console.log(`  첫 번째 도시: ${JSON.stringify(s.cities[firstKey]).substring(0, 200)}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

test();
