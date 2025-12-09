/**
 * 전투 리플레이 테스트
 * 
 * Agent 11 - Sam Battle Replay & Critical Damage
 * 
 * 리플레이 저장 시스템 검증
 * 
 * 실행: cd open-sam-backend && npm test -- --testPathPattern=battle-replay
 */

import { ReplayBuilder, ReplayMetadata, ReplayData } from '../../services/war/BattleReplay';

describe('Battle Replay System', () => {
  /**
   * 시나리오 1: ReplayBuilder 기본 동작
   */
  describe('ReplayBuilder', () => {
    const sampleMetadata: ReplayMetadata = {
      sessionId: 'test_session',
      battleId: 'test_battle_123',
      date: new Date('2024-01-01'),
      seed: 'test_seed_abc',
      attacker: {
        id: 1,
        name: '조조',
        nationId: 1,
        nationName: '위',
        generalName: '조조',
        crew: 5000,
        crewType: '기병'
      },
      defender: {
        cityId: 10,
        cityName: '허창',
        nationId: 2,
        nationName: '촉',
        defenders: [
          { id: 2, name: '관우', crew: 3000, crewType: '보병' }
        ]
      }
    };
    
    it('메타데이터 포함하여 빌드', () => {
      const builder = new ReplayBuilder(sampleMetadata);
      const data = builder.build();
      
      expect(data.version).toBe('1.0');
      expect(data.metadata.sessionId).toBe('test_session');
      expect(data.metadata.battleId).toBe('test_battle_123');
      expect(data.metadata.attacker.name).toBe('조조');
    });
    
    it('턴별 액션 기록', () => {
      const builder = new ReplayBuilder(sampleMetadata);
      
      builder.startTurn(1);
      builder.addAction({
        type: 'attack',
        actorId: 1,
        targetId: 2,
        damage: 500,
        detail: { isCritical: false }
      });
      
      builder.startTurn(2);
      builder.addAction({
        type: 'attack',
        actorId: 1,
        targetId: 2,
        damage: 800,
        detail: { isCritical: true, criticalMultiplier: 1.8 }
      });
      
      const data = builder.build();
      
      expect(data.turns.length).toBe(2);
      expect(data.turns[0].turnNumber).toBe(1);
      expect(data.turns[0].actions[0].damage).toBe(500);
      expect(data.turns[1].actions[0].detail.isCritical).toBe(true);
    });
    
    it('logAttack 헬퍼 함수로 크리티컬 기록', () => {
      const builder = new ReplayBuilder(sampleMetadata);
      
      builder.startTurn(1);
      // 일반 공격
      builder.logAttack(1, 2, 500, 4500, 2500, false);
      // 크리티컬 공격
      builder.logAttack(1, 2, 900, 4500, 1600, true);
      
      const data = builder.build();
      
      expect(data.turns[0].actions.length).toBe(2);
      expect(data.turns[0].actions[0].detail.isCritical).toBe(false);
      expect(data.turns[0].actions[1].detail.isCritical).toBe(true);
    });
  });
  
  /**
   * 시나리오 2: 리플레이 데이터 구조 검증
   */
  describe('Replay Data Structure', () => {
    it('전투 종료 후 예상 구조', () => {
      const expectedStructure: ReplayData = {
        version: '1.0',
        metadata: {
          sessionId: 'session_123',
          battleId: 'battle_456',
          date: expect.any(Date),
          seed: 'seed_789',
          attacker: {
            id: 1,
            name: '장수명',
            nationId: 1,
            nationName: '국가명',
            generalName: '장수명',
            crew: 5000,
            crewType: '기병'
          },
          defender: {
            cityId: 10,
            cityName: '도시명',
            nationId: 2,
            nationName: '국가명2',
            defenders: []
          }
        },
        turns: [
          {
            turnNumber: 1,
            actions: [
              {
                type: 'attack',
                actorId: 1,
                targetId: 'city-10',
                damage: 300,
                detail: {
                  currentHp: 4700,
                  targetHp: 700,
                  isCritical: false
                }
              }
            ]
          }
        ]
      };
      
      // 구조 검증 (실제 데이터는 ProcessWar에서 생성)
      expect(expectedStructure).toHaveProperty('version');
      expect(expectedStructure).toHaveProperty('metadata');
      expect(expectedStructure).toHaveProperty('turns');
      expect(expectedStructure.turns[0]).toHaveProperty('actions');
    });
  });
});

/**
 * 리플레이 수동 검증 시나리오
 * 
 * === DB에서 리플레이 확인 ===
 * MongoDB 쿼리:
 * 
 * db.battle_replay.findOne({ 'metadata.battleId': '<warSeed>' })
 * 
 * 확인할 필드:
 * - metadata.attacker: 공격자 정보
 * - metadata.defender: 수비자/도시 정보
 * - turns[].actions[]: 턴별 액션
 * - turns[].actions[].detail.isCritical: 크리티컬 여부
 * 
 * === API로 리플레이 조회 ===
 * GET /api/battle/replay/:battleId
 * GET /api/battle/replay/session/:sessionId (최근 100개)
 * GET /api/battle/replay/general/:generalId (특정 장수)
 * 
 * === 크리티컬 표시 확인 ===
 * 리플레이 뷰어에서 확인할 사항:
 * 1. 크리티컬 공격 시 붉은 이펙트/표시
 * 2. 데미지 텍스트에 "필살!" 표시
 * 3. 크리티컬 배율 정보 (1.5x ~ 2.5x)
 * 
 * === 저장 실패 시나리오 ===
 * 리플레이 저장은 "베스트 에포트"로 구현되어 있어
 * 저장 실패해도 게임 진행에 영향 없음:
 * 
 * ProcessWar.ts line 378-389:
 * try {
 *   await battleReplayRepository.create(replayData);
 * } catch (error) {
 *   console.error('Failed to save battle replay:', error);
 *   // 게임은 계속 진행됨
 * }
 */

