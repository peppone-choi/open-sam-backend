/**
 * CommandRegistry 테스트
 */

import { commandRegistry } from '../CommandRegistry';

describe('CommandRegistry', () => {
  describe('초기화', () => {
    it('레지스트리가 정상적으로 생성되어야 함', () => {
      expect(commandRegistry).toBeDefined();
    });

    it('최소 97개 이상의 커맨드가 등록되어야 함', () => {
      const stats = commandRegistry.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(97);
    });

    it('strategic 커맨드가 83개 이상이어야 함', () => {
      const stats = commandRegistry.getStats();
      expect(stats.strategic).toBeGreaterThanOrEqual(83);
    });

    it('tactical 커맨드가 14개 이상이어야 함', () => {
      const stats = commandRegistry.getStats();
      expect(stats.tactical).toBeGreaterThanOrEqual(14);
    });
  });

  describe('커맨드 조회', () => {
    it('warp 커맨드를 가져올 수 있어야 함', () => {
      const warp = commandRegistry.getCommand('warp');
      expect(warp).not.toBeNull();
      expect(warp?.getName()).toBe('warp');
      expect(warp?.getDisplayName()).toBe('워프 항행');
    });

    it('move_fleet 커맨드(legacy)를 가져올 수 있어야 함', () => {
      const moveFleet = commandRegistry.getCommand('move_fleet');
      expect(moveFleet).not.toBeNull();
    });

    it('attack 커맨드(tactical)를 가져올 수 있어야 함', () => {
      const attack = commandRegistry.getCommand('attack');
      expect(attack).not.toBeNull();
      expect(attack?.getCategory()).toBe('tactical');
    });

    it('존재하지 않는 커맨드는 null을 반환해야 함', () => {
      const invalid = commandRegistry.getCommand('nonexistent_command');
      expect(invalid).toBeNull();
    });

    it('같은 커맨드를 여러 번 요청해도 같은 인스턴스를 반환해야 함 (싱글톤)', () => {
      const warp1 = commandRegistry.getCommand('warp');
      const warp2 = commandRegistry.getCommand('warp');
      expect(warp1).toBe(warp2);
    });
  });

  describe('커맨드 목록', () => {
    it('모든 커맨드 이름을 반환해야 함', () => {
      const names = commandRegistry.getAllCommandNames();
      expect(names.length).toBeGreaterThanOrEqual(97);
      expect(names).toContain('warp');
      expect(names).toContain('attack');
      expect(names).toContain('move_fleet');
    });

    it('커맨드 존재 여부를 확인할 수 있어야 함', () => {
      expect(commandRegistry.hasCommand('warp')).toBe(true);
      expect(commandRegistry.hasCommand('nonexistent')).toBe(false);
    });
  });

  describe('카테고리별 조회', () => {
    it('strategic 카테고리 커맨드를 가져올 수 있어야 함', () => {
      const strategicCommands = commandRegistry.getCommandsByCategory('strategic');
      expect(strategicCommands.length).toBeGreaterThan(0);
      
      // 모든 커맨드가 strategic 카테고리인지 확인
      strategicCommands.forEach(cmd => {
        expect(cmd.getCategory()).toBe('strategic');
      });
    });

    it('tactical 카테고리 커맨드를 가져올 수 있어야 함', () => {
      const tacticalCommands = commandRegistry.getCommandsByCategory('tactical');
      expect(tacticalCommands.length).toBeGreaterThan(0);
      
      tacticalCommands.forEach(cmd => {
        expect(cmd.getCategory()).toBe('tactical');
      });
    });
  });

  describe('커맨드 메타데이터', () => {
    it('각 커맨드가 필수 메타데이터를 가지고 있어야 함', () => {
      const warp = commandRegistry.getCommand('warp');
      expect(warp).not.toBeNull();
      
      if (warp) {
        expect(warp.getName()).toBeTruthy();
        expect(warp.getDisplayName()).toBeTruthy();
        expect(warp.getDescription()).toBeTruthy();
        expect(warp.getCategory()).toBeTruthy();
        expect(typeof warp.getRequiredCommandPoints()).toBe('number');
        expect(typeof warp.getRequiredTurns()).toBe('number');
      }
    });

    it('attack 커맨드가 올바른 메타데이터를 가지고 있어야 함', () => {
      const attack = commandRegistry.getCommand('attack');
      expect(attack).not.toBeNull();
      
      if (attack) {
        expect(attack.getCategory()).toBe('tactical');
        expect(attack.getRequiredCommandPoints()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('통계', () => {
    it('레지스트리 통계가 정확해야 함', () => {
      const stats = commandRegistry.getStats();
      
      expect(stats.total).toBeGreaterThanOrEqual(97);
      expect(stats.strategic + stats.tactical + stats.legacy).toBeLessThanOrEqual(stats.total);
      
      // 통계 출력 (디버깅용)
      console.log('[CommandRegistry Stats]', stats);
    });
  });

  describe('샘플 커맨드 존재 확인', () => {
    const sampleCommands = [
      'warp',
      'fuel_supply',
      'port',
      'discipline_maintenance',
      'space_training',
      'ground_training',
      'attack',
      'move',
      'retreat',
      'formation',
    ];

    sampleCommands.forEach(cmdName => {
      it(`${cmdName} 커맨드가 등록되어 있어야 함`, () => {
        expect(commandRegistry.hasCommand(cmdName)).toBe(true);
        const cmd = commandRegistry.getCommand(cmdName);
        expect(cmd).not.toBeNull();
      });
    });
  });
});
