/**
 * Focused Session 5 item tests
 *
 * We exercise one multi‑charge heal item, one domestic buff,
 * one battle buff, and a simple inventory‑deletion flow driven
 * by an item's tryConsumeNow() result.
 */

import {
  che_치료_환약,
  che_치료_정력견혈,
  che_계략_삼략,
  che_사기_탁주,
  createItem,
} from '../items';

// Lightweight mock for IGeneral used by item tests.
const createMockGeneral = (overrides: any = {}) => ({
  no: 1,
  session_id: 'test',
  owner: '1',
  name: 'Test General',
  data: {
    leadership: 80,
    strength: 75,
    intel: 85,
    gold: 10000,
    rice: 5000,
    item: 'None',
    weapon: 'None',
    book: 'None',
    horse: 'None',
    ...(overrides.data || {}),
  },
  aux: overrides.aux || {},
  markModified: jest.fn(),
  ...overrides,
});

describe('BaseItem basics', () => {
  it('exposes name, info and pricing metadata', () => {
    const item = new che_치료_환약();
    expect(item.getRawName()).toBe('환약');
    expect(item.getName()).toBe('환약(치료)');
    expect(item.getInfo()).toContain('3회용');
    expect(item.getCost()).toBe(200);
    expect(item.isConsumable()).toBe(true);
    expect(item.isBuyable()).toBe(true);
    expect(item.getReqSecu()).toBe(0);
  });

  it('can be constructed from class name via registry', () => {
    const item = createItem('che_치료_환약');
    expect(item).toBeInstanceOf(che_치료_환약);
    expect(item?.getRawName()).toBe('환약');
  });
});

describe('Multi‑charge heal item – che_치료_환약', () => {
  it('initialises remaining uses on purchase', () => {
    const item = new che_치료_환약();
    const general = createMockGeneral();
    const rng = {} as any;

    item.onArbitraryAction(general, rng, '장비매매', '구매', null);
    expect(general.aux['remain환약']).toBe(3);
  });

  it('consumes after three trigger uses', () => {
    const item = new che_치료_환약();
    const general = createMockGeneral({ aux: { remain환약: 3 } });

    // 1st
    let shouldRemove = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(shouldRemove).toBe(false);
    expect(general.aux['remain환약']).toBe(2);

    // 2nd
    shouldRemove = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(shouldRemove).toBe(false);
    expect(general.aux['remain환약']).toBe(1);

    // 3rd – item should signal removal and clear aux
    shouldRemove = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(shouldRemove).toBe(true);
    expect(general.aux['remain환약']).toBeNull();
  });
});

describe('Domestic buff – che_계략_삼략', () => {
  it('adds +20%p to strategy success and +10%p to war magic', () => {
    const item = new che_계략_삼략();
    const general = createMockGeneral();

    const baseSuccess = 0.5;
    const modifiedSuccess = item.onCalcDomestic('계략', 'success', baseSuccess);
    expect(modifiedSuccess).toBeCloseTo(0.7);

    const baseTrialProb = 0.2;
    const trialProb = item.onCalcStat(general, 'warMagicTrialProb', baseTrialProb);
    expect(trialProb).toBeCloseTo(0.3);

    const baseSuccessProb = 0.5;
    const successProb = item.onCalcStat(general, 'warMagicSuccessProb', baseSuccessProb);
    expect(successProb).toBeCloseTo(0.6);
  });
});

describe('Battle buff – che_사기_탁주', () => {
  it('returns a battle init trigger that increases atmos by 30', () => {
    const item = new che_사기_탁주();
    const unit = {} as any;

    const trigger = item.getBattleInitSkillTriggerList(unit);
    expect(trigger).not.toBeNull();
    expect(trigger.type).toBe('stat_change');
    expect(trigger.stat).toBe('atmos');
    expect(trigger.value).toBe(30);
  });
});

describe('Inventory deletion via tryConsumeNow', () => {
  it('removes the item from inventory when tryConsumeNow() returns true', () => {
    const general = createMockGeneral({
      data: { item: 'che_치료_환약' },
      aux: { remain환약: 1 },
    });

    const item = new che_치료_환약();

    const shouldRemove = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    if (shouldRemove) {
      general.data.item = 'None';
    }

    expect(shouldRemove).toBe(true);
    expect(general.data.item).toBe('None');
  });

  it('does not consume on unrelated actions', () => {
    const general = createMockGeneral({ aux: { remain환약: 2 } });
    const item = new che_치료_환약();

    const shouldRemove = item.tryConsumeNow(general, 'WrongType', 'che_아이템치료');
    expect(shouldRemove).toBe(false);
    expect(general.aux['remain환약']).toBe(2);
  });
});
