#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samgames';

async function resetTurntimes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 완료');

    const General = mongoose.model('General', new mongoose.Schema({}, { strict: false, collection: 'generals' }));
    const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false, collection: 'sessions' }));

    const sessionId = 'sangokushi_default';
    const now = new Date();

    // 모든 장수의 turntime을 현재 시각으로 초기화
    const result = await General.updateMany(
      { session_id: sessionId },
      { 
        $set: { 
          'data.turntime': now.toISOString(),
          turntime: now.toISOString()
        } 
      }
    );

    console.log(`✅ ${result.modifiedCount}명의 장수 turntime 초기화 완료`);

    // 세션 turntime도 현재 시각으로 초기화
    const session = await Session.findOne({ session_id: sessionId });
    if (session) {
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      
      session.data.turntime = now.toISOString();
      session.data.game_env.turntime = now.toISOString();
      session.markModified('data');
      await session.save();
      
      console.log('✅ 세션 turntime 초기화 완료');
      console.log(`   현재 시각: ${now.toISOString()}`);
    }

    await mongoose.disconnect();
    console.log('');
    console.log('✅ 모든 turntime 초기화 완료!');
    console.log('💡 이제 데몬이 다음 분부터 정상적으로 한 턴씩 처리합니다.');
    process.exit(0);
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    process.exit(1);
  }
}

resetTurntimes();
