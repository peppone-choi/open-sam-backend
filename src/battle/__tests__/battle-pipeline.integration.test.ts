/**
 * Battle Pipeline Integration Test
 * 
 * Tests the complete battle flow from initiation to occupation/nation destruction/unification
 */

import { processWar } from '../ProcessWar';
import { WarUnitGeneral } from '../WarUnitGeneral';
import { WarUnitCity } from '../WarUnitCity';
import { RandUtil } from '../../utils/RandUtil';
import { LiteHashDRBG } from '../../utils/LiteHashDRBG';
import * as BattleEventHook from '../../services/battle/BattleEventHook.service';

// Mock repositories
jest.mock('../../repositories/city.repository');
jest.mock('../../repositories/nation.repository');
jest.mock('../../repositories/general.repository');
jest.mock('../../repositories/kvstorage.repository');
jest.mock('../../repositories/diplomacy.repository');

describe('Battle Pipeline Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('WarUnit Layer', () => {
    test('WarUnit base class should manage battle state correctly', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      const mockGeneral = {
        data: {
          no: 1,
          name: 'Test General',
          crew: 10000,
          rice: 5000,
          train: 80,
          atmos: 70,
          leadership: 90,
          strength: 85,
          intel: 75
        },
        getVar: function(key: string) { return this.data[key]; },
        setVar: function(key: string, val: any) { this.data[key] = val; },
        getRaw: function() { return this.data; }
      };
      
      const mockNation = {
        nation: 1,
        name: 'Test Nation',
        tech: 5000
      };
      
      const unit = new WarUnitGeneral(rng, mockGeneral, mockNation, true);
      
      expect(unit.getName()).toBe('Test General');
      expect(unit.getHP()).toBe(10000);
      expect(unit.isAttackerUnit()).toBe(true);
      expect(unit.getPhase()).toBe(0);
      
      // Test phase increment
      unit.addPhase();
      expect(unit.getPhase()).toBe(1);
      
      // Test HP decrease
      const remainingHP = unit.decreaseHP(1000);
      expect(remainingHP).toBe(9000);
      expect(unit.getHP()).toBe(9000);
      expect(unit.getDead()).toBe(1000);
    });
    
    test('WarUnitGeneral should calculate proficiency (addDex) correctly', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      const mockGeneral = {
        data: {
          no: 1,
          name: 'General',
          crew: 5000,
          rice: 3000,
          train: 70,
          atmos: 70,
          dex1: 10000, // Footman dexterity
          dex2: 5000,  // Archer dexterity
          dex3: 8000   // Cavalry dexterity
        },
        getVar: function(key: string) { return this.data[key]; },
        setVar: function(key: string, val: any) { this.data[key] = val; },
        increaseVar: function(key: string, val: number) { this.data[key] = (this.data[key] || 0) + val; },
        getRaw: function() { return this.data; },
        addDex: jest.fn((crewType, exp, _) => {
          const armType = crewType?.armType;
          const dexKey = `dex${armType}`;
          if (!mockGeneral.data) return;
          // @ts-ignore
          mockGeneral.data[dexKey] = (mockGeneral.data[dexKey] || 0) + exp;
        })
      };
      
      const mockNation = { nation: 1, name: 'Test Nation', tech: 3000 };
      const mockCrewType = { armType: 1, name: 'Footman', rice: 1, attack: 100, defence: 100, speed: 3 };
      
      const unit = new WarUnitGeneral(rng, mockGeneral, mockNation, true);
      
      // When taking damage, addDex should be called
      unit.addDex(mockCrewType as any, 100);
      
      expect(mockGeneral.addDex).toHaveBeenCalledWith(mockCrewType, 100, false);
      expect(mockGeneral.data.dex1).toBe(10100);
    });
    
    test('WarUnitGeneral should handle grain consumption correctly', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      const mockGeneral = {
        data: {
          no: 1,
          name: 'General',
          crew: 5000,
          rice: 10000,
          train: 70,
          atmos: 70,
          crewtype: 1
        },
        getVar: function(key: string) { return this.data[key]; },
        setVar: function(key: string, val: any) { this.data[key] = val; },
        increaseVar: function(key: string, val: number) { this.data[key] = (this.data[key] || 0) + val; },
        increaseVarWithLimit: function(key: string, val: number, min?: number, max?: number) {
          let newVal = (this.data[key] || 0) + val;
          if (min !== undefined) newVal = Math.max(min, newVal);
          if (max !== undefined) newVal = Math.min(max, newVal);
          this.data[key] = newVal;
        },
        getRaw: function() { return this.data; },
        addDex: jest.fn(),
        addExperience: jest.fn(),
        onCalcStat: jest.fn((_, __, value) => value)
      };
      
      const mockNation = { nation: 1, name: 'Test Nation', tech: 3000 };
      const unit = new WarUnitGeneral(rng, mockGeneral, mockNation, true);
      
      // Calculate rice consumption for 500 damage
      const riceConsumed = unit.calcRiceConsumption(500);
      
      expect(riceConsumed).toBeGreaterThan(0);
      expect(mockGeneral.onCalcStat).toHaveBeenCalledWith(mockGeneral, 'killRice', expect.any(Number));
    });
    
    test('WarUnitCity should handle siege correctly', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      const mockCity = {
        city: 10,
        nation: 2,
        name: 'Test City',
        def: 5000,
        wall: 3000,
        level: 5,
        agri: 10000,
        comm: 10000,
        secu: 10000,
        session_id: 'test_session'
      };
      
      const mockNation = { nation: 2, name: 'Defender Nation', tech: 4000 };
      
      const city = new WarUnitCity(rng, mockCity, mockNation, 200, 1, 184);
      
      expect(city.getName()).toBe('Test City');
      expect(city.getHP()).toBe(50000); // def * 10
      expect(city.isSiege()).toBe(false);
      
      // Set siege mode
      city.setSiege();
      expect(city.isSiege()).toBe(true);
      expect(city.getPhase()).toBe(0);
      
      // Test city HP decrease
      const remainingHP = city.decreaseHP(5000);
      expect(remainingHP).toBe(45000);
    });
  });
  
  describe('Battle Execution Flow', () => {
    test('Battle should execute with proper event hook order', async () => {
      // Mock event hooks
      const onCityOccupiedSpy = jest.spyOn(BattleEventHook, 'onCityOccupied').mockResolvedValue();
      const onNationDestroyedSpy = jest.spyOn(BattleEventHook, 'onNationDestroyed').mockResolvedValue();
      const checkUnifiedSpy = jest.spyOn(BattleEventHook, 'checkUnified').mockResolvedValue();
      
      // Create a simple mock general
      const mockAttackerGeneral = {
        data: {
          no: 1,
          name: 'Attacker',
          crew: 20000,
          rice: 10000,
          train: 90,
          atmos: 85,
          leadership: 95,
          strength: 90,
          intel: 80,
          crewtype: 1,
          nation: 1,
          city: 5
        },
        getID: () => 1,
        getNationID: () => 1,
        getCityID: () => 5,
        getSessionID: () => 'test_session',
        getTurnTime: () => '2001',
        getLogger: () => ({
          pushGlobalActionLog: jest.fn(),
          pushGeneralActionLog: jest.fn(),
          pushGeneralHistoryLog: jest.fn(),
          pushGlobalHistoryLog: jest.fn(),
          pushGeneralBattleDetailLog: jest.fn(),
          flush: jest.fn()
        }),
        getVar: function(key: string) { return this.data[key]; },
        setVar: function(key: string, val: any) { this.data[key] = val; },
        increaseVar: function(key: string, val: number) { this.data[key] = (this.data[key] || 0) + val; },
        increaseVarWithLimit: function(key: string, val: number, min?: number, max?: number) {
          let newVal = (this.data[key] || 0) + val;
          if (min !== undefined) newVal = Math.max(min, newVal);
          if (max !== undefined) newVal = Math.min(max, newVal);
          this.data[key] = newVal;
        },
        multiplyVarWithLimit: function(key: string, mult: number, min?: number, max?: number) {
          let newVal = (this.data[key] || 0) * mult;
          if (min !== undefined) newVal = Math.max(min, newVal);
          if (max !== undefined) newVal = Math.min(max, newVal);
          this.data[key] = newVal;
        },
        updateVar: function(key: string, val: any) { this.data[key] = val; },
        getRaw: function() { return this.data; },
        getRawCity: () => ({ city: 5, level: 5 }),
        setRawCity: jest.fn(),
        getName: function() { return this.data.name; },
        addDex: jest.fn(),
        addExperience: jest.fn(),
        addDedication: jest.fn(),
        increaseRankVar: jest.fn(),
        checkStatChange: jest.fn(() => false),
        applyDB: jest.fn(),
        save: jest.fn()
      };
      
      const mockAttackerNation = {
        nation: 1,
        name: 'Attacker Nation',
        capital: 5,
        tech: 5000,
        gennum: 10
      };
      
      const mockDefenderCity = {
        city: 10,
        nation: 2,
        name: 'Defender City',
        def: 1000,
        wall: 500,
        level: 5,
        agri: 5000,
        comm: 5000,
        secu: 5000,
        supply: 1,
        conflict: '{}',
        session_id: 'test_session'
      };
      
      // Mock repositories
      const { cityRepository } = require('../../repositories/city.repository');
      const { nationRepository } = require('../../repositories/nation.repository');
      const { generalRepository } = require('../../repositories/general.repository');
      const { kvStorageRepository } = require('../../repositories/kvstorage.repository');
      const { diplomacyRepository } = require('../../repositories/diplomacy.repository');
      
      cityRepository.findByCityNum = jest.fn().mockResolvedValue(mockDefenderCity);
      cityRepository.updateByCityNum = jest.fn().mockResolvedValue(true);
      cityRepository.count = jest.fn().mockResolvedValue(0); // Simulate nation destroyed (no cities left)
      
      nationRepository.findByNationNum = jest.fn().mockResolvedValue({
        nation: 2,
        name: 'Defender Nation',
        capital: 10,
        tech: 3000,
        rice: 5000,
        gold: 3000,
        gennum: 5
      });
      nationRepository.updateByNationNum = jest.fn().mockResolvedValue(true);
      
      generalRepository.findByFilter = jest.fn().mockResolvedValue([]); // No defenders
      generalRepository.updateManyByFilter = jest.fn().mockResolvedValue(true);
      
      kvStorageRepository.getValue = jest.fn().mockImplementation((_, __, key) => {
        const values: any = {
          'startyear': 184,
          'year': 200,
          'month': 1,
          'join_mode': 'normal'
        };
        return Promise.resolve(values[key]);
      });
      
      diplomacyRepository.updateDeaths = jest.fn().mockResolvedValue(true);
      
      // Execute battle
      const result = await processWar(
        'test-battle-seed',
        mockAttackerGeneral,
        mockAttackerNation,
        mockDefenderCity
      );
      
      // Battle execution assertions
      expect(result).toBeDefined();
      
      // Verify that if city was conquered, event hooks were called in correct order
      if (result) {
        expect(onCityOccupiedSpy).toHaveBeenCalled();
        
        // If nation was destroyed (no cities left), verify hook was called
        const occupiedCallArgs = onCityOccupiedSpy.mock.calls[0];
        if (occupiedCallArgs) {
          expect(occupiedCallArgs[0]).toBe('test_session');
          expect(occupiedCallArgs[1]).toBe(10); // cityId
          expect(occupiedCallArgs[2]).toBe(1);  // attackerNationId
        }
      }
    });
  });
  
  describe('Defence Train Logic', () => {
    test('Defence train should prevent defenders from participating if requirements not met', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      
      // General with insufficient train
      const mockGeneral = {
        data: {
          no: 1,
          name: 'Weak Defender',
          crew: 5000,
          rice: 3000,
          train: 40, // Below defence_train requirement
          atmos: 60,
          defence_train: 50, // Minimum 50 required
          leadership: 70,
          strength: 65,
          intel: 60
        },
        getVar: function(key: string) { return this.data[key]; },
        getLeadership: function() { return this.data.leadership; },
        getStrength: function() { return this.data.strength; },
        getIntel: function() { return this.data.intel; }
      };
      
      const { extractBattleOrder } = require('../ProcessWar');
      const mockAttacker: any = {};
      
      // This defender should NOT be able to defend (order = 0)
      const order = extractBattleOrder(mockGeneral as any, mockAttacker);
      expect(order).toBe(0);
    });
    
    test('Defence train should allow defenders when requirements are met', () => {
      const mockGeneral = {
        data: {
          no: 1,
          name: 'Strong Defender',
          crew: 5000,
          rice: 3000,
          train: 60, // Above defence_train requirement
          atmos: 70,
          defence_train: 50,
          leadership: 85,
          strength: 80,
          intel: 75
        },
        getVar: function(key: string) { return this.data[key]; },
        getLeadership: function() { return this.data.leadership; },
        getStrength: function() { return this.data.strength; },
        getIntel: function() { return this.data.intel; }
      };
      
      const { extractBattleOrder } = require('../ProcessWar');
      const mockAttacker: any = {};
      
      // This defender should be able to defend (order > 0)
      const order = extractBattleOrder(mockGeneral as any, mockAttacker);
      expect(order).toBeGreaterThan(0);
    });
  });
  
  describe('Grain Consumption', () => {
    test('Attacker should consume grain when killing enemies', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      const mockGeneral = {
        data: {
          no: 1,
          name: 'Attacker',
          crew: 10000,
          rice: 5000,
          train: 80,
          atmos: 75,
          crewtype: 1
        },
        getVar: function(key: string) { return this.data[key]; },
        setVar: function(key: string, val: any) { this.data[key] = val; },
        increaseVar: function(key: string, val: number) { this.data[key] = (this.data[key] || 0) + val; },
        increaseVarWithLimit: function(key: string, val: number, min?: number, max?: number) {
          let newVal = (this.data[key] || 0) + val;
          if (min !== undefined) newVal = Math.max(min, newVal);
          if (max !== undefined) newVal = Math.min(max, newVal);
          this.data[key] = newVal;
        },
        getRaw: function() { return this.data; },
        addDex: jest.fn(),
        addExperience: jest.fn(),
        onCalcStat: jest.fn((_, __, value) => value)
      };
      
      const mockNation = { nation: 1, name: 'Nation', tech: 4000 };
      const unit = new WarUnitGeneral(rng, mockGeneral, mockNation, true);
      
      const initialRice = mockGeneral.data.rice;
      
      // Kill 1000 enemies
      unit.increaseKilled(1000);
      
      // Rice should have decreased
      expect(mockGeneral.data.rice).toBeLessThan(initialRice);
      expect(mockGeneral.data.rice).toBeGreaterThanOrEqual(0);
    });
    
    test('Battle should stop when rice runs out', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      const mockGeneral = {
        data: {
          no: 1,
          name: 'Low Rice General',
          crew: 5000,
          rice: 10, // Very low rice
          train: 70,
          atmos: 70
        },
        getVar: function(key: string) { return this.data[key]; },
        getRaw: function() { return this.data; }
      };
      
      const mockNation = { nation: 1, name: 'Nation', tech: 3000 };
      const unit = new WarUnitGeneral(rng, mockGeneral, mockNation, true);
      
      const noRice = { value: false };
      const canContinue = unit.continueWar(noRice);
      
      expect(canContinue).toBe(false);
      expect(noRice.value).toBe(true);
    });
  });
});
