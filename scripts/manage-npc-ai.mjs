#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samgames';

const AI_MODES = {
  disabled: 'AI 완전 비활성화 (NPC 휴식만)',
  shadow: 'AI 결정 로깅만, 실제 적용 안함 (테스트)',
  partial: 'npc >= 3 (명장급)만 AI 적용',
  full: '모든 NPC에 AI 적용 (권장)'
};

const AI_DIFFICULTY = {
  EASY: '쉬움 - NPC가 단순한 결정만 함',
  NORMAL: '보통 - 균형잡힌 AI (권장)',
  HARD: '어려움 - NPC가 최적화된 전략 사용'
};

async function manageNPCAI() {
  const mode = process.argv[2];
  const difficulty = process.argv[3] || 'NORMAL';

  if (!mode || !AI_MODES[mode]) {
    console.log('📖 사용법: node scripts/manage-npc-ai.mjs <mode> [difficulty]');
    console.log('');
    console.log('🤖 AI 모드:');
    Object.entries(AI_MODES).forEach(([key, desc]) => {
      console.log(`   ${key.padEnd(10)} - ${desc}`);
    });
    console.log('');
    console.log('⚔️  난이도:');
    Object.entries(AI_DIFFICULTY).forEach(([key, desc]) => {
      console.log(`   ${key.padEnd(10)} - ${desc}`);
    });
    console.log('');
    console.log('💡 예시:');
    console.log('   node scripts/manage-npc-ai.mjs full NORMAL    # 모든 NPC AI 활성화');
    console.log('   node scripts/manage-npc-ai.mjs partial HARD   # 명장급만 어려운 AI');
    console.log('   node scripts/manage-npc-ai.mjs shadow         # 테스트 모드');
    console.log('   node scripts/manage-npc-ai.mjs disabled       # AI 비활성화');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 완료');

    const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false, collection: 'sessions' }));
    const session = await Session.findOne({ session_id: 'sangokushi_default' });
    
    if (!session) {
      console.error('❌ sangokushi_default 세션을 찾을 수 없습니다');
      process.exit(1);
    }

    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.data.game_env.npc_ai_mode = mode;
    session.data.game_env.ai_difficulty = difficulty;
    
    session.markModified('data');
    await session.save();

    console.log('✅ NPC AI 설정 업데이트 완료');
    console.log(`   - npc_ai_mode: ${mode} (${AI_MODES[mode]})`);
    console.log(`   - ai_difficulty: ${difficulty} (${AI_DIFFICULTY[difficulty] || '알 수 없음'})`);
    console.log('');
    console.log('⚠️  변경사항 적용을 위해 백엔드 데몬을 재시작하세요:');
    console.log('   npm run dev:turn');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    process.exit(1);
  }
}

manageNPCAI();
