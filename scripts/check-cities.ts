/**
 * 도시 확인 스크립트
 * DB에 도시가 저장되었는지 확인합니다.
 */

import mongoose from 'mongoose';
import { City } from '../src/models/city.model';

async function main() {
  const sessionId = process.argv[2] || 'sangokushi_default';
  
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';
    await mongoose.connect(mongoUri);
    console.log('MongoDB 연결 성공');

    // 도시 개수 확인
    const cityCount = await (City as any).countDocuments({ session_id: sessionId });
    console.log(`\n📊 도시 개수: ${cityCount}개\n`);
    
    if (cityCount > 0) {
      // 샘플 도시 5개 조회
      const sampleCities = await (City as any).find({ session_id: sessionId })
        .limit(5)
        .select('city name nation level')
        .lean();
      
      console.log('📋 샘플 도시 목록:');
      sampleCities.forEach((city: any) => {
        console.log(`  - ${city.city}: ${city.name} (국가: ${city.nation}, 등급: ${city.level})`);
      });
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




