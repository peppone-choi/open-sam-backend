/**
 * 보급 제약 조건 통합 테스트
 * 
 * 보급이 끊긴 도시에서 내정 커맨드가 제대로 차단되는지 검증
 */

import { ConscriptCommand } from '../general/conscript';
import { TrainCommand } from '../general/train';
import { BoostMoraleCommand } from '../general/boostMorale';
import { TrainTroopsCommand } from '../general/trainTroops';
import { InvestCommerceCommand } from '../general/investCommerce';
import { CultivateLandCommand } from '../general/cultivateLand';
import { ReinforceSecurityCommand } from '../general/reinforceSecurity';
import { RepairWallCommand } from '../general/repairWall';
import { ReinforceDefenseCommand } from '../general/reinforceDefense';
import { GoodGovernanceCommand } from '../general/goodGovernance';
import { EncourageSettlementCommand } from '../general/encourageSettlement';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from './test-helpers';

describe('보급 제약 조건 통합 테스트', () => {
  const internalAffairsCommands = [
    { name: '징병', CommandClass: ConscriptCommand, arg: { crewType: 0, amount: 1000 } },
    { name: '단련', CommandClass: TrainCommand, arg: null },
    { name: '사기진작', CommandClass: BoostMoraleCommand, arg: null },
    { name: '훈련', CommandClass: TrainTroopsCommand, arg: null },
    { name: '상업투자', CommandClass: InvestCommerceCommand, arg: null },
    { name: '농지개간', CommandClass: CultivateLandCommand, arg: null },
    { name: '치안강화', CommandClass: ReinforceSecurityCommand, arg: null },
    { name: '성벽보수', CommandClass: RepairWallCommand, arg: null },
    { name: '수비강화', CommandClass: ReinforceDefenseCommand, arg: null },
    { name: '민심', CommandClass: GoodGovernanceCommand, arg: null },
    { name: '둔전', CommandClass: EncourageSettlementCommand, arg: null },
  ];

  describe('보급 끊긴 도시에서 내정 커맨드 차단', () => {
    internalAffairsCommands.forEach(({ name, CommandClass, arg }) => {
      it(`${name}: 보급이 끊기면 실행 불가`, () => {
        const { command, city } = CommandTestHelper.prepareCommand(
          CommandClass,
          { gold: 100000, rice: 50000, crew: 10000 },
          { supply: 0, pop: 100000, trust: 80 }, // 보급 끊김
          { nation: 1, tech: 100 },
          {},
          arg
        );

        command['init']();
        if (arg) command['initWithArg']();

        const constraints = command['fullConditionConstraints'] || command['minConditionConstraints'];
        const failed = ConstraintTestHelper.findFailedConstraints(
          constraints,
          { general: command['generalObj'], city, nation: command['nation'] },
          command['env']
        );

        // 보급 제약이 실패해야 함
        const supplyFailed = failed.some(f => {
          const reasonStr = String(f.reason || '');
          return reasonStr.includes('보급') || reasonStr.includes('supply');
        });
        
        expect(supplyFailed).toBe(true);
      });

      it(`${name}: 보급이 연결되면 실행 가능`, () => {
        const { command, city } = CommandTestHelper.prepareCommand(
          CommandClass,
          { gold: 100000, rice: 50000, crew: 10000 },
          { supply: 1, pop: 100000, trust: 80 }, // 보급 연결
          { nation: 1, tech: 100 },
          {},
          arg
        );

        command['init']();
        if (arg) command['initWithArg']();

        const constraints = command['fullConditionConstraints'] || command['minConditionConstraints'];
        const failed = ConstraintTestHelper.findFailedConstraints(
          constraints,
          { general: command['generalObj'], city, nation: command['nation'], ownedCities: [city] },
          command['env']
        );

        // 보급 제약은 통과해야 함 (다른 제약은 실패할 수 있음)
        const supplyFailed = failed.some(f => {
          const reasonStr = String(f.reason || '');
          return reasonStr.includes('보급') || reasonStr.includes('supply');
        });
        
        expect(supplyFailed).toBe(false);
      });
    });
  });

  describe('점령한 도시에서만 실행 가능', () => {
    internalAffairsCommands.forEach(({ name, CommandClass, arg }) => {
      it(`${name}: 적국 도시에서는 실행 불가`, () => {
        const { command, city } = CommandTestHelper.prepareCommand(
          CommandClass,
          { nation: 1, gold: 100000, rice: 50000, crew: 10000 },
          { nation: 2, supply: 1, pop: 100000, trust: 80 }, // 적국 도시
          { nation: 1, tech: 100 },
          {},
          arg
        );

        command['init']();

        const constraints = command['minConditionConstraints'];
        const failed = ConstraintTestHelper.findFailedConstraints(
          constraints,
          { general: command['generalObj'], city },
          command['env']
        );

        // 점령 제약이 실패해야 함
        const occupiedFailed = failed.some(f => {
          const reasonStr = String(f.reason || '');
          return reasonStr.includes('아국 도시가 아닙니다');
        });
        
        expect(occupiedFailed).toBe(true);
      });

      it(`${name}: 아국 도시에서는 실행 가능`, () => {
        const { command, city } = CommandTestHelper.prepareCommand(
          CommandClass,
          { nation: 1, gold: 100000, rice: 50000, crew: 10000 },
          { nation: 1, supply: 1, pop: 100000, trust: 80 }, // 아국 도시
          { nation: 1, tech: 100 },
          {},
          arg
        );

        command['init']();

        const constraints = command['minConditionConstraints'];
        const failed = ConstraintTestHelper.findFailedConstraints(
          constraints,
          { general: command['generalObj'], city },
          command['env']
        );

        // 점령 제약은 통과해야 함
        const occupiedFailed = failed.some(f => {
          const reasonStr = String(f.reason || '');
          return reasonStr.includes('아국 도시가 아닙니다');
        });
        
        expect(occupiedFailed).toBe(false);
      });
    });
  });

  describe('재야 제약', () => {
    internalAffairsCommands.forEach(({ name, CommandClass, arg }) => {
      it(`${name}: 재야는 실행 불가`, () => {
        const { command } = CommandTestHelper.prepareCommand(
          CommandClass,
          { nation: 0, gold: 100000, rice: 50000, crew: 10000 }, // 재야 (nation = 0)
          { nation: 0, supply: 1, pop: 100000, trust: 80 },
          { nation: 0 },
          {},
          arg
        );

        command['init']();

        const constraints = command['minConditionConstraints'];
        const hasNeutralConstraint = ConstraintTestHelper.hasConstraint(
          constraints,
          '재야는 불가능합니다'
        );

        expect(hasNeutralConstraint).toBe(true);
      });
    });
  });

  describe('SuppliedCity 제약 존재 확인', () => {
    it('모든 내정 커맨드가 SuppliedCity 제약을 가져야 함', () => {
      const missingSupplyConstraint: string[] = [];

      internalAffairsCommands.forEach(({ name, CommandClass, arg }) => {
        const { command } = CommandTestHelper.prepareCommand(
          CommandClass,
          {},
          {},
          {},
          {},
          arg
        );

        command['init']();
        if (arg) command['initWithArg']();

        const allConstraints = [
          ...(command['minConditionConstraints'] || []),
          ...(command['fullConditionConstraints'] || [])
        ];

        const hasSupplyConstraint = allConstraints.some(c => 
          c.test?.toString().includes('보급이 끊긴') ||
          c.test?.toString().includes('supply')
        );

        if (!hasSupplyConstraint) {
          missingSupplyConstraint.push(name);
        }
      });

      if (missingSupplyConstraint.length > 0) {
        console.warn(`⚠️  SuppliedCity 제약이 없는 커맨드: ${missingSupplyConstraint.join(', ')}`);
      }

      // 모든 내정 커맨드는 보급 제약을 가져야 함
      expect(missingSupplyConstraint.length).toBe(0);
    });
  });

  describe('OccupiedCity 제약 존재 확인', () => {
    it('모든 내정 커맨드가 OccupiedCity 제약을 가져야 함', () => {
      const missingOccupiedConstraint: string[] = [];

      internalAffairsCommands.forEach(({ name, CommandClass, arg }) => {
        const { command } = CommandTestHelper.prepareCommand(
          CommandClass,
          {},
          {},
          {},
          {},
          arg
        );

        command['init']();

        const allConstraints = [
          ...(command['minConditionConstraints'] || []),
          ...(command['fullConditionConstraints'] || [])
        ];

        const hasOccupiedConstraint = allConstraints.some(c => 
          c.test?.toString().includes('아국 도시가 아닙니다') ||
          c.test?.toString().includes('OccupiedCity')
        );

        if (!hasOccupiedConstraint) {
          missingOccupiedConstraint.push(name);
        }
      });

      if (missingOccupiedConstraint.length > 0) {
        console.warn(`⚠️  OccupiedCity 제약이 없는 커맨드: ${missingOccupiedConstraint.join(', ')}`);
      }

      // 모든 내정 커맨드는 점령 제약을 가져야 함
      expect(missingOccupiedConstraint.length).toBe(0);
    });
  });
});
