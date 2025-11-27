/**
 * General Model - PHP Parity Tests
 * 
 * PHP 대응: core/hwe/sammo/General.php, GeneralBase.php
 * 
 * 이 테스트는 TypeScript General 모델이 PHP 원본과 동일하게 동작하는지 검증합니다.
 */

import mongoose from 'mongoose';
import { General, IGeneral } from '../general.model';
import { PenaltyKey, getPenaltyHelpText, tryPenaltyKeyFrom } from '../../Enums/PenaltyKey';
import { RankColumn, tryRankColumnFrom, getRankColumnCases } from '../../Enums/RankColumn';

// 테스트용 장수 생성 헬퍼
function createTestGeneral(overrides: Partial<any> = {}): IGeneral {
  const doc = new General({
    no: 1,
    session_id: 'test_session',
    owner: 'test_owner',
    name: '테스트장수',
    data: {
      gold: 10000,
      rice: 5000,
      leadership: 80,
      strength: 75,
      intel: 85,
      politics: 70,
      charm: 65,
      experience: 0,
      dedication: 0,
      injury: 0,
      train: 100,
      atmos: 100,
      ...overrides.data
    },
    aux: overrides.aux || {},
    rank: overrides.rank || {},
    penalty: overrides.penalty || {},
    ...overrides
  });
  
  return doc;
}

