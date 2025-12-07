/**
 * FortressService 테스트
 */

import { FortressService, fortressService } from '../FortressService';
import { Fortress, IFortress } from '../../../models/gin7/Fortress';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { FORTRESS_SPECS } from '../../../types/gin7/fortress.types';

// MongoDB 모킹
jest.mock('../../../models/gin7/Fortress');
jest.mock('../../../models/gin7/Fleet');

describe('FortressService', () => {
  const sessionId = 'TEST-SESSION-001';
  let service: FortressService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new FortressService();
  });
  
  // ============================================================
  // 요새 생성 테스트
  // ============================================================
  
  describe('createFortress', () => {
    it('이제르론 요새를 생성해야 한다', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockFortress = {
        fortressId: 'FORT-12345678',
        sessionId,
        type: 'ISERLOHN',
        name: '이제르론 요새',
        ownerId: 'EMPIRE',
        save: mockSave,
      };
      
      (Fortress as unknown as jest.Mock).mockImplementation(() => mockFortress);
      
      const result = await service.createFortress({
        sessionId,
        type: 'ISERLOHN',
        ownerId: 'EMPIRE',
        location: {
          type: 'CORRIDOR',
          corridorId: 'ISERLOHN_CORRIDOR',
        },
      });
      
      expect(result.type).toBe('ISERLOHN');
      expect(result.ownerId).toBe('EMPIRE');
      expect(mockSave).toHaveBeenCalled();
    });
    
    it('가이에스부르크 요새는 이동 가능해야 한다', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      
      let capturedFortress: Partial<IFortress> = {};
      (Fortress as unknown as jest.Mock).mockImplementation((data) => {
        capturedFortress = { ...data, save: mockSave };
        return capturedFortress;
      });
      
      const result = await service.createFortress({
        sessionId,
        type: 'GEIERSBURG',
        ownerId: 'EMPIRE',
        location: {
          type: 'SYSTEM',
          systemId: 'ODIN',
        },
      });
      
      expect(capturedFortress.canMove).toBe(true);
    });
    
    it('스펙에 맞는 초기 HP/Shield가 설정되어야 한다', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      let capturedFortress: Partial<IFortress> = {};
      
      (Fortress as unknown as jest.Mock).mockImplementation((data) => {
        capturedFortress = { ...data, save: mockSave };
        return capturedFortress;
      });
      
      await service.createFortress({
        sessionId,
        type: 'ISERLOHN',
        ownerId: 'EMPIRE',
        location: { type: 'SYSTEM' },
      });
      
      const spec = FORTRESS_SPECS.ISERLOHN;
      expect(capturedFortress.maxHp).toBe(spec.maxHp);
      expect(capturedFortress.currentHp).toBe(spec.maxHp);
      expect(capturedFortress.maxShield).toBe(spec.maxShield);
      expect(capturedFortress.currentShield).toBe(spec.maxShield);
      expect(capturedFortress.mainCannonPower).toBe(spec.mainCannonPower);
    });
    
    it('부위별 HP가 올바르게 초기화되어야 한다', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      let capturedFortress: Partial<IFortress> = {};
      
      (Fortress as unknown as jest.Mock).mockImplementation((data) => {
        capturedFortress = { ...data, save: mockSave };
        return capturedFortress;
      });
      
      await service.createFortress({
        sessionId,
        type: 'ISERLOHN',
        ownerId: 'EMPIRE',
        location: { type: 'SYSTEM' },
      });
      
      expect(capturedFortress.components).toBeDefined();
      expect(Array.isArray(capturedFortress.components)).toBe(true);
      
      // 이제르론(고정형)은 ENGINE이 없어야 함
      const hasEngine = capturedFortress.components?.some(
        c => c.component === 'ENGINE'
      );
      expect(hasEngine).toBe(false);
      
      // 주포가 있어야 함
      const hasMainCannon = capturedFortress.components?.some(
        c => c.component === 'MAIN_CANNON'
      );
      expect(hasMainCannon).toBe(true);
    });
  });
  
  // ============================================================
  // 주포 발사 테스트
  // ============================================================
  
  describe('fireMainCannon', () => {
    const mockFortress = {
      fortressId: 'FORT-001',
      sessionId,
      type: 'ISERLOHN',
      name: '이제르론 요새',
      ownerId: 'ALLIANCE',
      mainCannonReady: true,
      mainCannonCooldown: 0,
      mainCannonPower: 50000,
      components: [
        { component: 'MAIN_CANNON', hp: 40000, maxHp: 40000, isDestroyed: false },
        { component: 'REACTOR', hp: 40000, maxHp: 40000, isDestroyed: false },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    const mockFleet = {
      fleetId: 'FLEET-001',
      sessionId,
      factionId: 'EMPIRE',
      units: [
        { shipClass: 'battleship', count: 100, hp: 100 },
        { shipClass: 'cruiser', count: 200, hp: 100 },
      ],
      totalShips: 300,
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    beforeEach(() => {
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.findOne as jest.Mock).mockResolvedValue(mockFleet);
    });
    
    it('주포가 발사되어야 한다', async () => {
      const result = await service.fireMainCannon({
        sessionId,
        fortressId: 'FORT-001',
        targetFleetId: 'FLEET-001',
        executedBy: 'TEST',
      });
      
      expect(result.fortressId).toBe('FORT-001');
      expect(result.targetFleetId).toBe('FLEET-001');
      expect(result.cooldownTurns).toBe(3); // 이제르론 쿨다운
    });
    
    it('주포 발사 후 쿨다운이 설정되어야 한다', async () => {
      await service.fireMainCannon({
        sessionId,
        fortressId: 'FORT-001',
        targetFleetId: 'FLEET-001',
        executedBy: 'TEST',
      });
      
      expect(mockFortress.mainCannonReady).toBe(false);
      expect(mockFortress.mainCannonCooldown).toBe(3);
      expect(mockFortress.save).toHaveBeenCalled();
    });
    
    it('주포가 파괴된 경우 발사가 불가해야 한다', async () => {
      const destroyedCannon = {
        ...mockFortress,
        components: [
          { component: 'MAIN_CANNON', hp: 0, maxHp: 40000, isDestroyed: true },
        ],
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(destroyedCannon);
      
      await expect(
        service.fireMainCannon({
          sessionId,
          fortressId: 'FORT-001',
          targetFleetId: 'FLEET-001',
          executedBy: 'TEST',
        })
      ).rejects.toThrow('Main cannon is destroyed');
    });
    
    it('쿨다운 중에는 발사가 불가해야 한다', async () => {
      const cooldownFortress = {
        ...mockFortress,
        mainCannonReady: false,
        mainCannonCooldown: 2,
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(cooldownFortress);
      
      await expect(
        service.fireMainCannon({
          sessionId,
          fortressId: 'FORT-001',
          targetFleetId: 'FLEET-001',
          executedBy: 'TEST',
        })
      ).rejects.toThrow('cooling down');
    });
  });
  
  // ============================================================
  // 수비 함대 배치 테스트
  // ============================================================
  
  describe('assignDefenseFleet', () => {
    const mockFortress = {
      fortressId: 'FORT-001',
      sessionId,
      ownerId: 'EMPIRE',
      garrisonFleetIds: [],
      garrisonCapacity: 5,
      components: [
        { component: 'DOCK', hp: 30000, maxHp: 30000, isDestroyed: false },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    const mockFleet = {
      fleetId: 'FLEET-001',
      sessionId,
      factionId: 'EMPIRE',
      status: 'IDLE',
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    beforeEach(() => {
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.findOne as jest.Mock).mockResolvedValue(mockFleet);
    });
    
    it('함대가 요새에 배치되어야 한다', async () => {
      await service.assignDefenseFleet(sessionId, 'FORT-001', 'FLEET-001');
      
      expect(mockFortress.garrisonFleetIds).toContain('FLEET-001');
      expect(mockFleet.status).toBe('DOCKED');
      expect(mockFortress.save).toHaveBeenCalled();
      expect(mockFleet.save).toHaveBeenCalled();
    });
    
    it('수용량 초과 시 배치가 거부되어야 한다', async () => {
      const fullFortress = {
        ...mockFortress,
        garrisonFleetIds: ['F1', 'F2', 'F3', 'F4', 'F5'],
        garrisonCapacity: 5,
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(fullFortress);
      
      await expect(
        service.assignDefenseFleet(sessionId, 'FORT-001', 'FLEET-001')
      ).rejects.toThrow('capacity reached');
    });
    
    it('다른 세력 함대는 배치 불가해야 한다', async () => {
      const allianceFleet = {
        ...mockFleet,
        factionId: 'ALLIANCE',
      };
      (Fleet.findOne as jest.Mock).mockResolvedValue(allianceFleet);
      
      await expect(
        service.assignDefenseFleet(sessionId, 'FORT-001', 'FLEET-001')
      ).rejects.toThrow('different faction');
    });
    
    it('도킹 베이 파괴 시 배치 불가해야 한다', async () => {
      const damagedFortress = {
        ...mockFortress,
        components: [
          { component: 'DOCK', hp: 0, maxHp: 30000, isDestroyed: true },
        ],
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(damagedFortress);
      
      await expect(
        service.assignDefenseFleet(sessionId, 'FORT-001', 'FLEET-001')
      ).rejects.toThrow('dock is destroyed');
    });
  });
  
  // ============================================================
  // 포위전 테스트
  // ============================================================
  
  describe('beginSiege', () => {
    const mockFortress = {
      fortressId: 'FORT-001',
      sessionId,
      ownerId: 'ALLIANCE',
      status: 'OPERATIONAL',
      garrisonFleetIds: ['DEF-001'],
      mainCannonPower: 50000,
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    const mockAttackingFleet = {
      fleetId: 'ATK-001',
      sessionId,
      factionId: 'EMPIRE',
      status: 'IDLE',
    };
    
    const mockDefendingFleet = {
      fleetId: 'DEF-001',
      sessionId,
      factionId: 'ALLIANCE',
      status: 'DOCKED',
    };
    
    beforeEach(() => {
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.find as jest.Mock).mockImplementation(({ fleetId }) => {
        if (fleetId?.$in?.includes('ATK-001')) {
          return Promise.resolve([mockAttackingFleet]);
        }
        if (fleetId?.$in?.includes('DEF-001')) {
          return Promise.resolve([mockDefendingFleet]);
        }
        return Promise.resolve([]);
      });
      (Fleet.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    });
    
    it('포위전이 시작되어야 한다', async () => {
      const result = await service.beginSiege({
        sessionId,
        fortressId: 'FORT-001',
        attackingFleetIds: ['ATK-001'],
        executedBy: 'TEST',
      });
      
      expect(result.siegeId).toBeDefined();
      expect(result.fortressId).toBe('FORT-001');
      expect(result.attackingFleetIds).toContain('ATK-001');
      expect(result.status).toBe('ACTIVE');
      expect(result.progress).toBe(0);
    });
    
    it('요새 상태가 UNDER_SIEGE로 변경되어야 한다', async () => {
      await service.beginSiege({
        sessionId,
        fortressId: 'FORT-001',
        attackingFleetIds: ['ATK-001'],
        executedBy: 'TEST',
      });
      
      expect(mockFortress.status).toBe('UNDER_SIEGE');
      expect(mockFortress.save).toHaveBeenCalled();
    });
    
    it('이미 포위 중인 요새는 재포위 불가해야 한다', async () => {
      const siegedFortress = {
        ...mockFortress,
        status: 'UNDER_SIEGE',
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(siegedFortress);
      
      await expect(
        service.beginSiege({
          sessionId,
          fortressId: 'FORT-001',
          attackingFleetIds: ['ATK-001'],
          executedBy: 'TEST',
        })
      ).rejects.toThrow('already under siege');
    });
    
    it('자신의 요새는 포위할 수 없어야 한다', async () => {
      const allianceFleet = {
        ...mockAttackingFleet,
        factionId: 'ALLIANCE', // 같은 세력
      };
      (Fleet.find as jest.Mock).mockResolvedValue([allianceFleet]);
      
      await expect(
        service.beginSiege({
          sessionId,
          fortressId: 'FORT-001',
          attackingFleetIds: ['ATK-001'],
          executedBy: 'TEST',
        })
      ).rejects.toThrow('own fortress');
    });
  });
  
  // ============================================================
  // 요새 이동 테스트 (가이에스부르크)
  // ============================================================
  
  describe('beginFortressMovement', () => {
    const mockMovableFortress = {
      fortressId: 'FORT-002',
      sessionId,
      type: 'GEIERSBURG',
      name: '가이에스부르크 요새',
      ownerId: 'EMPIRE',
      status: 'OPERATIONAL',
      canMove: true,
      isMoving: false,
      components: [
        { component: 'ENGINE', hp: 20000, maxHp: 20000, isDestroyed: false },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    const mockImmovableFortress = {
      ...mockMovableFortress,
      fortressId: 'FORT-001',
      type: 'ISERLOHN',
      canMove: false,
    };
    
    it('가이에스부르크는 이동할 수 있어야 한다', async () => {
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockMovableFortress);
      
      await service.beginFortressMovement({
        sessionId,
        fortressId: 'FORT-002',
        targetSystemId: 'ISERLOHN_CORRIDOR',
        executedBy: 'TEST',
      });
      
      expect(mockMovableFortress.isMoving).toBe(true);
      expect(mockMovableFortress.status).toBe('MOVING');
      expect(mockMovableFortress.movementProgress).toBe(0);
      expect(mockMovableFortress.save).toHaveBeenCalled();
    });
    
    it('이제르론은 이동할 수 없어야 한다', async () => {
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockImmovableFortress);
      
      await expect(
        service.beginFortressMovement({
          sessionId,
          fortressId: 'FORT-001',
          targetSystemId: 'SOMEWHERE',
          executedBy: 'TEST',
        })
      ).rejects.toThrow('cannot move');
    });
    
    it('엔진이 파괴된 경우 이동 불가해야 한다', async () => {
      const brokenEngine = {
        ...mockMovableFortress,
        components: [
          { component: 'ENGINE', hp: 0, maxHp: 20000, isDestroyed: true },
        ],
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(brokenEngine);
      
      await expect(
        service.beginFortressMovement({
          sessionId,
          fortressId: 'FORT-002',
          targetSystemId: 'SOMEWHERE',
          executedBy: 'TEST',
        })
      ).rejects.toThrow('engine is destroyed');
    });
    
    it('포위 중인 요새는 이동 불가해야 한다', async () => {
      const siegedFortress = {
        ...mockMovableFortress,
        status: 'UNDER_SIEGE',
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(siegedFortress);
      
      await expect(
        service.beginFortressMovement({
          sessionId,
          fortressId: 'FORT-002',
          targetSystemId: 'SOMEWHERE',
          executedBy: 'TEST',
        })
      ).rejects.toThrow('under siege');
    });
  });
  
  // ============================================================
  // 요새 점령 테스트
  // ============================================================
  
  describe('captureFortress', () => {
    const mockFortress = {
      fortressId: 'FORT-001',
      sessionId,
      ownerId: 'ALLIANCE',
      commanderId: 'YANG',
      garrisonFleetIds: ['DEF-001', 'DEF-002'],
      status: 'UNDER_SIEGE',
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    beforeEach(() => {
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.findOneAndUpdate as jest.Mock).mockResolvedValue({});
    });
    
    it('요새 소유권이 이전되어야 한다', async () => {
      await service.captureFortress(sessionId, 'FORT-001', 'EMPIRE');
      
      expect(mockFortress.ownerId).toBe('EMPIRE');
      expect(mockFortress.commanderId).toBeUndefined();
      expect(mockFortress.garrisonFleetIds).toHaveLength(0);
      expect(mockFortress.status).toBe('OPERATIONAL');
      expect(mockFortress.save).toHaveBeenCalled();
    });
    
    it('기존 수비 함대가 철수되어야 한다', async () => {
      await service.captureFortress(sessionId, 'FORT-001', 'EMPIRE');
      
      expect(Fleet.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });
  
  // ============================================================
  // 포위전 턴 처리 테스트
  // ============================================================
  
  describe('processSiegeTurn', () => {
    const mockFortress = {
      fortressId: 'FORT-001',
      sessionId,
      ownerId: 'ALLIANCE',
      status: 'UNDER_SIEGE',
      siegeId: 'SIEGE-001',
      currentHp: 150000,
      maxHp: 200000,
      currentShield: 50000,
      maxShield: 100000,
      shieldRegenRate: 1000,
      mainCannonReady: true,
      mainCannonCooldown: 0,
      mainCannonPower: 50000,
      garrisonFleetIds: ['DEF-001'],
      components: [
        { component: 'MAIN_CANNON', hp: 40000, maxHp: 40000, isDestroyed: false },
        { component: 'SHIELD_GENERATOR', hp: 30000, maxHp: 30000, isDestroyed: false },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    it('포위전 턴이 정상적으로 처리되어야 한다', async () => {
      // Given: 활성 포위전 설정
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.find as jest.Mock).mockResolvedValue([
        { fleetId: 'ATK-001', factionId: 'EMPIRE', units: [{ shipClass: 'battleship', count: 100, hp: 100 }] },
      ]);
      (Fleet.countDocuments as jest.Mock).mockResolvedValue(1);
      
      // 포위전 시작 (내부 상태 설정)
      const siege = await service.beginSiege({
        sessionId,
        fortressId: 'FORT-001',
        attackingFleetIds: ['ATK-001'],
        executedBy: 'TEST',
      });
      
      // When: 턴 처리
      const result = await service.processSiegeTurn(sessionId, siege.siegeId);
      
      // Then: 결과가 null이면 전투 계속 (아직 종료 조건 미달)
      // 또는 SiegeResult 반환 시 전투 종료
      // 여기서는 전투가 계속됨을 확인
      expect(result).toBeNull();
    });
    
    it('공격자 전멸 시 포위전이 DEFENDED로 종료되어야 한다', async () => {
      // Given: 공격 함대 전멸 상태
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.find as jest.Mock).mockResolvedValue([]); // 공격 함대 없음
      (Fleet.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // 포위전 시작
      const beginRequest = {
        sessionId,
        fortressId: 'FORT-001',
        attackingFleetIds: ['ATK-001'],
        executedBy: 'TEST',
      };
      
      // 함대 존재하도록 모킹 후 시작
      (Fleet.find as jest.Mock).mockResolvedValueOnce([
        { fleetId: 'ATK-001', factionId: 'EMPIRE' },
      ]);
      
      const siege = await service.beginSiege(beginRequest);
      
      // 함대 전멸 상태로 변경
      (Fleet.find as jest.Mock).mockResolvedValue([]);
      
      // When
      const result = await service.processSiegeTurn(sessionId, siege.siegeId);
      
      // Then
      expect(result).toBeDefined();
      expect(result?.outcome).toBe('DEFENDED');
    });
  });
  
  // ============================================================
  // 포위전 철수 테스트
  // ============================================================
  
  describe('retreatFromSiege', () => {
    it('함대가 포위전에서 철수해야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        ownerId: 'ALLIANCE',
        status: 'UNDER_SIEGE',
        garrisonFleetIds: ['DEF-001'],
        mainCannonPower: 50000,
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.find as jest.Mock).mockResolvedValue([
        { fleetId: 'ATK-001', factionId: 'EMPIRE' },
        { fleetId: 'ATK-002', factionId: 'EMPIRE' },
      ]);
      (Fleet.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (Fleet.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // 포위전 시작
      const siege = await service.beginSiege({
        sessionId,
        fortressId: 'FORT-001',
        attackingFleetIds: ['ATK-001', 'ATK-002'],
        executedBy: 'TEST',
      });
      
      // When: 한 함대 철수
      await service.retreatFromSiege(sessionId, siege.siegeId, 'ATK-001');
      
      // Then: 남은 공격 함대 확인
      const currentSiege = service.getSiege(siege.siegeId);
      expect(currentSiege?.attackingFleetIds).not.toContain('ATK-001');
      expect(currentSiege?.attackingFleetIds).toContain('ATK-002');
    });
    
    it('모든 공격자가 철수하면 포위전이 종료되어야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        ownerId: 'ALLIANCE',
        status: 'UNDER_SIEGE',
        garrisonFleetIds: [],
        mainCannonPower: 50000,
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.find as jest.Mock).mockResolvedValue([
        { fleetId: 'ATK-001', factionId: 'EMPIRE' },
      ]);
      (Fleet.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (Fleet.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // 포위전 시작
      const siege = await service.beginSiege({
        sessionId,
        fortressId: 'FORT-001',
        attackingFleetIds: ['ATK-001'],
        executedBy: 'TEST',
      });
      
      // When: 유일한 함대 철수
      await service.retreatFromSiege(sessionId, siege.siegeId, 'ATK-001');
      
      // Then: 포위전 종료 확인
      const currentSiege = service.getSiege(siege.siegeId);
      expect(currentSiege).toBeUndefined();
    });
    
    it('포위전에 참가하지 않은 함대 철수 시 에러가 발생해야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        ownerId: 'ALLIANCE',
        status: 'UNDER_SIEGE',
        garrisonFleetIds: [],
        mainCannonPower: 50000,
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      (Fleet.find as jest.Mock).mockResolvedValue([
        { fleetId: 'ATK-001', factionId: 'EMPIRE' },
      ]);
      (Fleet.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      const siege = await service.beginSiege({
        sessionId,
        fortressId: 'FORT-001',
        attackingFleetIds: ['ATK-001'],
        executedBy: 'TEST',
      });
      
      // When & Then
      await expect(
        service.retreatFromSiege(sessionId, siege.siegeId, 'UNKNOWN-FLEET')
      ).rejects.toThrow('not part of this siege');
    });
  });
  
  // ============================================================
  // 방어막 재생 테스트
  // ============================================================
  
  describe('regenerateFortressShield', () => {
    it('방어막이 재생되어야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentShield: 50000,
        maxShield: 100000,
        shieldRegenRate: 5000,
        components: [
          { component: 'SHIELD_GENERATOR', hp: 30000, maxHp: 30000, isDestroyed: false },
        ],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      
      // When
      await service.regenerateFortressShield(sessionId, 'FORT-001');
      
      // Then
      expect(mockFortress.currentShield).toBe(55000); // 50000 + 5000
      expect(mockFortress.save).toHaveBeenCalled();
    });
    
    it('방어막이 최대치를 초과하지 않아야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentShield: 98000,
        maxShield: 100000,
        shieldRegenRate: 5000,
        components: [
          { component: 'SHIELD_GENERATOR', hp: 30000, maxHp: 30000, isDestroyed: false },
        ],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      
      // When
      await service.regenerateFortressShield(sessionId, 'FORT-001');
      
      // Then: 최대치 100000을 초과하지 않음
      expect(mockFortress.currentShield).toBe(100000);
    });
    
    it('실드 제너레이터가 파괴된 경우 재생되지 않아야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentShield: 50000,
        maxShield: 100000,
        shieldRegenRate: 5000,
        components: [
          { component: 'SHIELD_GENERATOR', hp: 0, maxHp: 30000, isDestroyed: true },
        ],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      
      // When
      await service.regenerateFortressShield(sessionId, 'FORT-001');
      
      // Then: 방어막 변화 없음
      expect(mockFortress.currentShield).toBe(50000);
    });
    
    it('실드 제너레이터 손상 시 재생률이 감소해야 한다', async () => {
      // Given: 실드 제너레이터 50% 손상
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentShield: 50000,
        maxShield: 100000,
        shieldRegenRate: 5000,
        components: [
          { component: 'SHIELD_GENERATOR', hp: 15000, maxHp: 30000, isDestroyed: false },
        ],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockFortress);
      
      // When
      await service.regenerateFortressShield(sessionId, 'FORT-001');
      
      // Then: 5000 * 0.5 = 2500 재생
      expect(mockFortress.currentShield).toBe(52500);
    });
  });
  
  // ============================================================
  // 요새 데미지 적용 테스트
  // ============================================================
  
  describe('applyDamageToFortress', () => {
    it('데미지가 방어막 → HP 순서로 적용되어야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentHp: 200000,
        maxHp: 200000,
        currentShield: 50000,
        maxShield: 100000,
        armor: 100,
        components: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      // When
      const result = await service.applyDamageToFortress(
        sessionId,
        mockFortress as any,
        60000
      );
      
      // Then: 방어막이 먼저 흡수
      expect(result.shieldDamage).toBeGreaterThan(0);
      expect(mockFortress.currentShield).toBeLessThan(50000);
    });
    
    it('방어막이 0이면 HP에 직접 데미지가 적용되어야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentHp: 200000,
        maxHp: 200000,
        currentShield: 0,
        maxShield: 100000,
        armor: 0,
        components: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      // When
      const result = await service.applyDamageToFortress(
        sessionId,
        mockFortress as any,
        10000
      );
      
      // Then
      expect(result.hpDamage).toBe(10000);
      expect(mockFortress.currentHp).toBe(190000);
    });
    
    it('장갑이 데미지를 감소시켜야 한다', async () => {
      // Given: 장갑 500 (50% 감소)
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentHp: 200000,
        maxHp: 200000,
        currentShield: 0,
        maxShield: 100000,
        armor: 500, // 1000 기준 50% 감소
        components: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      // When
      const result = await service.applyDamageToFortress(
        sessionId,
        mockFortress as any,
        10000
      );
      
      // Then: 장갑으로 인한 감소
      expect(result.hpDamage).toBeLessThan(10000);
    });
    
    it('HP가 0이 되면 DESTROYED 상태가 되어야 한다', async () => {
      // Given
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentHp: 100,
        maxHp: 200000,
        currentShield: 0,
        maxShield: 100000,
        armor: 0,
        components: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      // When
      const result = await service.applyDamageToFortress(
        sessionId,
        mockFortress as any,
        10000
      );
      
      // Then
      expect(result.isDestroyed).toBe(true);
      expect(mockFortress.status).toBe('DESTROYED');
      expect(mockFortress.currentHp).toBe(0);
    });
    
    it('HP가 30% 미만이면 DAMAGED 상태가 되어야 한다', async () => {
      // Given: HP가 30% 이상
      const mockFortress = {
        fortressId: 'FORT-001',
        sessionId,
        status: 'OPERATIONAL',
        currentHp: 70000, // 35%
        maxHp: 200000,
        currentShield: 0,
        maxShield: 100000,
        armor: 0,
        components: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      
      // When: 20000 데미지 (50000으로 25%가 됨)
      const result = await service.applyDamageToFortress(
        sessionId,
        mockFortress as any,
        20000
      );
      
      // Then
      expect(mockFortress.status).toBe('DAMAGED');
    });
  });
  
  // ============================================================
  // 요새 수리 테스트
  // ============================================================
  
  describe('repairFortress', () => {
    const mockDamagedFortress = {
      fortressId: 'FORT-001',
      sessionId,
      status: 'DAMAGED',
      currentHp: 100000,
      maxHp: 200000,
      components: [
        { component: 'MAIN_CANNON', hp: 20000, maxHp: 40000, isDestroyed: false },
        { component: 'SHIELD_GENERATOR', hp: 15000, maxHp: 30000, isDestroyed: false },
        { component: 'REACTOR', hp: 0, maxHp: 40000, isDestroyed: true },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    
    beforeEach(() => {
      (Fortress.findOne as jest.Mock).mockResolvedValue(mockDamagedFortress);
    });
    
    it('손상된 부위가 수리되어야 한다', async () => {
      const result = await service.repairFortress({
        sessionId,
        fortressId: 'FORT-001',
      });
      
      expect(result.repaired.length).toBeGreaterThan(0);
      expect(result.totalCost.credits).toBeGreaterThan(0);
    });
    
    it('긴급 수리 시 더 많이 수리되어야 한다', async () => {
      const normalResult = await service.repairFortress({
        sessionId,
        fortressId: 'FORT-001',
        priority: 'NORMAL',
      });
      
      // 리셋
      mockDamagedFortress.components = [
        { component: 'MAIN_CANNON', hp: 20000, maxHp: 40000, isDestroyed: false },
        { component: 'SHIELD_GENERATOR', hp: 15000, maxHp: 30000, isDestroyed: false },
        { component: 'REACTOR', hp: 0, maxHp: 40000, isDestroyed: true },
      ];
      
      const emergencyResult = await service.repairFortress({
        sessionId,
        fortressId: 'FORT-001',
        priority: 'EMERGENCY',
      });
      
      // 긴급 수리는 즉시 완료
      expect(emergencyResult.turnsRemaining).toBe(0);
    });
    
    it('포위 중인 요새는 수리 불가해야 한다', async () => {
      const siegedFortress = {
        ...mockDamagedFortress,
        status: 'UNDER_SIEGE',
      };
      (Fortress.findOne as jest.Mock).mockResolvedValue(siegedFortress);
      
      await expect(
        service.repairFortress({
          sessionId,
          fortressId: 'FORT-001',
        })
      ).rejects.toThrow('under siege');
    });
  });
});

