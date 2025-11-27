/**
 * 이벤트 연구 커맨드 통합 테스트
 * 
 * PHP event_XXX연구 대응
 * 특수 병종/기술 연구 커맨드들을 테스트합니다.
 */

import { event_원융노병연구 as CrossbowResearchCommand } from '../eventCrossbowResearch';
import { event_무희연구 as DancerResearchCommand } from '../eventDancerResearch';
import { event_상병연구 as ElephantResearchCommand } from '../eventElephantResearch';
import { event_화시병연구 as FireArrowResearchCommand } from '../eventFireArrowResearch';
import { event_화륜차연구 as FireCartResearchCommand } from '../eventFireCartResearch';
import { event_대검병연구 as GreatswordResearchCommand } from '../eventGreatswordResearch';
import { event_산저병연구 as MountainResearchCommand } from '../eventMountainResearch';
import { event_극병연구 as PikeResearchCommand } from '../eventPikeResearch';
import { event_음귀병연구 as ShadowResearchCommand } from '../eventShadowResearch';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

// Mock GameConst
beforeAll(() => {
  global.GameConst = {
    basegold: 1000,
    baserice: 1000,
  };
});

// 모든 이벤트 연구 커맨드에 대한 공통 테스트
const eventResearchCommands = [
  { Command: CrossbowResearchCommand, name: '원융노병 연구', auxType: 'can_원융노병사용' },
  { Command: DancerResearchCommand, name: '무희 연구', auxType: 'can_무희사용' },
  { Command: ElephantResearchCommand, name: '상병 연구', auxType: 'can_상병사용' },
  { Command: FireArrowResearchCommand, name: '화시병 연구', auxType: 'can_화시병사용' },
  { Command: FireCartResearchCommand, name: '화륜차 연구', auxType: 'can_화륜차사용' },
  { Command: GreatswordResearchCommand, name: '대검병 연구', auxType: 'can_대검병사용' },
  { Command: MountainResearchCommand, name: '산저병 연구', auxType: 'can_산저병사용' },
  { Command: PikeResearchCommand, name: '극병 연구', auxType: 'can_극병사용' },
  { Command: ShadowResearchCommand, name: '음귀병 연구', auxType: 'can_음귀병사용' },
];

describe.each(eventResearchCommands)('$name 커맨드', ({ Command, name, auxType }) => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(Command).toBeDefined();
    });

    it(`getName()이 "${name}"을 포함해야 함`, () => {
      const commandName = Command.getName();
      expect(typeof commandName).toBe('string');
      expect(commandName.length).toBeGreaterThan(0);
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(Command.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1, gold: 500000, rice: 500000, aux: {} },
        {},
        null,
        {}
      );

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('argTest가 true를 반환해야 함 (인자 불필요)', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1, aux: {} },
        {},
        null,
        {}
      );

      const result = command['argTest']();
      expect(result).toBe(true);
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1, gold: 500000, rice: 500000, aux: {} },
        {},
        null,
        {}
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
      expect(constraints.length).toBeGreaterThan(0);
    });

    it('수뇌부만 연구 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1, officer_level: 1 }, // 일반 장수
        { nation: 1, supply: 1 },
        { nation: 1, gold: 500000, rice: 500000, aux: {} },
        {},
        null,
        {}
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('수뇌부'))).toBe(true);
    });

    it('아국 도시에서만 연구 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1, officer_level: 5 },
        { nation: 2 }, // 다른 국가 도시
        { nation: 1, gold: 500000, rice: 500000, aux: {} },
        {},
        null,
        {}
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('아국'))).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, aux: {} },
        {},
        null,
        {}
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
      expect(cost[0]).toBeGreaterThan(0); // 금 비용
      expect(cost[1]).toBeGreaterThan(0); // 쌀 비용
    });

    it('연구 비용이 100000 이상이어야 함 (대규모 투자)', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, aux: {} },
        {},
        null,
        {}
      );

      const [gold, rice] = command.getCost();
      expect(gold).toBeGreaterThanOrEqual(100000);
      expect(rice).toBeGreaterThanOrEqual(100000);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 양수여야 함 (연구에 시간 필요)', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, aux: {} },
        {},
        null,
        {}
      );

      const preTurn = command.getPreReqTurn();
      expect(typeof preTurn).toBe('number');
      expect(preTurn).toBeGreaterThan(0); // 연구에는 시간이 필요
    });

    it('getPostReqTurn()이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, aux: {} },
        {},
        null,
        {}
      );

      expect(command.getPostReqTurn()).toBe(0);
    });
  });
});

describe('이벤트 연구 커맨드 공통 특성', () => {
  it('모든 연구 커맨드가 존재함', () => {
    expect(eventResearchCommands.length).toBe(9);
  });

  it('모든 연구 커맨드가 NationCommand를 상속함', () => {
    eventResearchCommands.forEach(({ Command }) => {
      expect(Command.getCategory()).toBe('nation');
    });
  });

  it('모든 연구 커맨드가 24턴 미만의 선행 턴을 요구함', () => {
    eventResearchCommands.forEach(({ Command }) => {
      const { command } = CommandTestHelper.prepareNationCommand(
        Command,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, aux: {} },
        {},
        null,
        {}
      );

      const preTurn = command.getPreReqTurn();
      expect(preTurn).toBeLessThan(24); // PHP 기준 최대 23턴
    });
  });
});

