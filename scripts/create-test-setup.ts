/**
 * 테스트용 계정, 군주 장수, 국가 생성 스크립트
 * 사용법:
 *   pnpm run create-test-setup [session_id] [username] [password] [nation_name] [city_id]
 * 
 * 예시:
 *   pnpm run create-test-setup sangokushi_default testuser test123 "테스트국" 1
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../src/models/user.model';
import { General } from '../src/models/general.model';
import { Nation } from '../src/models/nation.model';
import { City } from '../src/models/city.model';
import { Session } from '../src/models/session.model';
import { GeneralTurn } from '../src/models/general_turn.model';

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env') });

interface CreateTestSetupOptions {
  sessionId?: string;
  username?: string;
  password?: string;
  name?: string;
  nationName?: string;
  cityId?: number;
}

/**
 * 커맨드 라인 인자 파싱
 */
function parseArgs(): CreateTestSetupOptions {
  const args = process.argv.slice(2);
  const options: CreateTestSetupOptions = {};

  if (args[0]) options.sessionId = args[0];
  if (args[1]) options.username = args[1];
  if (args[2]) options.password = args[2];
  if (args[3]) options.nationName = args[3];
  if (args[4]) options.cityId = parseInt(args[4], 10);

  return options;
}

/**
 * 테스트용 계정, 군주 장수, 국가 생성
 */
