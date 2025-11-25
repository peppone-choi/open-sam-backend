#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samgames';

async function enableNPCAI() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 완료');

    const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false, collection: 'sessions' }));

    // sangokushi_default 세션 찾기
    const session = await Session.findOne({ session_id: 'sangokushi_default' });
    
    if (!session) {
      console.error('❌ sangokushi_default 세션을 찾을 수 없습니다');
      process.exit(1);
    }

    // NPC AI 모드 활성화
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.data.game_env.npc_ai_mode = 'full';  // 'full', 'partial', 'shadow', 'disabled'
    session.data.game_env.ai_difficulty = 'NORMAL';  // 'EASY', 'NORMAL', 'HARD'
    
    session.markModified('data');
    await session.save();

    console.log('✅ NPC AI 모드 활성화 완료');
    console.log('   - npc_ai_mode: full');
    console.log('   - ai_difficulty: NORMAL');
    console.log('');
    console.log('💡 AI 모드 설명:');
    console.log('   - full: 모든 NPC에 AI 적용');
    console.log('   - partial: npc >= 3 (명장급)만 AI 적용');
    console.log('   - shadow: AI 결정만 로깅, 실제 적용 안함');
    console.log('   - disabled: AI 비활성화 (기본값)');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    process.exit(1);
  }
}

enableNPCAI();
