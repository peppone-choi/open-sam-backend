/**
 * Item System Tests
 * 
 * 아이템 효과 및 소비 조건 검증
 * PHP 로직과 동일한지 확인
 */

import {
  BaseItem,
  che_치료_환약,
  che_치료_정력견혈,
  che_계략_삼략,
  che_계략_육도,
  che_능력치_무력_두강주,
  che_능력치_지력_이강주,
  che_훈련_과실주,
  che_사기_탁주,
  che_농성_위공자병법,
  createItem
} from '../items';

// Mock IGeneral for testing
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
    ...overrides.data
  },
  aux: overrides.aux || {},
  getID: () => 1,
  getNationID: () => 1,
  markModified: jest.fn(),
  ...overrides
});

describe('BaseItem', () => {
  describe('Basic Properties', () => {
    it('should return correct item name and info', () => {
      const item = new che_치료_환약();
      expect(item.getRawName()).toBe('환약');
      expect(item.getName()).toBe('환약(치료)');
      expect(item.getInfo()).toContain('턴 실행 전 부상 회복');
    });

    it('should return correct cost and buyable status', () => {
      const item = new che_치료_환약();
      expect(item.getCost()).toBe(200);
      expect(item.isConsumable()).toBe(true);
      expect(item.isBuyable()).toBe(true);
      expect(item.getReqSecu()).toBe(0);
    });
  });

  describe('Item Registry', () => {
    it('should create item instance from class name', () => {
      const item = createItem('che_치료_환약');
      expect(item).toBeInstanceOf(che_치료_환약);
      expect(item?.getRawName()).toBe('환약');
    });

    it('should return null for invalid class name', () => {
      const item = createItem('invalid_item_name');
      expect(item).toBeNull();
    });
  });
});

describe('HealItem - 치료 아이템', () => {
  describe('che_치료_환약', () => {
    it('should initialize with 3 uses on purchase', () => {
      const item = new che_치료_환약();
      const general = createMockGeneral();
      const mockRng = {} as any;

      // 구매 액션
      item.onArbitraryAction(general, mockRng, '장비매매', '구매', null);
      
      expect(general.aux['remain환약']).toBe(3);
    });

    it('should consume item after 3 uses === PHP', () => {
      const item = new che_치료_환약();
      const general = createMockGeneral({
        aux: { remain환약: 3 }
      });

      // 첫 번째 사용 (2회 남음)
      let shouldRemove = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
      expect(shouldRemove).toBe(false);
      expect(general.aux['remain환약']).toBe(2);

      // 두 번째 사용 (1회 남음)
      shouldRemove = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
      expect(shouldRemove).toBe(false);
      expect(general.aux['remain환약']).toBe(1);

      // 세 번째 사용 (제거)
      shouldRemove = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
      expect(shouldRemove).toBe(true);
      expect(general.aux['remain환약']).toBeNull();
    });

    it('should not consume on wrong action type', () => {
      const item = new che_치료_환약();
      const general = createMockGeneral({
        aux: { remain환약: 3 }
      });

      const shouldRemove = item.tryConsumeNow(general, 'WrongAction', 'che_아이템치료');
      expect(shouldRemove).toBe(false);
      expect(general.aux['remain환약']).toBe(3);
    });
  });

  describe('che_치료_정력견혈', () => {
    it('should increase recovery rate by 50%p === PHP', () => {
      const item = new che_치료_정력견혈();
      const baseRate = 0.3;
      
      const modifiedRate = item.onCalcDomestic('치료', 'recovery_rate', baseRate);
      expect(modifiedRate).toBe(0.8); // 0.3 + 0.5
    });

    it('should not modify other turn types', () => {
      const item = new che_치료_정력견혈();
      const baseValue = 100;
      
      const modifiedValue = item.onCalcDomestic('훈련', 'recovery_rate', baseValue);
      expect(modifiedValue).toBe(100);
    });
  });
});

describe('StrategyItem - 계략 아이템', () => {
  describe('che_계략_삼략', () => {
    it('should increase strategy success rate by 20%p === PHP', () => {
      const item = new che_계략_삼략();
      const baseSuccess = 0.5;
      
      const modifiedSuccess = item.onCalcDomestic('계략', 'success', baseSuccess);
      expect(modifiedSuccess).toBe(0.7); // 0.5 + 0.2
    });

    it('should increase war magic trial prob by 10%p === PHP', () => {
      const item = new che_계략_삼략();
      const general = createMockGeneral();
      const baseProb = 0.2;
      
      const modifiedProb = item.onCalcStat(general, 'warMagicTrialProb', baseProb);
      expect(modifiedProb).toBeCloseTo(0.3); // 0.2 + 0.1 (floating point precision)
    });

    it('should increase war magic success prob by 10%p === PHP', () => {
      const item = new che_계략_삼략();
      const general = createMockGeneral();
      const baseProb = 0.5;
      
      const modifiedProb = item.onCalcStat(general, 'warMagicSuccessProb', baseProb);
      expect(modifiedProb).toBe(0.6); // 0.5 + 0.1
    });
  });

  describe('che_계략_육도', () => {
    it('should increase strategy success rate by 15%p === PHP', () => {
      const item = new che_계략_육도();
      const baseSuccess = 0.5;
      
      const modifiedSuccess = item.onCalcDomestic('계략', 'success', baseSuccess);
      expect(modifiedSuccess).toBe(0.65); // 0.5 + 0.15
    });
  });
});

