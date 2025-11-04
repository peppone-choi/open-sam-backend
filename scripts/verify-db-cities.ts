/**
 * DB 직접 확인 스크립트
 * MongoDB에 실제로 저장되었는지 확인합니다.
 */

import mongoose from 'mongoose';

async function main() {
  const sessionId = process.argv[2] || 'sangokushi_default';
  
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';
    await mongoose.connect(mongoUri);
    console.log('MongoDB 연결 성공\n');

    const db = mongoose.connection.db;
    
    // 컬렉션 목록 확인
    const collections = await db.listCollections().toArray();
    console.log('📋 컬렉션 목록:');
    collections.forEach((col: any) => {
      console.log(`  - ${col.name}`);
    });
    console.log('');

    // cities 컬렉션 직접 확인
    const citiesCollection = db.collection('cities');
    const cityCount = await citiesCollection.countDocuments({ session_id: sessionId });
    console.log(`📊 cities 컬렉션의 도시 개수 (session_id: ${sessionId}): ${cityCount}개\n`);
    
    if (cityCount > 0) {
      // 샘플 도시 5개 조회 (원시 MongoDB 쿼리)
      const sampleCities = await citiesCollection
        .find({ session_id: sessionId })
        .limit(5)
        .project({ city: 1, name: 1, nation: 1, level: 1, _id: 0 })
        .toArray();
      
      console.log('📋 샘플 도시 목록 (MongoDB 직접 조회):');
      sampleCities.forEach((city: any) => {
        console.log(`  - ${city.city}: ${city.name} (국가: ${city.nation}, 등급: ${city.level})`);
      });
      
      // Mongoose를 통한 조회도 비교
      const { City } = await import('../src/models/city.model');
      const mongooseCount = await (City as any).countDocuments({ session_id: sessionId });
      console.log(`\n📊 Mongoose를 통한 도시 개수: ${mongooseCount}개`);
      
      if (cityCount !== mongooseCount) {
        console.log('⚠️  경고: MongoDB 직접 조회와 Mongoose 조회 결과가 다릅니다!');
      } else {
        console.log('✅ MongoDB 직접 조회와 Mongoose 조회 결과가 일치합니다.');
      }
    } else {
      console.log('⚠️  도시가 없습니다. init-cities 스크립트를 실행하세요.');
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 오류 발생:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();



