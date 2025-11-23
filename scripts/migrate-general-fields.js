/**
 * General 필드 정리 마이그레이션 스크립트
 * 
 * 목적:
 * 1. 인덱스 필드 (no, nation, city, owner) → 최상위 유지
 * 2. 동적 데이터 (name, leadership, gold 등) → data로 이동
 * 3. 중복 제거 및 일관성 확보
 * 
 * 실행:
 * node scripts/migrate-general-fields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MIGRATION_VERSION = '002_general_fields_unification';

// 인덱스 필드 (최상위 유지)
const INDEX_FIELDS = ['no', 'session_id', 'owner', 'nation', 'city', 'npc'];

// data로 이동할 필드 (동적 게임 데이터)
const DATA_FIELDS = [
  'name', 'picture',
  'leadership', 'strength', 'intel', 'politics', 'charm',
  'leadership_exp', 'strength_exp', 'intel_exp',
  'gold', 'rice', 'crew', 'crewtype',
  'experience', 'dedication', 'train', 'atmos', 'injury',
  'officer_level', 'troop', 'weapon', 'book', 'horse', 'special', 'personal',
  'killcnt', 'killcrew', 'donekill', 'winnercnt', 'donewin',
  'dead', 'dex1', 'dex2', 'dex3', 'dex4', 'dex5',
  'dedicated', 'belong', 'betray', 'penalty', 'con', 'leadership_train'
];

async function main() {
  try {
    console.log('🚀 General 필드 마이그레이션 시작...\n');
    
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/opensam';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB 연결 성공\n');
    
    const db = mongoose.connection.db;
    const generalsCollection = db.collection('generals');
    
    // 1. 현재 상태 분석
    console.log('📊 현재 General 데이터 분석 중...');
    const totalGenerals = await generalsCollection.countDocuments();
    const withTopLevelLeadership = await generalsCollection.countDocuments({ leadership: { $exists: true } });
    const withDataLeadership = await generalsCollection.countDocuments({ 'data.leadership': { $exists: true } });
    const withTopLevelNo = await generalsCollection.countDocuments({ no: { $exists: true } });
    const withDataNo = await generalsCollection.countDocuments({ 'data.no': { $exists: true } });
    
    console.log(`  전체 장수: ${totalGenerals}개`);
    console.log(`  - 최상위 no: ${withTopLevelNo}개`);
    console.log(`  - data.no: ${withDataNo}개`);
    console.log(`  - 최상위 leadership: ${withTopLevelLeadership}개`);
    console.log(`  - data.leadership: ${withDataLeadership}개\n`);
    
    // 2. 백업 생성
    console.log('💾 백업 생성 중...');
    const backupCollectionName = `generals_backup_${Date.now()}`;
    const generals = await generalsCollection.find({}).toArray();
    if (generals.length > 0) {
      await db.collection(backupCollectionName).insertMany(generals);
    }
    console.log(`✅ 백업 완료: ${backupCollectionName}\n`);
    
    // 3. 마이그레이션 실행
    console.log('🔄 필드 정리 시작...\n');
    
    let migrated = 0;
    let batchSize = 100;
    
    for (let i = 0; i < generals.length; i += batchSize) {
      const batch = generals.slice(i, i + batchSize);
      const bulkOps = [];
      
      for (const general of batch) {
        const updates = {};
        const unsets = {};
        
        // 3-1. 인덱스 필드 확보 (최상위 유지)
        for (const field of INDEX_FIELDS) {
          let value = general[field];
          
          // 최상위에 없으면 data에서 가져오기
          if (value === undefined && general.data?.[field] !== undefined) {
            value = general.data[field];
            updates[field] = value;
          }
          
          // data에도 저장 (중복이지만 일관성 위해)
          if (value !== undefined) {
            updates[`data.${field}`] = value;
          }
        }
        
        // 3-2. 동적 필드 → data로 이동
        for (const field of DATA_FIELDS) {
          let value = general[field];
          
          // 최상위에 있으면 data로 복사
          if (value !== undefined) {
            updates[`data.${field}`] = value;
            
            // 최상위에서는 제거 (인덱스 필드가 아니므로)
            if (!INDEX_FIELDS.includes(field)) {
              unsets[field] = '';
            }
          }
          
          // 최상위에 없으면 data에서 값 확인
          if (value === undefined && general.data?.[field] !== undefined) {
            // 이미 data에 있음 - 아무것도 안 함
          }
        }
        
        // 3-3. 턴타임 필드 처리
        if (general.turntime !== undefined) {
          updates['data.turntime'] = general.turntime;
          // turntime은 최상위에도 유지 (쿼리 성능)
        }
        
        if (general.custom_turn_hour !== undefined) {
          updates['data.custom_turn_hour'] = general.custom_turn_hour;
          unsets['custom_turn_hour'] = '';
        }
        
        if (general.custom_turn_minute !== undefined) {
          updates['data.custom_turn_minute'] = general.custom_turn_minute;
          unsets['custom_turn_minute'] = '';
        }
        
        // 3-4. aux, rank 필드 → data로 통합
        if (general.aux && Object.keys(general.aux).length > 0) {
          updates['data.aux'] = general.aux;
          unsets['aux'] = '';
        }
        
        if (general.rank && Object.keys(general.rank).length > 0) {
          updates['data.rank'] = general.rank;
          unsets['rank'] = '';
        }
        
        if (general.special2 !== undefined) {
          updates['data.special2'] = general.special2;
          unsets['special2'] = '';
        }
        
        // 업데이트 작업 추가
        const updateOperation = {};
        if (Object.keys(updates).length > 0) {
          updateOperation.$set = updates;
        }
        if (Object.keys(unsets).length > 0) {
          updateOperation.$unset = unsets;
        }
        
        if (Object.keys(updateOperation).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: { _id: general._id },
              update: updateOperation
            }
          });
        }
      }
      
      // 배치 업데이트 실행
      if (bulkOps.length > 0) {
        await generalsCollection.bulkWrite(bulkOps);
        migrated += bulkOps.length;
        console.log(`  진행: ${Math.min(i + batchSize, generals.length)}/${generals.length} (${bulkOps.length}개 업데이트)`);
      }
    }
    
    console.log(`\n✅ 마이그레이션 완료: ${migrated}/${totalGenerals}개 장수 업데이트됨\n`);
    
    // 4. 결과 검증
    console.log('🔍 마이그레이션 결과 검증 중...');
    const afterTopLevelLeadership = await generalsCollection.countDocuments({ leadership: { $exists: true } });
    const afterDataLeadership = await generalsCollection.countDocuments({ 'data.leadership': { $exists: true } });
    const afterTopLevelNo = await generalsCollection.countDocuments({ no: { $exists: true } });
    const afterDataNo = await generalsCollection.countDocuments({ 'data.no': { $exists: true } });
    
    console.log(`  최상위 no: ${withTopLevelNo} → ${afterTopLevelNo} (목표: ${totalGenerals})`);
    console.log(`  data.no: ${withDataNo} → ${afterDataNo} (목표: ${totalGenerals})`);
    console.log(`  최상위 leadership: ${withTopLevelLeadership} → ${afterTopLevelLeadership} (목표: 0)`);
    console.log(`  data.leadership: ${withDataLeadership} → ${afterDataLeadership}\n`);
    
    // 5. 인덱스 생성
    console.log('📇 인덱스 생성 중...');
    await generalsCollection.createIndex({ session_id: 1, no: 1 }, { unique: true });
    await generalsCollection.createIndex({ session_id: 1, owner: 1 });
    await generalsCollection.createIndex({ session_id: 1, nation: 1 });
    await generalsCollection.createIndex({ session_id: 1, city: 1 });
    console.log('✅ 인덱스 생성 완료\n');
    
    // 6. 마이그레이션 기록 저장
    const migrationsCollection = db.collection('migrations');
    await migrationsCollection.insertOne({
      version: MIGRATION_VERSION,
      name: 'General 필드 정리',
      executed_at: new Date(),
      backup_collection: backupCollectionName,
      generals_migrated: migrated,
      total_generals: totalGenerals
    });
    
    console.log('✅ 마이그레이션 기록 저장 완료\n');
    console.log('🎉 모든 작업 완료!');
    console.log(`\n💡 롤백 방법:`);
    console.log(`   db.generals.drop()`);
    console.log(`   db.${backupCollectionName}.rename('generals')\n`);
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