describe('General Model - PHP Parity', () => {
  
  describe('getVar / setVar / updateVar', () => {
    
    it('getVar should return value from data', () => {
      const general = createTestGeneral();
      expect(general.getVar('gold')).toBe(10000);
      expect(general.getVar('leadership')).toBe(80);
    });
    
    it('getVar should return undefined for unknown key', () => {
      const general = createTestGeneral();
      expect(general.getVar('unknown_key')).toBeUndefined();
    });
    
    it('setVar should update value and track changes', () => {
      const general = createTestGeneral();
      general.setVar('gold', 20000);
      
      expect(general.getVar('gold')).toBe(20000);
      expect(general.hasUpdatedVar('gold')).toBe(true);
    });
    
    it('setVar should skip update if value is same (PHP behavior)', () => {
      const general = createTestGeneral();
      general.setVar('gold', 10000);  // 동일한 값
      
      expect(general.hasUpdatedVar('gold')).toBe(false);
    });
    
    it('updateVar should track changes', () => {
      const general = createTestGeneral();
      general.updateVar('gold', 15000);
      
      const updated = general.getUpdatedValues();
      expect(updated).toHaveProperty('gold');
      expect(updated.gold).toBe(15000);
    });
    
    it('flushUpdateValues should clear tracking', () => {
      const general = createTestGeneral();
      general.setVar('gold', 20000);
      general.flushUpdateValues();
      
      expect(general.hasUpdatedVar('gold')).toBe(false);
      expect(Object.keys(general.getUpdatedValues()).length).toBe(0);
    });
  });
  
  describe('increaseVar / increaseVarWithLimit', () => {
    
    it('increaseVar should add value', () => {
      const general = createTestGeneral();
      general.increaseVar('gold', 5000);
      
      expect(general.getVar('gold')).toBe(15000);
    });
    
    it('increaseVar with 0 should do nothing (PHP behavior)', () => {
      const general = createTestGeneral();
      general.increaseVar('gold', 0);
      
      expect(general.hasUpdatedVar('gold')).toBe(false);
    });
    
    it('increaseVarWithLimit should respect max limit', () => {
      const general = createTestGeneral();
      general.increaseVarWithLimit('gold', 100000, null, 50000);
      
      expect(general.getVar('gold')).toBe(50000);
    });
    
    it('increaseVarWithLimit should respect min limit', () => {
      const general = createTestGeneral();
      general.increaseVarWithLimit('gold', -50000, 0, null);
      
      expect(general.getVar('gold')).toBe(0);
    });
  });
  
  describe('multiplyVar / multiplyVarWithLimit', () => {
    
    it('multiplyVar should multiply value', () => {
      const general = createTestGeneral();
      general.multiplyVar('gold', 2);
      
      expect(general.getVar('gold')).toBe(20000);
    });
    
    it('multiplyVar with 1 should do nothing (PHP behavior)', () => {
      const general = createTestGeneral();
      general.multiplyVar('gold', 1);
      
      expect(general.hasUpdatedVar('gold')).toBe(false);
    });
    
    it('multiplyVarWithLimit should respect limits', () => {
      const general = createTestGeneral();
      general.multiplyVarWithLimit('gold', 0.5, 6000, null);
      
      expect(general.getVar('gold')).toBe(6000);  // 10000 * 0.5 = 5000 -> min 6000
    });
  });
  
  describe('aux 관리 (getAuxVar / setAuxVar)', () => {
    
    it('getAuxVar should return null for unset key', () => {
      const general = createTestGeneral();
      expect(general.getAuxVar('nonexistent')).toBeNull();
    });
    
    it('setAuxVar should set value', () => {
      const general = createTestGeneral();
      general.setAuxVar('inheritBuff', { type: 'attack', value: 10 });
      
      expect(general.getAuxVar('inheritBuff')).toEqual({ type: 'attack', value: 10 });
    });
    
    it('setAuxVar with null should delete key (PHP behavior)', () => {
      const general = createTestGeneral({ aux: { testKey: 'testValue' } });
      general.setAuxVar('testKey', null);
      
      expect(general.getAuxVar('testKey')).toBeNull();
    });
    
    it('setAuxVar should skip update if value is same', () => {
      const general = createTestGeneral({ aux: { testKey: 123 } });
      general.setAuxVar('testKey', 123);
      
      // aux는 별도로 추적하므로, 동일 값이면 auxUpdated가 false여야 함
      // (구현에서 확인)
    });
  });
  
  describe('페널티 시스템', () => {
    
    it('hasPenalty should return false for no penalty', () => {
      const general = createTestGeneral();
      expect(general.hasPenalty(PenaltyKey.NoChief)).toBe(false);
    });
    
    it('setPenalty should add penalty', () => {
      const general = createTestGeneral();
      general.setPenalty(PenaltyKey.NoChief, 1);
      
      expect(general.hasPenalty(PenaltyKey.NoChief)).toBe(true);
      expect(general.getPenalty(PenaltyKey.NoChief)).toBe(1);
    });
    
    it('removePenalty should delete penalty', () => {
      const general = createTestGeneral({ penalty: { [PenaltyKey.NoChief]: 1 } });
      general.removePenalty(PenaltyKey.NoChief);
      
      expect(general.hasPenalty(PenaltyKey.NoChief)).toBe(false);
    });
    
    it('getPenaltyList should return Map', () => {
      const general = createTestGeneral({ 
        penalty: { 
          [PenaltyKey.NoChief]: 1,
          [PenaltyKey.NoFoundNation]: 5
        } 
      });
      
      const list = general.getPenaltyList();
      expect(list).toBeInstanceOf(Map);
      expect(list.size).toBe(2);
      expect(list.get(PenaltyKey.NoChief)).toBe(1);
    });
    
    it('should work with string key', () => {
      const general = createTestGeneral();
      general.setPenalty('noChief', 1);
      
      expect(general.hasPenalty('noChief')).toBe(true);
    });
  });
  
  describe('랭크 시스템', () => {
    
    it('getRankVar should return default for unset key', () => {
      const general = createTestGeneral();
      expect(general.getRankVar(RankColumn.killnum, 0)).toBe(0);
    });
    
    it('setRankVar should set value', () => {
      const general = createTestGeneral();
      general.setRankVar(RankColumn.killnum, 10);
      
      expect(general.getRankVar(RankColumn.killnum)).toBe(10);
    });
    
    it('increaseRankVar should add value', () => {
      const general = createTestGeneral({ rank: { [RankColumn.killnum]: 5 } });
      general.increaseRankVar(RankColumn.killnum, 3);
      
      expect(general.getRankVar(RankColumn.killnum)).toBe(8);
    });
    
    it('should work with string key', () => {
      const general = createTestGeneral();
      general.setRankVar('killnum', 10);
      
      expect(general.getRankVar('killnum')).toBe(10);
    });
  });
  
  describe('능력치 조회 (getLeadership/Strength/Intel/Politics/Charm)', () => {
    
    it('getLeadership should return leadership value', () => {
      const general = createTestGeneral();
      expect(general.getLeadership()).toBe(80);
    });
    
    it('getStrength should return strength value (with stat adjust)', () => {
      const general = createTestGeneral();
      // strength = 75 + round(intel(85) / 4) = 75 + 21 = 96 (기본적으로 withStatAdjust=true)
      expect(general.getStrength()).toBe(96);
      // withStatAdjust=false면 원본 값 반환
      expect(general.getStrength(true, true, false)).toBe(75);
    });
    
    it('getIntel should return intel value (with stat adjust)', () => {
      const general = createTestGeneral();
      // intel = 85 + round(strength(75) / 4) = 85 + 19 = 104 (기본적으로 withStatAdjust=true)
      expect(general.getIntel()).toBe(104);
      // withStatAdjust=false면 원본 값 반환
      expect(general.getIntel(true, true, false)).toBe(85);
    });
    
    it('getPolitics should return politics value', () => {
      const general = createTestGeneral();
      expect(general.getPolitics()).toBe(70);
    });
    
    it('getCharm should return charm value', () => {
      const general = createTestGeneral();
      expect(general.getCharm()).toBe(65);
    });
    
    it('should apply injury penalty', () => {
      const general = createTestGeneral({ data: { leadership: 100, injury: 50 } });
      
      // 100 * (100 - 50) / 100 = 50
      expect(general.getLeadership(true, false, false)).toBe(50);
    });
    
    it('should not apply injury when withInjury=false', () => {
      const general = createTestGeneral({ data: { leadership: 100, injury: 50 } });
      
      expect(general.getLeadership(false, false, false)).toBe(100);
    });
    
    it('should apply stat adjustment between strength and intel', () => {
      const general = createTestGeneral({ 
        data: { strength: 100, intel: 40, injury: 0 }
      });
      
      // strength = 100 + round(40/4) = 110 -> capped at 150
      const strengthWithAdjust = general.getStrength(false, false, true);
      expect(strengthWithAdjust).toBe(110);
    });
  });
});

