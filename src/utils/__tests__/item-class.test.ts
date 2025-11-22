import { buildItemClass } from '../item-class';

describe('item-class', () => {
  it('applies sabotage success bonus for 향낭', () => {
    const item = buildItemClass('che_계략_향낭', { slot: 'item' });
    const base = 0.2;
    const boosted = item.onCalcDomestic?.('계략', 'success', base) ?? base;

    expect(boosted).toBeCloseTo(0.7);
  });

  it('healing item restores injury and consumes after three uses', async () => {
    const mockLogger = {
      pushGeneralActionLog: jest.fn(),
      pushGeneralHistoryLog: jest.fn(),
    };

    const general: any = {
      no: 1,
      injury: 40,
      data: {
        injury: 40,
        aux: {
          use_treatment: 5,
        },
      },
      getLogger: () => mockLogger,
      markModified: jest.fn(),
    };

    const item = buildItemClass('che_치료_환약', { slot: 'item' });

    for (let i = 0; i < 3; i += 1) {
      general.injury = 40;
      general.data.injury = 40;
      const consumed = await item.onPreTurnExecute?.(general, { logger: mockLogger });
      expect(general.injury).toBe(0);
      if (i < 2) {
        expect(consumed).toBeFalsy();
      } else {
        expect(consumed).toBeTruthy();
      }
    }
  });
});
