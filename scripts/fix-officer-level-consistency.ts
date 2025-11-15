/**
 * officer_level과 nation의 일관성을 수정하는 스크립트
 * 
 * PHP 버전의 로직과 동일하게:
 * - nation > 0이면 officer_level은 최소 1이어야 함
 * - nation = 0이면 officer_level은 0이어야 함
 * 
 * 실행: npx ts-node scripts/fix-officer-level-consistency.ts
 */

import mongoose from 'mongoose';
import { generalRepository } from '../src/repositories/general.repository';

async function main() {
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB 연결 성공');

    // 1. nation > 0인데 officer_level = 0인 장수 찾기
    const invalidOfficers = await generalRepository.findByFilter({
      nation: { $gt: 0 },
      officer_level: 0
    });

    console.log(`\n📊 발견된 문제:`);
    console.log(`   - nation > 0인데 officer_level = 0인 장수: ${invalidOfficers.length}명`);

    if (invalidOfficers.length > 0) {
      console.log(`\n🔧 수정 시작...`);
      
      for (const general of invalidOfficers) {
        const sessionId = general.session_id || 'sangokushi_default';
        const generalNo = general.no;
        const name = general.name || general.data?.name || 'Unknown';
        const nation = general.nation || general.data?.nation || 0;
        
        console.log(`   - ${name} (no=${generalNo}, nation=${nation}): officer_level 0 → 1`);
        
        await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
          officer_level: 1,
          'data.officer_level': 1
        });
      }
      
      console.log(`\n✅ ${invalidOfficers.length}명의 officer_level을 수정했습니다.`);
    }

    // 2. nation = 0인데 officer_level > 0인 장수 찾기
    const invalidVagrants = await generalRepository.findByFilter({
      nation: 0,
      officer_level: { $gt: 0 }
    });

    console.log(`\n📊 추가 발견:`);
    console.log(`   - nation = 0인데 officer_level > 0인 장수: ${invalidVagrants.length}명`);

    if (invalidVagrants.length > 0) {
      console.log(`\n🔧 수정 시작...`);
      
      for (const general of invalidVagrants) {
        const sessionId = general.session_id || 'sangokushi_default';
        const generalNo = general.no;
        const name = general.name || general.data?.name || 'Unknown';
        const officerLevel = general.officer_level || general.data?.officer_level || 0;
        
        console.log(`   - ${name} (no=${generalNo}, nation=0): officer_level ${officerLevel} → 0`);
        
        await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
          officer_level: 0,
          'data.officer_level': 0
        });
      }
      
      console.log(`\n✅ ${invalidVagrants.length}명의 officer_level을 수정했습니다.`);
    }

    // 3. 검증
    const stillInvalid = await generalRepository.findByFilter({
      nation: { $gt: 0 },
      officer_level: 0
    });

    console.log(`\n📊 검증 결과:`);
    if (stillInvalid.length === 0) {
      console.log(`   ✅ 모든 데이터가 정상입니다.`);
    } else {
      console.log(`   ⚠️ 여전히 ${stillInvalid.length}명의 문제가 있습니다.`);
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ MongoDB 연결 종료');
  }
}

main();
