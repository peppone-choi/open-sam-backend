/**
 * SocialInteractionService 단위 테스트
 * gin7-social-interaction 검증
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SocialInteractionService } from '../SocialInteractionService';
import { Relationship } from '../../../models/logh/Relationship.model';
import { Faction } from '../../../models/logh/Faction.model';
import { LoghCommander } from '../../../models/logh/Commander.model';

describe('SocialInteractionService', () => {
  let mongoServer: MongoMemoryServer;
  const TEST_SESSION = 'test-social-session';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Relationship.deleteMany({});
    await Faction.deleteMany({});
    await LoghCommander.deleteMany({});

    // 테스트용 커맨더 생성
    await LoghCommander.create({
      session_id: TEST_SESSION,
      no: 1,
      name: '라인하르트',
      faction: 'empire',
      rank: 1,
      stats: { leadership: 90, politics: 85, intelligence: 95, command: 95, maneuver: 90, attack: 90, defense: 80, operations: 85 },
      fame: 100,
      merit: 50,
      customData: { personalFunds: 5000 },
    });

    await LoghCommander.create({
      session_id: TEST_SESSION,
      no: 2,
      name: '키르히아이스',
      faction: 'empire',
      rank: 2,
      stats: { leadership: 85, politics: 70, intelligence: 80, command: 90, maneuver: 85, attack: 85, defense: 85, operations: 80 },
      fame: 80,
      merit: 40,
    });

    await LoghCommander.create({
      session_id: TEST_SESSION,
      no: 3,
      name: '미터마이어',
      faction: 'empire',
      rank: 2,
      stats: { leadership: 80, politics: 60, intelligence: 70, command: 85, maneuver: 95, attack: 80, defense: 75, operations: 75 },
      fame: 60,
      merit: 30,
    });
  });

  describe('1. 사교 (야회 개최 시 영향력 상승)', () => {
    test('야회 개최 시 호스트의 영향력(fame)이 상승해야 한다', async () => {
      const hostBefore = await LoghCommander.findOne({ session_id: TEST_SESSION, no: 1 });
      const initialFame = hostBefore!.fame;

      const result = await SocialInteractionService.hostParty(
        TEST_SESSION,
        1,  // host
        [2, 3],  // invitees
        85,  // politics
        100  // influence
      );

      expect(result.success).toBe(true);
      expect(result.influenceChange).toBeGreaterThan(0);
      
      const hostAfter = await LoghCommander.findOne({ session_id: TEST_SESSION, no: 1 });
      expect(hostAfter!.fame).toBeGreaterThan(initialFame);
      
      console.log(`\n✅ 야회 결과:`);
      console.log(`   - 영향력 증가: +${result.influenceChange}`);
      console.log(`   - 호스트 명성: ${initialFame} → ${hostAfter!.fame}`);
      console.log(`   - 메시지: ${result.message}`);
    });

    test('야회 초대객과의 우호도가 상승해야 한다', async () => {
      await SocialInteractionService.hostParty(TEST_SESSION, 1, [2], 85, 100);

      const relationship = await Relationship.findOne({
        session_id: TEST_SESSION,
        fromCommanderNo: 1,
        toCommanderNo: 2,
      });

      expect(relationship).not.toBeNull();
      expect(relationship!.friendship).toBeGreaterThan(50); // 기본값 50보다 높아야 함
      
      console.log(`\n✅ 야회 후 우호도: ${relationship!.friendship}`);
    });
  });

  describe('2. 파벌 (우호도 높은 캐릭터들의 파벌 형성)', () => {
    test('파벌을 생성할 수 있어야 한다', async () => {
      const faction = await SocialInteractionService.createFaction(
        TEST_SESSION,
        1,  // leaderNo
        '로엔그람 파'
      );

      expect(faction).not.toBeNull();
      expect(faction!.name).toBe('로엔그람 파');
      expect(faction!.leaderNo).toBe(1);
      expect(faction!.members.length).toBe(1);
      expect(faction!.members[0].role).toBe('leader');
      
      console.log(`\n✅ 파벌 생성:`);
      console.log(`   - 파벌명: ${faction!.name}`);
      console.log(`   - 리더: ${faction!.leaderName}`);
      console.log(`   - 멤버 수: ${faction!.members.length}`);
    });

    test('다른 캐릭터가 파벌에 가입할 수 있어야 한다', async () => {
      const faction = await SocialInteractionService.createFaction(TEST_SESSION, 1, '로엔그람 파');
      
      const joinResult = await SocialInteractionService.joinFaction(
        TEST_SESSION,
        faction!.factionId,
        2  // 키르히아이스
      );

      expect(joinResult).toBe(true);

      const updatedFaction = await Faction.findOne({ factionId: faction!.factionId });
      expect(updatedFaction!.members.length).toBe(2);
      
      console.log(`\n✅ 파벌 가입:`);
      console.log(`   - 멤버 수: ${updatedFaction!.members.length}`);
      console.log(`   - 멤버: ${updatedFaction!.members.map(m => m.name).join(', ')}`);
    });

    test('파벌 탈퇴 및 해체가 가능해야 한다', async () => {
      const faction = await SocialInteractionService.createFaction(TEST_SESSION, 1, '로엔그람 파');
      await SocialInteractionService.joinFaction(TEST_SESSION, faction!.factionId, 2);
      
      // 일반 멤버 탈퇴
      const leaveResult = await SocialInteractionService.leaveFaction(TEST_SESSION, faction!.factionId, 2);
      expect(leaveResult).toBe(true);
      
      // 리더는 탈퇴 불가
      const leaderLeaveResult = await SocialInteractionService.leaveFaction(TEST_SESSION, faction!.factionId, 1);
      expect(leaderLeaveResult).toBe(false);
      
      // 리더만 해체 가능
      const dissolveResult = await SocialInteractionService.dissolveFaction(TEST_SESSION, faction!.factionId, 1);
      expect(dissolveResult).toBe(true);
      
      const dissolvedFaction = await Faction.findOne({ factionId: faction!.factionId });
      expect(dissolvedFaction!.isActive).toBe(false);
      
      console.log(`\n✅ 파벌 탈퇴/해체:`);
      console.log(`   - 멤버 탈퇴: 성공`);
      console.log(`   - 리더 탈퇴 시도: 거부됨 (정상)`);
      console.log(`   - 파벌 해체: 성공`);
    });
  });

  describe('3. 사재 (기부하여 명성 획득)', () => {
    test('사재를 기부하면 명성(fame)과 공적(merit)이 상승해야 한다', async () => {
      const commanderBefore = await LoghCommander.findOne({ session_id: TEST_SESSION, no: 1 });
      const initialFame = commanderBefore!.fame;
      const initialMerit = commanderBefore!.merit;
      const initialFunds = commanderBefore!.customData?.personalFunds || 0;

      const result = await SocialInteractionService.donate(TEST_SESSION, 1, 1000);

      expect(result.success).toBe(true);

      const commanderAfter = await LoghCommander.findOne({ session_id: TEST_SESSION, no: 1 });
      expect(commanderAfter!.fame).toBeGreaterThan(initialFame);
      expect(commanderAfter!.merit).toBeGreaterThan(initialMerit);
      expect(commanderAfter!.customData?.personalFunds).toBe(initialFunds - 1000);
      
      console.log(`\n✅ 기부 결과:`);
      console.log(`   - 기부액: 1000`);
      console.log(`   - 명성: ${initialFame} → ${commanderAfter!.fame} (+${commanderAfter!.fame - initialFame})`);
      console.log(`   - 공적: ${initialMerit} → ${commanderAfter!.merit} (+${commanderAfter!.merit - initialMerit})`);
      console.log(`   - 사재: ${initialFunds} → ${commanderAfter!.customData?.personalFunds}`);
    });

    test('사재가 부족하면 기부가 실패해야 한다', async () => {
      const result = await SocialInteractionService.donate(TEST_SESSION, 1, 100000);
      expect(result.success).toBe(false);
      expect(result.message).toContain('부족');
      
      console.log(`\n✅ 사재 부족 시: ${result.message}`);
    });

    test('로비를 통해 특정 인물의 호의를 얻을 수 있어야 한다', async () => {
      // 사재 추가
      await SocialInteractionService.modifyPersonalFunds(TEST_SESSION, 1, 10000);

      const result = await SocialInteractionService.lobby(TEST_SESSION, 1, 2, 2000, '인사 청탁');

      // 성공 또는 실패 모두 가능 (확률 기반)
      expect(result.friendshipChange).toBeDefined();
      
      console.log(`\n✅ 로비 결과:`);
      console.log(`   - 성공 여부: ${result.success ? '성공' : '실패'}`);
      console.log(`   - 우호도 변화: +${result.friendshipChange}`);
      console.log(`   - 메시지: ${result.message}`);
    });
  });

  describe('관계 시스템', () => {
    test('1:1 담화로 우호도가 상승해야 한다', async () => {
      const result = await SocialInteractionService.conductTalk(
        TEST_SESSION, 1, 2, 85, 90  // politics, leadership
      );

      expect(result.success).toBe(true);
      expect(result.friendshipChange).toBeGreaterThan(0);

      const relationship = await Relationship.findOne({
        session_id: TEST_SESSION,
        fromCommanderNo: 1,
        toCommanderNo: 2,
      });

      expect(relationship!.friendship).toBeGreaterThan(50);
      
      console.log(`\n✅ 담화 결과:`);
      console.log(`   - 우호도 변화: +${result.friendshipChange}`);
      console.log(`   - 현재 우호도: ${relationship!.friendship}`);
    });

    test('밀담으로 신뢰도도 상승해야 한다', async () => {
      const result = await SocialInteractionService.conductSecretMeeting(
        TEST_SESSION, 1, 2, 95  // intelligence
      );

      expect(result.success).toBe(true);

      const relationship = await Relationship.findOne({
        session_id: TEST_SESSION,
        fromCommanderNo: 1,
        toCommanderNo: 2,
      });

      expect(relationship!.trust).toBeGreaterThanOrEqual(50);
      
      console.log(`\n✅ 밀담 결과:`);
      console.log(`   - 우호도 변화: +${result.friendshipChange}`);
      console.log(`   - 신뢰도: ${relationship!.trust}`);
    });
  });
});












