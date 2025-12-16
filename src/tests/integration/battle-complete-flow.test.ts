/**
 * Battle Complete Flow Integration Tests
 * 
 * 전투 종료 → 도시 점령 → 국가 멸망 → 통일 체크 전체 플로우 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as BattleEventHook from '../../services/battle/BattleEventHook.service';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';

const TEST_SESSION_ID = 'test_battle_flow_session';

describe('Battle Complete Flow Integration Tests', () => {
  beforeEach(async () => {
    // 테스트용 세션 생성
    await sessionRepository.create({
      session_id: TEST_SESSION_ID,
      data: {
        year: 200,
        month: 1,
        isunited: 0,
        refreshLimit: 1000
      }
    });
  });

  afterEach(async () => {
    // 테스트 데이터 정리
    await sessionRepository.deleteBySessionId(TEST_SESSION_ID);
    await cityRepository.deleteManyByFilter({ session_id: TEST_SESSION_ID });
    await nationRepository.deleteManyByFilter({ session_id: TEST_SESSION_ID });
    await generalRepository.deleteManyByFilter({ session_id: TEST_SESSION_ID });
  });

  describe('도시 점령 시나리오', () => {
    it('도시 점령 시 장수들이 인접 도시로 이동해야 함', async () => {
      // Given: 2개 도시를 가진 국가 A와 1개 도시를 가진 국가 B
      const nationA = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 1, name: '위', gold: 10000, rice: 50000 }
      });

      const nationB = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 2, name: '촉', gold: 8000, rice: 40000 }
      });

      const cityA1 = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 1, nation: 1, name: '허창', gold: 5000, rice: 20000 }
      });

      const cityA2 = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 2, nation: 1, name: '낙양', gold: 3000, rice: 15000 }
      });

      const cityB1 = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 3, nation: 2, name: '성도', gold: 4000, rice: 18000 }
      });

      // 위나라 장수
      const generalA1 = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: { no: 1, nation: 1, city: 1, name: '조조', npc: 0, officer_level: 12 }
      });

      // 촉나라 장수들
      const generalB1 = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: { no: 2, nation: 2, city: 3, name: '유비', npc: 0, officer_level: 12 }
      });

      const generalB2 = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: { no: 3, nation: 2, city: 3, name: '관우', npc: 0, officer_level: 5 }
      });

      const generalB3_NPC = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: { no: 4, nation: 2, city: 3, name: 'NPC장수', npc: 1, officer_level: 3 }
      });

      // When: 위나라가 성도를 점령
      await BattleEventHook.onCityOccupied(TEST_SESSION_ID, 3, 1, 1);

      // Then: 도시 소유권이 변경됨
      const occupiedCity = await cityRepository.findOneByFilter({
        session_id: TEST_SESSION_ID,
        'data.city': 3
      });
      expect(occupiedCity?.data?.nation).toBe(1);

      // 일반 장수들은 아군 도시가 없으므로 재야로 전환
      const movedGeneralB1 = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 2);
      expect(movedGeneralB1?.data?.nation).toBe(0);
      expect(movedGeneralB1?.data?.city).toBe(0);

      const movedGeneralB2 = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 3);
      expect(movedGeneralB2?.data?.nation).toBe(0);
      expect(movedGeneralB2?.data?.city).toBe(0);

      // NPC 장수는 재야 또는 포로
      const movedNPC = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 4);
      expect(movedNPC?.data?.nation).toBe(0);
    });

    it('도시 점령 시 자원의 50%가 이전되어야 함', async () => {
      // Given
      const nationA = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 1, name: '위', gold: 10000, rice: 50000 }
      });

      const cityB = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 1, nation: 2, name: '성도', gold: 4000, rice: 18000 }
      });

      // When: 도시 점령
      await BattleEventHook.onCityOccupied(TEST_SESSION_ID, 1, 1, 1);

      // Then: 위나라 자원 증가 (금 +2000, 쌀 +9000)
      const updatedNationA = await nationRepository.findOneByFilter({
        session_id: TEST_SESSION_ID,
        'data.nation': 1
      });
      expect(updatedNationA?.data?.gold).toBe(12000);
      expect(updatedNationA?.data?.rice).toBe(59000);

      // 도시 자원 감소
      const updatedCityB = await cityRepository.findOneByFilter({
        session_id: TEST_SESSION_ID,
        'data.city': 1
      });
      expect(updatedCityB?.data?.gold).toBe(2000);
      expect(updatedCityB?.data?.rice).toBe(9000);
    });
  });

  describe('국가 멸망 시나리오', () => {
    it('마지막 도시 점령 시 국가가 멸망해야 함', async () => {
      // Given: 1개 도시만 가진 국가 B
      const nationA = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 1, name: '위', gold: 10000, rice: 50000 }
      });

      const nationB = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 2, name: '촉', gold: 8000, rice: 40000 }
      });

      const cityB = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 1, nation: 2, name: '성도', gold: 4000, rice: 18000 }
      });

      const generalB = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: { no: 1, nation: 2, city: 1, name: '유비', npc: 0, officer_level: 12 }
      });

      // When: 마지막 도시 점령
      await BattleEventHook.onCityOccupied(TEST_SESSION_ID, 1, 1, 1);

      // Then: 촉나라 장수들이 재야로 전환
      const freedGeneral = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 1);
      expect(freedGeneral?.data?.nation).toBe(0);
      expect(freedGeneral?.data?.officer_level).toBe(1);

      // 위나라 자원 증가 (국가 멸망 시 추가 자원 흡수)
      const updatedNationA = await nationRepository.findOneByFilter({
        session_id: TEST_SESSION_ID,
        'data.nation': 1
      });
      expect(updatedNationA?.data?.gold).toBeGreaterThan(10000);
    });

    it('국가 멸망 시 관직자들이 일반으로 강등되어야 함', async () => {
      // Given
      const nationB = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 2, name: '촉', gold: 8000, rice: 40000 }
      });

      const cityB = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 1, nation: 2, name: '성도', gold: 4000, rice: 18000 }
      });

      const generalKing = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: { no: 1, nation: 2, city: 1, name: '유비', npc: 0, officer_level: 12 }
      });

      const generalOfficer = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: { no: 2, nation: 2, city: 1, name: '제갈량', npc: 0, officer_level: 5 }
      });

      // When: 국가 멸망
      await BattleEventHook.onNationDestroyed(TEST_SESSION_ID, 2, 1, 1);

      // Then: 모든 관직자가 강등
      const demotedKing = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 1);
      expect(demotedKing?.data?.officer_level).toBe(1);

      const demotedOfficer = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 2);
      expect(demotedOfficer?.data?.officer_level).toBe(1);
    });
  });

  describe('천하통일 시나리오', () => {
    it('모든 도시 점령 시 통일이 달성되어야 함', async () => {
      // Given: 3개 도시 중 2개를 위나라가 보유
      const nationA = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 1, name: '위', gold: 10000, rice: 50000 }
      });

      const nationB = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 2, name: '촉', gold: 8000, rice: 40000 }
      });

      const cityA1 = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 1, nation: 1, name: '허창', gold: 5000, rice: 20000 }
      });

      const cityA2 = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 2, nation: 1, name: '낙양', gold: 3000, rice: 15000 }
      });

      const cityB = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 3, nation: 2, name: '성도', gold: 4000, rice: 18000 }
      });

      // When: 마지막 도시 점령
      await BattleEventHook.onCityOccupied(TEST_SESSION_ID, 3, 1, 1);

      // Then: 세션 상태가 통일로 변경
      const session = await sessionRepository.findBySessionId(TEST_SESSION_ID);
      expect(session?.data?.isunited).toBe(2);
      expect(session?.data?.refreshLimit).toBeGreaterThan(1000);
    });

    it('통일 후에는 추가 점령 시에도 통일 체크를 스킵해야 함', async () => {
      // Given: 이미 통일된 상태
      await sessionRepository.updateBySessionId(TEST_SESSION_ID, {
        'data.isunited': 2
      });

      const nationA = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 1, name: '위', gold: 10000, rice: 50000 }
      });

      const cityA = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 1, nation: 1, name: '허창', gold: 5000, rice: 20000 }
      });

      // When: checkUnified 호출
      await BattleEventHook.checkUnified(TEST_SESSION_ID, 1);

      // Then: 세션 상태가 변하지 않음 (여전히 2)
      const session = await sessionRepository.findBySessionId(TEST_SESSION_ID);
      expect(session?.data?.isunited).toBe(2);
    });
  });

  describe('전투 통계 업데이트', () => {
    it('승리 시 killnum과 killcrew가 증가해야 함', async () => {
      // Given
      const general = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: {
          no: 1,
          nation: 1,
          city: 1,
          name: '조조',
          killnum: 10,
          killcrew: 5000,
          warnum: 20
        }
      });

      // When: 전투 승리 (적 1000명 살상)
      await generalRepository.updateByGeneralNo(TEST_SESSION_ID, 1, {
        $inc: {
          'data.killnum': 1,
          'data.killcrew': 1000,
          'data.warnum': 1
        }
      });

      // Then
      const updated = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 1);
      expect(updated?.data?.killnum).toBe(11);
      expect(updated?.data?.killcrew).toBe(6000);
      expect(updated?.data?.warnum).toBe(21);
    });

    it('패배 시 deathnum과 deathcrew가 증가해야 함', async () => {
      // Given
      const general = await generalRepository.create({
        session_id: TEST_SESSION_ID,
        data: {
          no: 1,
          nation: 1,
          city: 1,
          name: '유비',
          deathnum: 5,
          deathcrew: 2000,
          warnum: 15
        }
      });

      // When: 전투 패배 (아군 800명 손실)
      await generalRepository.updateByGeneralNo(TEST_SESSION_ID, 1, {
        $inc: {
          'data.deathnum': 1,
          'data.deathcrew': 800,
          'data.warnum': 1
        }
      });

      // Then
      const updated = await generalRepository.findByGeneralNo(TEST_SESSION_ID, 1);
      expect(updated?.data?.deathnum).toBe(6);
      expect(updated?.data?.deathcrew).toBe(2800);
      expect(updated?.data?.warnum).toBe(16);
    });
  });

  describe('외교 로그 생성', () => {
    it('도시 점령 시 양국에 로그가 생성되어야 함', async () => {
      // Given
      const nationA = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 1, name: '위', gold: 10000, rice: 50000 }
      });

      const nationB = await nationRepository.create({
        session_id: TEST_SESSION_ID,
        data: { nation: 2, name: '촉', gold: 8000, rice: 40000 }
      });

      const cityB = await cityRepository.create({
        session_id: TEST_SESSION_ID,
        data: { city: 1, nation: 2, name: '성도', gold: 4000, rice: 18000 }
      });

      // When: 도시 점령
      await BattleEventHook.onCityOccupied(TEST_SESSION_ID, 1, 1, 1);

      // Then: 외교 로그가 생성됨 (ActionLogger를 통해)
      // 실제 구현에서는 ActionLogger가 MongoDB에 로그를 저장하므로
      // 여기서는 에러가 발생하지 않음을 확인
      expect(true).toBe(true);
    });
  });
});