async function createTestSetup() {
  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
    const maskedUri = mongoUri.replace(/\/\/.*:.*@/, '//***:***@');
    console.log('🔌 MongoDB 연결 중:', maskedUri);

    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB 연결 성공\n');

    // 옵션 읽기
    const args = parseArgs();
    const sessionId = args.sessionId || 'sangokushi_default';
    const username = args.username || 'testuser';
    const password = args.password || 'test123';
    const name = args.name || username;
    const nationName = args.nationName || '테스트국';
    const cityId = args.cityId || 1;

    console.log('📝 테스트 설정 생성 중...');
    console.log(`   세션 ID: ${sessionId}`);
    console.log(`   사용자명: ${username}`);
    console.log(`   이름: ${name}`);
    console.log(`   국가명: ${nationName}`);
    console.log(`   도시 ID: ${cityId}\n`);

    // 1. 세션 확인
    const session = await (Session as any).findOne({ session_id: sessionId });
    if (!session) {
      console.error(`❌ 세션을 찾을 수 없습니다: ${sessionId}`);
      console.error('   먼저 세션을 초기화해주세요: pnpm run init-cities [session_id]');
      process.exit(1);
    }
    console.log('✅ 세션 확인 완료');

    // 2. 사용자 계정 생성
    console.log('\n👤 사용자 계정 생성 중...');
    let user = await (User as any).findOne({ username: username });
    
    if (user) {
      console.log('⚠️  이미 존재하는 사용자입니다. 업데이트합니다.');
      const hashedPassword = await bcrypt.hash(password, 10);
      await (User as any).updateOne(
        { _id: user._id },
        { $set: { password: hashedPassword, name: name } }
      );
      user = await (User as any).findOne({ username: username });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await (User as any).create({
        username,
        password: hashedPassword,
        name,
        grade: 5, // 어드민 권한
        game_mode: 'turn',
        turn_hour: 21,
        turn_minute: 0
      });
      console.log(`✅ 사용자 계정 생성 완료 (ID: ${user._id})`);
    }

    const userId = String(user._id);

    // 3. 도시 확인
    console.log('\n🏛️  도시 확인 중...');
    const city = await (City as any).findOne({
      session_id: sessionId,
      city: cityId
    });

    if (!city) {
      console.error(`❌ 도시를 찾을 수 없습니다: ${cityId}`);
      process.exit(1);
    }
    console.log(`✅ 도시 확인 완료: ${city.name} (ID: ${cityId})`);

    // 4. 국가 생성 (기존 최대 nation 번호 + 1)
    console.log('\n🏰 국가 생성 중...');
    const existingNations = await (Nation as any).find({
      session_id: sessionId
    })
      .sort({ 'data.nation': -1 })
      .limit(1)
      .lean();

    let nationId = 1;
    if (existingNations.length > 0) {
      const maxNation = existingNations[0];
      const existingNationId = maxNation.data?.nation ?? maxNation.nation ?? 0;
      nationId = existingNationId + 1;
    }

    // 국가 생성 또는 업데이트
    let nation = await (Nation as any).findOne({
      session_id: sessionId,
      $or: [
        { 'data.nation': nationId },
        { nation: nationId }
      ]
    });

    if (nation) {
      console.log('⚠️  이미 존재하는 국가입니다. 업데이트합니다.');
      nation.name = nationName;
      nation.data = nation.data || {};
      nation.data.nation = nationId;
      nation.data.name = nationName;
      nation.data.color = '#FF0000'; // 기본 빨간색
      nation.data.capital = cityId;
      nation.data.gold = 50000;
      nation.data.rice = 50000;
      nation.data.level = 1;
      await nation.save();
    } else {
      nation = await (Nation as any).create({
        session_id: sessionId,
        nation: nationId,
        name: nationName,
        data: {
          nation: nationId,
          name: nationName,
          color: '#FF0000', // 기본 빨간색
          capital: cityId,
          gold: 50000,
          rice: 50000,
          level: 1
        }
      });
      console.log(`✅ 국가 생성 완료: ${nationName} (ID: ${nationId})`);
    }

    // 5. 도시를 국가 소유로 설정
    console.log('\n🏛️  도시 소유권 설정 중...');
    city.nation = nationId;
    if (!city.data) city.data = {};
    city.data.nation = nationId;
    await city.save();
    console.log(`✅ 도시 ${city.name}를 국가 ${nationName}의 영토로 설정 완료`);

    // 6. 장수 생성 (군주)
    console.log('\n👑 군주 장수 생성 중...');
    
    // 기존 장수 확인
    let general = await (General as any).findOne({
      session_id: sessionId,
      owner: userId
    });

    if (general) {
      console.log('⚠️  이미 존재하는 장수입니다. 업데이트합니다.');
      general.name = name;
      general.data = general.data || {};
      general.data.nation = nationId;
      general.data.city = cityId;
      general.data.officer_level = 12; // 군주
      general.data.leadership = 90;
      general.data.strength = 80;
      general.data.intel = 85;
      general.data.gold = 10000;
      general.data.rice = 5000;
      general.data.crew = 0;
      general.data.troop = 0;
      general.data.officer_city = 0; // 군주는 도시 관리자 아님
      general.data.npc = 0;
      general.data.owner_name = name;
      await general.save();
    } else {
      // 새 장수 번호 생성
      const lastGeneral = await (General as any).findOne({
        session_id: sessionId
      })
        .sort({ no: -1 })
        .select('no')
        .lean();

      const generalNo = (lastGeneral?.no || 0) + 1;

      general = await (General as any).create({
        no: generalNo,
        session_id: sessionId,
        owner: userId,
        name: name,
        data: {
          owner_name: name,
          nation: nationId,
          city: cityId,
          officer_level: 12, // 군주
          leadership: 90,
          strength: 80,
          intel: 85,
          gold: 10000,
          rice: 5000,
          crew: 0,
          troop: 0,
          officer_city: 0, // 군주는 도시 관리자 아님
          npc: 0,
          turntime: new Date(),
          killturn: 6,
          experience: 0,
          dedication: 0,
          train: 0,
          atmos: 0,
          crewtype: 0,
          makelimit: 0,
          betray: 0,
          age: 30,
          startage: 30,
          personal: 'None',
          special: 'None',
          special2: 'None',
          specage: 0,
          specage2: 0,
          penalty: {},
          injury: 0
        }
      });
      console.log(`✅ 군주 장수 생성 완료: ${name} (ID: ${generalNo})`);

      // 7. 턴 슬롯 생성 (최대 턴까지 휴식으로 채움)
      console.log('\n📋 턴 슬롯 생성 중...');
      const sessionData = session.config || session.data || {};
      const gameEnv = sessionData.game_env || {};
      const maxTurn = gameEnv.maxTurn || 30;

      const turnRows = [];
      for (let i = 0; i < maxTurn; i++) {
        turnRows.push({
          session_id: sessionId,
          data: {
            general_id: generalNo,
            turn_idx: i,
            action: '휴식',
            arg: {},
            brief: '휴식'
          }
        });
      }

      if (turnRows.length > 0) {
        try {
          await (GeneralTurn as any).bulkWrite(
            turnRows.map(row => ({
              updateOne: {
                filter: {
                  session_id: row.session_id,
                  'data.general_id': row.data.general_id,
                  'data.turn_idx': row.data.turn_idx
                },
                update: { $set: row },
                upsert: true
              }
            })),
            { ordered: false }
          );
          console.log(`✅ 턴 슬롯 ${maxTurn}개 생성 완료`);
        } catch (error: any) {
          if (error.code === 11000) {
            console.log('⚠️  일부 턴 슬롯이 이미 존재합니다. 건너뜁니다.');
          } else {
            throw error;
          }
        }
      }
    }

    // 8. 국가의 수도 설정
    console.log('\n🏰 국가 수도 설정 중...');
    nation.data.capital = cityId;
    if (nation.capital !== undefined) {
      nation.capital = cityId;
    }
    await nation.save();
    console.log(`✅ 국가 ${nationName}의 수도를 ${city.name}로 설정 완료`);

    // 최종 요약
    console.log('\n🎉 테스트 설정 생성 완료!\n');
    console.log('📋 생성된 정보:');
    console.log(`   사용자명: ${username}`);
    console.log(`   비밀번호: ${password}`);
    console.log(`   장수명: ${name}`);
    console.log(`   장수 ID: ${general.data?.no || general.no}`);
    console.log(`   국가명: ${nationName}`);
    console.log(`   국가 ID: ${nationId}`);
    console.log(`   도시명: ${city.name}`);
    console.log(`   도시 ID: ${cityId}`);
    console.log(`   관직: 군주 (officer_level: 12)`);
    console.log(`   세션 ID: ${sessionId}\n`);

  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error('\n스택 트레이스:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB 연결 종료');
  }
}

// 실행
createTestSetup().catch((error) => {
  console.error('치명적 오류:', error);
  process.exit(1);
});

export { createTestSetup };



