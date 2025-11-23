/**
 * Session 필드 정리 마이그레이션 스크립트
 * 
 * 목적:
 * 1. 중복 필드 통합 (isunited, develcost 등)
 * 2. config vs turn_config/realtime_config 정리
 * 3. 누락된 기본값 채우기
 * 
 * 실행:
 * node scripts/migrate-session-fields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MIGRATION_VERSION = '001_session_fields_unification';

async function main() {
  try {
    console.log('🚀 Session 필드 마이그레이션 시작...\n');
    
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/opensam';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB 연결 성공\n');
    
    const db = mongoose.connection.db;
    const sessionsCollection = db.collection('sessions');
    
    // 1. 현재 상태 분석
    console.log('📊 현재 Session 데이터 분석 중...');
    const totalSessions = await sessionsCollection.countDocuments();
    const withTopLevelIsunited = await sessionsCollection.countDocuments({ isunited: { $exists: true } });
    const withDataIsunited = await sessionsCollection.countDocuments({ 'data.isunited': { $exists: true } });
    const withGameEnvIsunited = await sessionsCollection.countDocuments({ 'data.game_env.isunited': { $exists: true } });
    const withTurnConfig = await sessionsCollection.countDocuments({ turn_config: { $exists: true } });
    const withConfig = await sessionsCollection.countDocuments({ config: { $exists: true } });
    
    console.log(`  전체 세션: ${totalSessions}개`);
    console.log(`  - 최상위 isunited: ${withTopLevelIsunited}개`);
    console.log(`  - data.isunited: ${withDataIsunited}개`);
    console.log(`  - data.game_env.isunited: ${withGameEnvIsunited}개`);
    console.log(`  - turn_config: ${withTurnConfig}개`);
    console.log(`  - config: ${withConfig}개\n`);
    
    // 2. 백업 생성
    console.log('💾 백업 생성 중...');
    const backupCollectionName = `sessions_backup_${Date.now()}`;
    const sessions = await sessionsCollection.find({}).toArray();
    await db.collection(backupCollectionName).insertMany(sessions);
    console.log(`✅ 백업 완료: ${backupCollectionName}\n`);
    
    // 3. 마이그레이션 실행
    console.log('🔄 필드 정리 시작...\n');
    
    let migrated = 0;
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      console.log(`  처리 중: ${sessionId}`);
      
      const updates = {};
      const unsets = {};
      
      // 3-1. isunited 필드 통합
      // 우선순위: data.game_env.isunited > isunited > data.isunited
      let finalIsunited = 0;
      
      if (session.data?.game_env?.isunited !== undefined) {
        finalIsunited = session.data.game_env.isunited;
      } else if (session.isunited !== undefined) {
        finalIsunited = session.isunited;
      } else if (session.data?.isunited !== undefined) {
        finalIsunited = session.data.isunited;
      }
      
      updates['data.game_env.isunited'] = finalIsunited;
      
      // 최상위 isunited 제거
      if (session.isunited !== undefined) {
        unsets['isunited'] = '';
      }
      
      // data.isunited 제거
      if (session.data?.isunited !== undefined) {
        unsets['data.isunited'] = '';
      }
      
      // 3-2. develcost 필드 통합
      // 우선순위: data.game_env.develcost > develcost
      let finalDevelcost = 100; // 기본값
      
      if (session.data?.game_env?.develcost !== undefined) {
        finalDevelcost = session.data.game_env.develcost;
      } else if (session.develcost !== undefined) {
        finalDevelcost = session.develcost;
      }
      
      updates['data.game_env.develcost'] = finalDevelcost;
      
      // 최상위 develcost 제거
      if (session.develcost !== undefined) {
        unsets['develcost'] = '';
      }
      
      // 3-3. turn_config/realtime_config → data로 이동
      if (session.turn_config) {
        updates['data.turn_config'] = session.turn_config;
        unsets['turn_config'] = '';
      }
      
      if (session.realtime_config) {
        updates['data.realtime_config'] = session.realtime_config;
        unsets['realtime_config'] = '';
      }
      
      // 3-4. config 필드 처리
      // config가 있으면 data.legacy_config로 이동
      if (session.config && Object.keys(session.config).length > 0) {
        updates['data.legacy_config'] = session.config;
        unsets['config'] = '';
      }
      
      // 3-5. is_locked → data.is_locked
      if (session.is_locked !== undefined) {
        updates['data.is_locked'] = session.is_locked;
        unsets['is_locked'] = '';
      } else {
        // 기본값 설정
        updates['data.is_locked'] = false;
      }
      
      // 3-6. online_user_cnt, online_nation → data로 이동
      if (session.online_user_cnt !== undefined) {
        updates['data.online_user_cnt'] = session.online_user_cnt;
        unsets['online_user_cnt'] = '';
      } else {
        updates['data.online_user_cnt'] = 0;
      }
      
      if (session.online_nation !== undefined) {
        // 배열로 정규화
        const onlineNations = Array.isArray(session.online_nation) 
          ? session.online_nation 
          : (session.online_nation ? [session.online_nation] : []);
        updates['data.online_nation'] = onlineNations;
        unsets['online_nation'] = '';
      } else {
        updates['data.online_nation'] = [];
      }
      
      // 3-7. lastVote → data.lastVote
      if (session.lastVote !== undefined) {
        updates['data.lastVote'] = session.lastVote;
        unsets['lastVote'] = '';
      } else {
        updates['data.lastVote'] = 0;
      }
      
      // 3-8. year, month, turn, turntime → data로 이동 (이미 있을 수도 있음)
      if (session.year !== undefined && session.data?.year === undefined) {
        updates['data.year'] = session.year;
      }
      if (session.month !== undefined && session.data?.month === undefined) {
        updates['data.month'] = session.month;
      }
      if (session.turn !== undefined && session.data?.turn === undefined) {
        updates['data.turn'] = session.turn;
      }
      if (session.turntime !== undefined && session.data?.turntime === undefined) {
        updates['data.turntime'] = session.turntime;
      }
      
      // 업데이트 실행
      const updateOperation = {};
      if (Object.keys(updates).length > 0) {
        updateOperation.$set = updates;
      }
      if (Object.keys(unsets).length > 0) {
        updateOperation.$unset = unsets;
      }
      
      if (Object.keys(updateOperation).length > 0) {
        await sessionsCollection.updateOne(
          { _id: session._id },
          updateOperation
        );
        migrated++;
        console.log(`    ✅ 업데이트 완료`);
      } else {
        console.log(`    ⏭️  변경 사항 없음`);
      }
    }
    
    console.log(`\n✅ 마이그레이션 완료: ${migrated}/${totalSessions}개 세션 업데이트됨\n`);
    
    // 4. 결과 검증
    console.log('🔍 마이그레이션 결과 검증 중...');
    const afterTopLevelIsunited = await sessionsCollection.countDocuments({ isunited: { $exists: true } });
    const afterDataGameEnvIsunited = await sessionsCollection.countDocuments({ 'data.game_env.isunited': { $exists: true } });
    const afterTurnConfig = await sessionsCollection.countDocuments({ turn_config: { $exists: true } });
    const afterDataTurnConfig = await sessionsCollection.countDocuments({ 'data.turn_config': { $exists: true } });
    
    console.log(`  최상위 isunited: ${withTopLevelIsunited} → ${afterTopLevelIsunited} (목표: 0)`);
    console.log(`  data.game_env.isunited: ${withGameEnvIsunited} → ${afterDataGameEnvIsunited} (목표: ${totalSessions})`);
    console.log(`  최상위 turn_config: ${withTurnConfig} → ${afterTurnConfig} (목표: 0)`);
    console.log(`  data.turn_config: ${0} → ${afterDataTurnConfig}\n`);
    
    // 5. 마이그레이션 기록 저장
    const migrationsCollection = db.collection('migrations');
    await migrationsCollection.insertOne({
      version: MIGRATION_VERSION,
      name: 'Session 필드 정리',
      executed_at: new Date(),
      backup_collection: backupCollectionName,
      sessions_migrated: migrated,
      total_sessions: totalSessions
    });
    
    console.log('✅ 마이그레이션 기록 저장 완료\n');
    console.log('🎉 모든 작업 완료!');
    console.log(`\n💡 롤백 방법:`);
    console.log(`   db.sessions.drop()`);
    console.log(`   db.${backupCollectionName}.rename('sessions')\n`);
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
