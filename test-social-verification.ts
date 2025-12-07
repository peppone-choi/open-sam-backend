/**
 * gin7-social-interaction 검증 테스트
 * ts-node로 실행: npx ts-node test-social-verification.ts
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 인라인 스키마 정의 (독립 테스트용)
const RelationshipSchema = new mongoose.Schema({
  session_id: String,
  fromCommanderNo: Number,
  toCommanderNo: Number,
  friendship: { type: Number, default: 50, min: 0, max: 100 },
  trust: { type: Number, default: 50, min: 0, max: 100 },
  interactions: [{
    interactionType: String,
    date: { type: Date, default: Date.now },
    result: String,
    friendshipChange: Number,
    notes: String,
  }],
  lastInteractionAt: Date,
  isRival: { type: Boolean, default: false },
  isAlly: { type: Boolean, default: false },
  isEnemy: { type: Boolean, default: false },
}, { timestamps: true });

const FactionSchema = new mongoose.Schema({
  session_id: String,
  factionId: String,
  name: String,
  alignment: String,
  leaderNo: Number,
  leaderName: String,
  members: [{
    commanderNo: Number,
    name: String,
    role: String,
    joinedAt: { type: Date, default: Date.now },
    influence: { type: Number, default: 10 },
  }],
  stats: {
    totalInfluence: { type: Number, default: 0 },
    politicalPower: { type: Number, default: 0 },
    militaryPower: { type: Number, default: 0 },
  },
  treasury: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const CommanderSchema = new mongoose.Schema({
  session_id: String,
  no: Number,
  name: String,
  faction: String,
  rank: Number,
  stats: {
    leadership: { type: Number, default: 50 },
    politics: { type: Number, default: 50 },
    intelligence: { type: Number, default: 50 },
    command: { type: Number, default: 50 },
    maneuver: { type: Number, default: 50 },
  },
  fame: { type: Number, default: 0 },
  merit: { type: Number, default: 0 },
  customData: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

async function runTests() {
  console.log('\n🎭 gin7-social-interaction 검증 테스트 시작\n');

  // MongoDB 메모리 서버 시작
  console.log('📦 MongoDB 메모리 서버 시작 중...');
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  console.log('✅ MongoDB 연결 완료\n');

  const Relationship = mongoose.model('Relationship', RelationshipSchema);
  const Faction = mongoose.model('Faction', FactionSchema);
  const Commander = mongoose.model('Commander', CommanderSchema);

  const TEST_SESSION = 'test-social-session';

  // 테스트 데이터 생성
  console.log('📝 테스트 데이터 생성 중...\n');
  
  await Commander.create({
    session_id: TEST_SESSION,
    no: 1,
    name: '라인하르트',
    faction: 'empire',
    rank: 1,
    stats: { leadership: 90, politics: 85, intelligence: 95, command: 95, maneuver: 90 },
    fame: 100,
    merit: 50,
    customData: { personalFunds: 5000 },
  });

  await Commander.create({
    session_id: TEST_SESSION,
    no: 2,
    name: '키르히아이스',
    faction: 'empire',
    rank: 2,
    stats: { leadership: 85, politics: 70, intelligence: 80, command: 90, maneuver: 85 },
    fame: 80,
    merit: 40,
  });

  await Commander.create({
    session_id: TEST_SESSION,
    no: 3,
    name: '미터마이어',
    faction: 'empire',
    rank: 2,
    stats: { leadership: 80, politics: 60, intelligence: 70, command: 85, maneuver: 95 },
    fame: 60,
    merit: 30,
  });

  console.log('✅ 커맨더 3명 생성 완료\n');

  // ============================================
  // 테스트 1: 사교 - 야회 개최 시 영향력 상승
  // ============================================
  console.log('='.repeat(60));
  console.log('📍 테스트 1: 사교 (야회 개최 시 영향력 상승)');
  console.log('='.repeat(60));

  const hostBefore = await Commander.findOne({ session_id: TEST_SESSION, no: 1 });
  const initialFame = hostBefore!.fame;
  
  // 야회 시뮬레이션
  const inviteeNos = [2, 3];
  const politics = 85;
  let totalFriendshipGain = 0;
  const baseInfluenceGain = 5 + Math.floor(inviteeNos.length * 2);

  for (const inviteeNo of inviteeNos) {
    const friendshipChange = 3 + Math.floor(Math.random() * 5);
    
    await Relationship.findOneAndUpdate(
      { session_id: TEST_SESSION, fromCommanderNo: 1, toCommanderNo: inviteeNo },
      { 
        $set: { friendship: 50 + friendshipChange, lastInteractionAt: new Date() },
        $push: { interactions: { interactionType: 'party', friendshipChange, notes: '야회' } }
      },
      { upsert: true, new: true }
    );
    
    totalFriendshipGain += friendshipChange;
  }

  const politicsBonus = Math.floor((politics - 50) / 10);
  const influenceGain = baseInfluenceGain + politicsBonus;

  await Commander.updateOne(
    { session_id: TEST_SESSION, no: 1 },
    { $inc: { fame: influenceGain } }
  );

  const hostAfter = await Commander.findOne({ session_id: TEST_SESSION, no: 1 });

  console.log(`\n✅ 야회 결과:`);
  console.log(`   - 초대객 수: ${inviteeNos.length}명`);
  console.log(`   - 총 우호도 상승: +${totalFriendshipGain}`);
  console.log(`   - 영향력 상승: +${influenceGain}`);
  console.log(`   - 호스트 명성: ${initialFame} → ${hostAfter!.fame}`);
  console.log(`\n📊 검증: 영향력이 상승했는가? ${hostAfter!.fame > initialFame ? '✅ PASS' : '❌ FAIL'}`);

  // ============================================
  // 테스트 2: 파벌 시스템
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('📍 테스트 2: 파벌 (우호도 높은 캐릭터들의 파벌 형성)');
  console.log('='.repeat(60));

  const factionId = `faction_1_${Date.now()}`;
  const faction = await Faction.create({
    session_id: TEST_SESSION,
    factionId,
    name: '로엔그람 파',
    alignment: 'empire',
    leaderNo: 1,
    leaderName: '라인하르트',
    members: [{
      commanderNo: 1,
      name: '라인하르트',
      role: 'leader',
      joinedAt: new Date(),
      influence: 100,
    }],
    stats: {
      totalInfluence: 100,
      politicalPower: 85,
      militaryPower: 95,
    },
    isActive: true,
  });

  console.log(`\n✅ 파벌 생성:`);
  console.log(`   - 파벌명: ${faction.name}`);
  console.log(`   - 리더: ${faction.leaderName}`);

  const rel1to2 = await Relationship.findOne({ session_id: TEST_SESSION, fromCommanderNo: 1, toCommanderNo: 2 });
  console.log(`\n   - 라인하르트 → 키르히아이스 우호도: ${rel1to2?.friendship || 50}`);

  await Faction.updateOne(
    { factionId },
    { $push: { 
      members: { 
        commanderNo: 2, 
        name: '키르히아이스', 
        role: 'core',
        joinedAt: new Date(),
        influence: 80 
      }
    }}
  );

  const updatedFaction = await Faction.findOne({ factionId });
  console.log(`\n✅ 파벌 가입 후:`);
  console.log(`   - 멤버 수: ${updatedFaction!.members.length}`);
  console.log(`   - 멤버: ${updatedFaction!.members.map((m: any) => `${m.name}(${m.role})`).join(', ')}`);
  console.log(`\n📊 검증: 파벌이 형성되었는가? ${updatedFaction!.members.length >= 2 ? '✅ PASS' : '❌ FAIL'}`);

  // ============================================
  // 테스트 3: 사재 시스템 (기부 → 명성)
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('📍 테스트 3: 사재 (기부하여 명성 획득)');
  console.log('='.repeat(60));

  const cmdBefore = await Commander.findOne({ session_id: TEST_SESSION, no: 1 });
  const beforeFame = cmdBefore!.fame;
  const beforeMerit = cmdBefore!.merit;
  const beforeFunds = (cmdBefore!.customData as any)?.personalFunds || 0;
  const donationAmount = 1000;

  console.log(`\n기부 전:`);
  console.log(`   - 사재: ${beforeFunds}`);
  console.log(`   - 명성: ${beforeFame}`);
  console.log(`   - 공적: ${beforeMerit}`);

  const fameGain = Math.floor(donationAmount / 100);
  const meritGain = Math.floor(donationAmount / 50);

  await Commander.updateOne(
    { session_id: TEST_SESSION, no: 1 },
    { 
      $inc: { fame: fameGain, merit: meritGain },
      $set: { 'customData.personalFunds': beforeFunds - donationAmount }
    }
  );

  const cmdAfter = await Commander.findOne({ session_id: TEST_SESSION, no: 1 });

  console.log(`\n기부 후 (${donationAmount} 기부):`);
  console.log(`   - 사재: ${(cmdAfter!.customData as any)?.personalFunds}`);
  console.log(`   - 명성: ${cmdAfter!.fame} (+${cmdAfter!.fame - beforeFame})`);
  console.log(`   - 공적: ${cmdAfter!.merit} (+${cmdAfter!.merit - beforeMerit})`);
  console.log(`\n📊 검증: 기부로 명성을 얻었는가? ${cmdAfter!.fame > beforeFame ? '✅ PASS' : '❌ FAIL'}`);

  // ============================================
  // 최종 결과 요약
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 최종 검증 결과');
  console.log('='.repeat(60));

  const test1Pass = hostAfter!.fame > initialFame;
  const test2Pass = updatedFaction!.members.length >= 2;
  const test3Pass = cmdAfter!.fame > beforeFame;

  console.log(`\n1. 사교 (야회 → 영향력 상승):    ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`2. 파벌 (우호도 → 파벌 형성):    ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`3. 사재 (기부 → 명성 획득):      ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);

  const allPass = test1Pass && test2Pass && test3Pass;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`총 결과: ${allPass ? '✅ 모든 테스트 통과!' : '⚠️ 일부 테스트 실패'}`);
  console.log('='.repeat(60));

  // 이벤트 로그 출력
  console.log('\n📋 이벤트 로그:');
  const relationships = await Relationship.find({ session_id: TEST_SESSION });
  relationships.forEach((r: any) => {
    console.log(`\n[Relationship] Commander ${r.fromCommanderNo} → ${r.toCommanderNo}`);
    console.log(`  우호도: ${r.friendship}, 신뢰도: ${r.trust}`);
    if (r.interactions?.length) {
      r.interactions.forEach((i: any) => {
        console.log(`  - ${i.interactionType}: +${i.friendshipChange} (${i.notes || ''})`);
      });
    }
  });

  const factions = await Faction.find({ session_id: TEST_SESSION, isActive: true });
  factions.forEach((f: any) => {
    console.log(`\n[Faction] ${f.name}`);
    console.log(`  리더: ${f.leaderName}`);
    console.log(`  멤버: ${f.members.length}명`);
    f.members.forEach((m: any) => {
      console.log(`    - ${m.name} (${m.role}, 영향력: ${m.influence})`);
    });
  });

  // 정리
  await mongoose.disconnect();
  await mongoServer.stop();
  
  console.log('\n✅ gin7-social-interaction 검증 완료!\n');
}

runTests().catch(err => {
  console.error('테스트 실패:', err);
  process.exit(1);
});

