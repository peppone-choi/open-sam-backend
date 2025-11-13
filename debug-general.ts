// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config();

import { mongoConnection } from './src/db/connection';
import { General } from './src/models/general.model';

async function checkGeneral() {
  try {
    await mongoConnection.connect(process.env.MONGODB_URI);
    
    console.log('=== 최근 임관한 장수 확인 ===\n');
    
    // 최근 임관한 장수 찾기 (nation이 0이 아닌 장수)
    const generals = await General.find({
      session_id: 'sangokushi_default',
      $or: [
        { nation: { $ne: 0 } },
        { 'data.nation': { $ne: 0 } }
      ]
    })
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();
    
    console.log(`총 ${generals.length}명의 장수 발견\n`);
    
    for (const gen of generals) {
      const no = gen.no || gen.data?.no;
      const name = gen.name || gen.data?.name;
      const nation = gen.nation || gen.data?.nation;
      const officer_level = gen.data?.officer_level;
      const city = gen.city || gen.data?.city;
      
      console.log(`장수 #${no}: ${name}`);
      console.log(`  국가: ${nation}, 관직: ${officer_level || 0}, 도시: ${city || 0}`);
      console.log(`  최종 수정: ${gen.updatedAt}`);
      console.log('');
    }
    
    await mongoConnection.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('에러:', error.message);
    process.exit(1);
  }
}

checkGeneral();
