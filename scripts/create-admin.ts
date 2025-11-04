/**
 * 어드민 계정 생성 스크립트
 * 사용법:
 *   npm run create-admin
 *   npm run create-admin -- --username admin --password admin123 --grade 10
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=pass123 ADMIN_GRADE=10 npm run create-admin
 */

import mongoose, { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../src/models/user.model';
import type { IUser } from '../src/models/user.model';

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env') });

interface CreateAdminOptions {
  username?: string;
  password?: string;
  name?: string;
  grade?: number;
  email?: string;
}

/**
 * 커맨드 라인 인자 파싱
 */
function parseArgs(): CreateAdminOptions {
  const args = process.argv.slice(2);
  const options: CreateAdminOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      switch (key) {
        case 'username':
          options.username = value;
          break;
        case 'password':
          options.password = value;
          break;
        case 'name':
          options.name = value;
          break;
        case 'grade':
          options.grade = parseInt(value, 10);
          break;
        case 'email':
          options.email = value;
          break;
      }
      i++; // 다음 인자 스킵
    }
  }

  return options;
}

/**
 * 어드민 계정 생성
 */
async function createAdmin() {
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
    const maskedUri = mongoUri.replace(/\/\/.*:.*@/, '//***:***@');
    console.log('🔌 MongoDB 연결 중:', maskedUri);

    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB 연결 성공\n');

    // 옵션 읽기 (환경변수 > 커맨드 라인 > 기본값)
    const args = parseArgs();
    const username = process.env.ADMIN_USERNAME || args.username || 'admin';
    const password = process.env.ADMIN_PASSWORD || args.password || 'admin123';
    const name = args.name || process.env.ADMIN_NAME || username;
    const grade = parseInt(
      process.env.ADMIN_GRADE || String(args.grade || 10),
      10
    );
    const email = process.env.ADMIN_EMAIL || args.email;

    console.log('📝 어드민 계정 생성 중...');
    console.log(`   사용자명: ${username}`);
    console.log(`   이름: ${name}`);
    if (email) {
      console.log(`   이메일: ${email}`);
    }
    console.log(`   비밀번호: ${'*'.repeat(password.length)} (길이: ${password.length})`);
    console.log(`   등급: ${grade} ${grade >= 5 ? '(어드민)' : '(일반 사용자)'}`);

    // 비밀번호 검증
    if (password.length < 6) {
      console.error('\n❌ 오류: 비밀번호는 최소 6자 이상이어야 합니다.');
      process.exit(1);
    }

    // 기존 사용자 확인
    const existing = await (User as any).findOne({ username: username }).lean();
    
    if (existing) {
      console.log('\n⚠️  이미 존재하는 사용자입니다.');
      console.log(`   기존 등급: ${existing.grade || 1}`);
      console.log(`   기존 이름: ${existing.name || '없음'}`);

      // 업데이트 여부 확인
      const hashedPassword = await bcrypt.hash(password, 10);
      const updateData: Partial<IUser> = {
        password: hashedPassword,
        grade,
        name,
      };

      if (email) {
        (updateData as any).email = email;
      }

      await (User as any).updateOne(
        { _id: existing._id },
        { $set: updateData }
      );

      console.log(`\n✅ 사용자 정보를 업데이트했습니다.`);
      console.log(`   - 등급: ${grade}`);
      console.log(`   - 비밀번호: 변경됨`);
      console.log(`   - 이름: ${name}`);
    } else {
      // 새 사용자 생성
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userData: Partial<IUser> = {
        username,
        password: hashedPassword,
        name,
        grade,
        game_mode: 'turn',
        turn_hour: 21,
        turn_minute: 0,
      };

      if (email) {
        (userData as any).email = email;
      }

      const user = await (User as any).create(userData);

      console.log('\n✅ 어드민 계정 생성 완료!');
      console.log(`   사용자 ID: ${user._id}`);
      console.log(`   MongoDB ID: ${user._id}`);
      if (user.no) {
        console.log(`   사용자 번호: ${user.no}`);
      }
    }

    // 최종 확인
    const finalUser = await (User as any).findOne({ username: username }).lean();
    if (!finalUser) {
      throw new Error('사용자 생성 후 확인 실패');
    }

    console.log('\n📋 로그인 정보:');
    console.log(`   사용자명: ${finalUser.username}`);
    console.log(`   비밀번호: ${password}`);
    console.log(`   등급: ${finalUser.grade || 1}`);
    console.log(`   어드민 여부: ${(finalUser.grade || 1) >= 5 ? '✅ 예' : '❌ 아니오 (5 이상 필요)'}`);
    
    if ((finalUser.grade || 1) < 5) {
      console.log('\n⚠️  주의: 등급이 5 미만이므로 어드민 권한이 없습니다.');
      console.log('   등급을 5 이상으로 설정하려면 --grade 옵션을 사용하세요.');
    }

  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message);
    
    if (error.code === 11000) {
      console.error('   중복된 사용자명입니다. 다른 사용자명을 사용하세요.');
    } else if (error.name === 'ValidationError') {
      console.error('   데이터 검증 오류:', error.message);
    }
    
    console.error('\n스택 트레이스:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB 연결 종료');
  }
}

// 실행
createAdmin().catch((error) => {
  console.error('치명적 오류:', error);
  process.exit(1);
});

export { createAdmin };