describe('PenaltyKey Enum', () => {
  
  it('should have all PHP penalty keys', () => {
    expect(PenaltyKey.SendPrivateMsgDelay).toBe('sendPrivateMsgDelay');
    expect(PenaltyKey.NoSendPrivateMsg).toBe('noSendPrivateMsg');
    expect(PenaltyKey.NoSendPublicMsg).toBe('noSendPublicMsg');
    expect(PenaltyKey.NoTopSecret).toBe('noTopSecret');
    expect(PenaltyKey.NoChief).toBe('noChief');
    expect(PenaltyKey.NoAmbassador).toBe('noAmbassador');
    expect(PenaltyKey.NoBanGeneral).toBe('noBanGeneral');
    expect(PenaltyKey.NoChiefTurnInput).toBe('noChiefTurnInput');
    expect(PenaltyKey.NoChiefChange).toBe('noChiefChange');
    expect(PenaltyKey.NoFoundNation).toBe('noFoundNation');
    expect(PenaltyKey.NoChosenAssignment).toBe('noChosenAssignment');
  });
  
  it('getPenaltyHelpText should return Korean text', () => {
    expect(getPenaltyHelpText(PenaltyKey.NoChief)).toBe('수뇌 금지');
    expect(getPenaltyHelpText(PenaltyKey.NoFoundNation)).toBe('건국 금지');
  });
  
  it('tryPenaltyKeyFrom should convert valid string', () => {
    expect(tryPenaltyKeyFrom('noChief')).toBe(PenaltyKey.NoChief);
  });
  
  it('tryPenaltyKeyFrom should return null for invalid string', () => {
    expect(tryPenaltyKeyFrom('invalidKey')).toBeNull();
  });
});

describe('RankColumn Enum', () => {
  
  it('should have all PHP rank columns', () => {
    expect(RankColumn.firenum).toBe('firenum');
    expect(RankColumn.warnum).toBe('warnum');
    expect(RankColumn.killnum).toBe('killnum');
    expect(RankColumn.killcrew).toBe('killcrew');
    expect(RankColumn.occupied).toBe('occupied');
  });
  
  it('tryRankColumnFrom should convert valid string', () => {
    expect(tryRankColumnFrom('killnum')).toBe(RankColumn.killnum);
  });
  
  it('tryRankColumnFrom should return null for invalid string', () => {
    expect(tryRankColumnFrom('invalidColumn')).toBeNull();
  });
  
  it('getRankColumnCases should return all columns', () => {
    const cases = getRankColumnCases();
    expect(cases.length).toBeGreaterThan(0);
    expect(cases).toContain(RankColumn.killnum);
    expect(cases).toContain(RankColumn.warnum);
  });
});