describe('BuffItem - 버프 아이템', () => {
  describe('che_능력치_무력_두강주', () => {
    it('should increase strength by 5 === PHP', () => {
      const item = new che_능력치_무력_두강주();
      const general = createMockGeneral();
      const baseStrength = 75;
      
      const modifiedStrength = item.onCalcStat(general, 'strength', baseStrength);
      expect(modifiedStrength).toBe(80); // 75 + 5
    });

    it('should not modify other stats', () => {
      const item = new che_능력치_무력_두강주();
      const general = createMockGeneral();
      const baseIntel = 85;
      
      const modifiedIntel = item.onCalcStat(general, 'intel', baseIntel);
      expect(modifiedIntel).toBe(85);
    });
  });

  describe('che_능력치_지력_이강주', () => {
    it('should increase intel by 5 === PHP', () => {
      const item = new che_능력치_지력_이강주();
      const general = createMockGeneral();
      const baseIntel = 85;
      
      const modifiedIntel = item.onCalcStat(general, 'intel', baseIntel);
      expect(modifiedIntel).toBe(90); // 85 + 5
    });
  });

  describe('che_훈련_과실주', () => {
    it('should increase bonus train by 10 === PHP', () => {
      const item = new che_훈련_과실주();
      const general = createMockGeneral();
      const baseTrain = 50;
      
      const modifiedTrain = item.onCalcStat(general, 'bonusTrain', baseTrain);
      expect(modifiedTrain).toBe(60); // 50 + 10
    });
  });
});

describe('BattleItem - 전투 아이템', () => {
  describe('che_사기_탁주', () => {
    it('should provide battle init trigger for morale +30 === PHP', () => {
      const item = new che_사기_탁주();
      const mockUnit = {} as any;
      
      const trigger = item.getBattleInitSkillTriggerList(mockUnit);
      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('stat_change');
      expect(trigger?.stat).toBe('atmos');
      expect(trigger?.value).toBe(30);
    });

    it('should be consumable === PHP', () => {
      const item = new che_사기_탁주();
      expect(item.isConsumable()).toBe(true);
      expect(item.getCost()).toBe(1000);
    });
  });

  describe('che_농성_위공자병법', () => {
    it('should increase siege defense by 20% === PHP', () => {
      const item = new che_농성_위공자병법();
      const general = createMockGeneral();
      const baseDefense = 100;
      
      const modifiedDefense = item.onCalcStat(general, 'siegeDefense', baseDefense);
      expect(modifiedDefense).toBe(120); // 100 * 1.2
    });

    it('should not be consumable === PHP', () => {
      const item = new che_농성_위공자병법();
      expect(item.isConsumable()).toBe(false);
    });
  });
});

describe('Item Effect Calculation', () => {
  it('should stack multiple item effects correctly', () => {
    const item1 = new che_계략_삼략(); // +20%p
    const item2 = new che_계략_육도();  // +15%p
    const general = createMockGeneral();
    
    let successRate = 0.5;
    successRate = item1.onCalcDomestic('계략', 'success', successRate);
    successRate = item2.onCalcDomestic('계략', 'success', successRate);
    
    expect(successRate).toBe(0.85); // 0.5 + 0.2 + 0.15
  });

  it('should not interfere with unrelated stats', () => {
    const item = new che_능력치_무력_두강주();
    const general = createMockGeneral();
    
    const leadership = item.onCalcStat(general, 'leadership', 80);
    const intel = item.onCalcStat(general, 'intel', 85);
    
    expect(leadership).toBe(80);
    expect(intel).toBe(85);
  });
});

describe('Consumption Conditions', () => {
  it('should require correct action type for consumption', () => {
    const item = new che_치료_환약();
    const general = createMockGeneral({ aux: { remain환약: 1 } });
    
    // 잘못된 액션 타입
    let shouldConsume = item.tryConsumeNow(general, 'WrongType', 'che_아이템치료');
    expect(shouldConsume).toBe(false);
    
    // 올바른 액션 타입
    shouldConsume = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(shouldConsume).toBe(true);
  });

  it('should require correct command for consumption', () => {
    const item = new che_치료_환약();
    const general = createMockGeneral({ aux: { remain환약: 1 } });
    
    // 잘못된 커맨드
    let shouldConsume = item.tryConsumeNow(general, 'GeneralTrigger', 'WrongCommand');
    expect(shouldConsume).toBe(false);
    
    // 올바른 커맨드
    shouldConsume = item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(shouldConsume).toBe(true);
  });
});

describe('Inventory Management', () => {
  it('should track remaining uses correctly', () => {
    const item = new che_치료_환약();
    const general = createMockGeneral();
    const mockRng = {} as any;
    
    // 구매
    item.onArbitraryAction(general, mockRng, '장비매매', '구매', null);
    expect(general.aux['remain환약']).toBe(3);
    
    // 사용
    item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(general.aux['remain환약']).toBe(2);
    
    item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(general.aux['remain환약']).toBe(1);
    
    // 마지막 사용 시 null로 설정
    item.tryConsumeNow(general, 'GeneralTrigger', 'che_아이템치료');
    expect(general.aux['remain환약']).toBeNull();
  });

  it('should initialize aux var on purchase === PHP', () => {
    const item = new che_치료_환약();
    const general = createMockGeneral({ aux: {} });
    const mockRng = {} as any;
    
    expect(general.aux['remain환약']).toBeUndefined();
    
    item.onArbitraryAction(general, mockRng, '장비매매', '구매', null);
    
    expect(general.aux['remain환약']).toBe(3);
  });
});
