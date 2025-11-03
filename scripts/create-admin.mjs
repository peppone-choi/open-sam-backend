import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env 파일 로드
dotenv.config({ path: join(__dirname, '../.env') });

// User Schema 정의 (models/user.model.ts와 동일)
const UserSchema = new mongoose.Schema({
  no: { type: String },
  username: { type: String, required: true, unique: true },
  name: { type: String },
  password: { type: String, required: true },
  game_mode: { type: String, default: 'turn' },
  turn_hour: { type: Number, default: 21 },
  turn_minute: { type: Number, default: 0 },
  next_turn_time: { type: Date },
  grade: { type: Number, default: 1 },
  acl: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function createAdmin() {
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
    console.log('🔌 MongoDB 연결 중:', mongoUri.replace(/\/\/.*:.*@/, '//***:***@'));
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB 연결 성공\n');

    // 커맨드 라인 인자 읽기
    // 환경변수를 통한 입력 지원 (특수문자 안전)
    const username = process.env.ADMIN_USERNAME || process.argv[2] || 'admin';
    const password = process.env.ADMIN_PASSWORD || process.argv[3] || 'admin123';
    const grade = parseInt(process.env.ADMIN_GRADE || process.argv[4] || '10'); // 기본 최고 등급

    console.log('📝 어드민 계정 생성 중...');
    console.log(`   사용자명: ${username}`);
    console.log(`   비밀번호: ${'*'.repeat(password.length)} (길이: ${password.length})`);
    console.log(`   등급: ${grade} (5 이상이면 어드민)`);

    // 기존 사용자 확인
    const existing = await User.findOne({ username });
    if (existing) {
      console.log('\n⚠️  이미 존재하는 사용자입니다.');
      console.log(`   기존 등급: ${existing.grade || 1}`);
      
      // 등급 업데이트 여부 확인
      if (existing.grade !== grade) {
        const update = await User.updateOne(
          { _id: existing._id },
          { 
            $set: { 
              grade,
              password: await bcrypt.hash(password, 10)
            }
          }
        );
        console.log(`\n✅ 사용자 등급을 ${grade}로 업데이트하고 비밀번호를 변경했습니다.`);
      } else {
        // 비밀번호만 업데이트
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.updateOne(
          { _id: existing._id },
          { $set: { password: hashedPassword } }
        );
        console.log('\n✅ 비밀번호를 변경했습니다.');
      }
    } else {
      // 새 사용자 생성
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        username,
        password: hashedPassword,
        name: username,
        grade,
        game_mode: 'turn'
      });

      console.log('\n✅ 어드민 계정 생성 완료!');
      console.log(`   사용자 ID: ${user._id}`);
      console.log(`   등급: ${user.grade}`);
    }

    console.log('\n📋 로그인 정보:');
    console.log(`   URL: http://localhost:3000 (또는 프론트엔드 주소)`);
    console.log(`   사용자명: ${username}`);
    console.log(`   비밀번호: ${password}`);
    console.log(`   어드민 등급: ${grade >= 5 ? '✅ 예' : '❌ 아니오 (5 이상 필요)'}`);

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    if (error.code === 11000) {
      console.error('   중복된 사용자명입니다.');
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB 연결 종료');
  }
}

// 실행
createAdmin();