describe('General Model - 아이템 관리', () => {
  
  it('getItem should return item action', () => {
    const general = createTestGeneral({ data: { weapon: 'None' } });
    const item = general.getItem('weapon');
    expect(item).toBeDefined();
    expect(item.id).toBe('None');
  });
  
  it('setItem should update item', () => {
    const general = createTestGeneral();
    general.setItem('weapon', 'sword_1');
    expect(general.getVar('weapon')).toBe('sword_1');
  });
  
  it('deleteItem should set to None', () => {
    const general = createTestGeneral({ data: { weapon: 'sword_1' } });
    general.deleteItem('weapon');
    expect(general.getVar('weapon')).toBe('None');
  });
  
  it('getItems should return all items', () => {
    const general = createTestGeneral();
    const items = general.getItems();
    expect(items).toHaveProperty('horse');
    expect(items).toHaveProperty('weapon');
    expect(items).toHaveProperty('book');
    expect(items).toHaveProperty('item');
  });
});

describe('General Model - 특성 접근자', () => {
  
  it('getPersonality should return personality action', () => {
    const general = createTestGeneral({ data: { personal: 'che_대의' } });
    const personality = general.getPersonality();
    expect(personality).toBeDefined();
  });
  
  it('getSpecialDomestic should return domestic action', () => {
    const general = createTestGeneral({ data: { special: 'che_거상' } });
    const domestic = general.getSpecialDomestic();
    expect(domestic).toBeDefined();
  });
  
  it('getSpecialWar should return war action', () => {
    const general = createTestGeneral({ data: { special2: 'che_필살' } });
    const war = general.getSpecialWar();
    expect(war).toBeDefined();
  });
});

describe('General Model - 스킬 활성화 추적', () => {
  
  it('activateSkill should set skill to active', () => {
    const general = createTestGeneral();
    general.activateSkill('필살');
    
    expect(general.hasActivatedSkill('필살')).toBe(true);
    expect(general.hasActivatedSkill('회피')).toBe(false);
  });
  
  it('deactivateSkill should set skill to inactive', () => {
    const general = createTestGeneral();
    general.activateSkill('필살');
    general.deactivateSkill('필살');
    
    expect(general.hasActivatedSkill('필살')).toBe(false);
  });
  
  it('clearActivatedSkill should log and reset', () => {
    const general = createTestGeneral();
    general.activateSkill('필살', '회피');
    general.clearActivatedSkill();
    
    const log = general.getActivatedSkillLog();
    expect(log['필살']).toBe(1);
    expect(log['회피']).toBe(1);
    expect(general.hasActivatedSkill('필살')).toBe(false);
  });
  
  it('clearActivatedSkill multiple times should accumulate log', () => {
    const general = createTestGeneral();
    
    general.activateSkill('필살');
    general.clearActivatedSkill();
    
    general.activateSkill('필살');
    general.clearActivatedSkill();
    
    const log = general.getActivatedSkillLog();
    expect(log['필살']).toBe(2);
  });
});

describe('General Model - 기타 메서드', () => {
  
  it('getName should return name', () => {
    const general = createTestGeneral();
    expect(general.getName()).toBe('테스트장수');
  });
  
  it('getNPCType should return npc type', () => {
    const general = createTestGeneral({ npc: 2 });
    expect(general.getNPCType()).toBe(2);
  });
  
  it('getActionList should include all action types', () => {
    const general = createTestGeneral({
      data: {
        special: 'che_거상',
        special2: 'che_필살',
        personal: 'che_대의'
      }
    });
    
    const actions = general.getActionList();
    expect(actions.length).toBeGreaterThan(0);
  });
  
  it('calcRecentWarTurn should return large value when no recent war', () => {
    const general = createTestGeneral();
    expect(general.calcRecentWarTurn(60)).toBe(12000);
  });
  
  it('calcRecentWarTurn should calculate turns from recent war', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    const general = createTestGeneral({
      turntime: now,
      data: {
        recent_war: twoHoursAgo.toISOString(),
        turntime: now.toISOString()
      }
    });
    
    // 2시간 = 120분, turnTerm=60이면 2턴
    expect(general.calcRecentWarTurn(60)).toBe(2);
  });
});

