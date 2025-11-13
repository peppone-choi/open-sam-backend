/**
 * AutorunPolicy 테스트
 */

import { AutorunGeneralPolicy, GeneralActionType, AIOptions } from '../AutorunGeneralPolicy';
import { AutorunNationPolicy, NationActionType } from '../AutorunNationPolicy';

describe('AutorunGeneralPolicy', () => {
  const mockGeneral = {
    npc: 2, // NPC
    nation: 1,
    no: 1,
  } as any;

  const mockNation = {};
  const mockEnv = {};

  it('NPC는 기본 정책으로 모든 행동 가능', () => {
    const aiOptions: AIOptions = {};
    const policy = new AutorunGeneralPolicy(
      mockGeneral,
      aiOptions,
      null,
      null,
      mockNation,
      mockEnv
    );

    expect(policy.canPerform(GeneralActionType.일반내정)).toBe(true);
    expect(policy.canPerform(GeneralActionType.출병)).toBe(true);
    expect(policy.canPerform(GeneralActionType.징병)).toBe(true);
  });

  it('유저장은 AI 옵션에 따라 행동 제한', () => {
    const userGeneral = { ...mockGeneral, npc: 1 };
    const aiOptions: AIOptions = {
      develop: true, // 내정만 허용
    };

    const policy = new AutorunGeneralPolicy(
      userGeneral,
      aiOptions,
      null,
      null,
      mockNation,
      mockEnv
    );

    expect(policy.canPerform(GeneralActionType.일반내정)).toBe(true);
    expect(policy.canPerform(GeneralActionType.출병)).toBe(false); // 전투 불가
    expect(policy.canPerform(GeneralActionType.징병)).toBe(false); // 징병 불가
  });

  it('우선순위 리스트 반환', () => {
    const aiOptions: AIOptions = {};
    const policy = new AutorunGeneralPolicy(
      mockGeneral,
      aiOptions,
      null,
      null,
      mockNation,
      mockEnv
    );

    const available = policy.getAvailableActions();
    expect(available.length).toBeGreaterThan(0);
    expect(available[0]).toBe(GeneralActionType.NPC사망대비);
  });
});

describe('AutorunNationPolicy', () => {
  const mockGeneral = {
    npc: 2,
    nation: 1,
    no: 1,
  } as any;

  const mockNation = {
    tech: 0,
  };
  const mockEnv = {
    develcost: 100,
  };

  it('NPC 수뇌는 모든 국가 행동 가능', () => {
    const aiOptions: AIOptions = {
      chief: true,
    };

    const policy = new AutorunNationPolicy(
      mockGeneral,
      aiOptions,
      null,
      null,
      mockNation,
      mockEnv
    );

    expect(policy.canPerform(NationActionType.선전포고)).toBe(true);
    expect(policy.canPerform(NationActionType.유저장포상)).toBe(true);
    expect(policy.canPerform(NationActionType.NPC전방발령)).toBe(true);
  });

  it('수뇌 권한 없으면 국가 행동 불가', () => {
    const userGeneral = { ...mockGeneral, npc: 1 };
    const aiOptions: AIOptions = {}; // chief 없음

    const policy = new AutorunNationPolicy(
      userGeneral,
      aiOptions,
      null,
      null,
      mockNation,
      mockEnv
    );

    expect(policy.canPerform(NationActionType.선전포고)).toBe(false);
    expect(policy.canPerform(NationActionType.유저장포상)).toBe(false);
  });

  it('정책 변수 기본값 설정', () => {
    const aiOptions: AIOptions = { chief: true };

    const policy = new AutorunNationPolicy(
      mockGeneral,
      aiOptions,
      null,
      null,
      mockNation,
      mockEnv
    );

    expect(policy.reqNationGold).toBe(10000);
    expect(policy.reqNationRice).toBe(12000);
    expect(policy.minNPCWarLeadership).toBe(40);
  });

  it('동적 계산: NPC 개발 비용', () => {
    const aiOptions: AIOptions = { chief: true };

    const policy = new AutorunNationPolicy(
      mockGeneral,
      aiOptions,
      null,
      null,
      mockNation,
      mockEnv
    );

    // env.develcost * 30
    expect(policy.reqNPCDevelGold).toBe(3000);
  });
});
