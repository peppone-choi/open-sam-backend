// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { JosaUtil } from '../../utils/JosaUtil';

export class TradeEquipmentCommand extends GeneralCommand {
  protected static actionName = '장비매매';
  public static reqArg = true;

  static itemMap: { [key: string]: string } = {
    horse: '명마',
    weapon: '무기',
    book: '서적',
    item: '도구',
  };

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    
    const itemType = this.arg.itemType ?? null;
    if (!Object.keys(TradeEquipmentCommand.itemMap).includes(itemType)) {
      return false;
    }
    
    const itemCode = this.arg.itemCode ?? null;
    const allItems = GameConst.allItems;
    if (!(itemCode in allItems[itemType]) && itemCode !== 'None') {
      return false;
    }
    
    const itemClass = this.buildItemClass(itemCode);
    if (!itemClass.isBuyable()) {
      return false;
    }

    this.arg = {
      itemType,
      itemCode
    };
    return true;
  }

  protected init(): void {
    const general = this.generalObj;
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      ConstraintHelper.ReqCityTrader(general.data.npc ?? general.npc ?? 0),
    ];
  }

  protected initWithArg(): void {
    const general = this.generalObj;
    const itemType = this.arg.itemType;
    const itemTypeName = TradeEquipmentCommand.itemMap[itemType];
    const itemCode = this.arg.itemCode;
    const itemClass = this.buildItemClass(itemCode);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      ConstraintHelper.ReqCityTrader(general.data.npc ?? general.npc ?? 0),
      ConstraintHelper.ReqCityCapacity('secu', '치안 수치', itemClass.getReqSecu()),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];

    if (itemCode === 'None') {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqGeneralValue(itemType, itemTypeName, '!=', 'None')
      );
    } else if (itemCode === general.data[itemType]) {
      this.fullConditionConstraints.push(
        ConstraintHelper.AlwaysFail('이미 가지고 있습니다.')
      );
    } else if (!this.buildItemClass(general.data[itemType]).isBuyable()) {
      this.fullConditionConstraints.push(
        ConstraintHelper.AlwaysFail('이미 진귀한 것을 가지고 있습니다.')
      );
    }
  }

  public getCost(): [number, number] {
    if (!this.isArgValid) {
      return [0, 0];
    }

    const itemCode = this.arg.itemCode;
    const itemObj = this.buildItemClass(itemCode);
    const reqGold = itemObj.getCost();
    
    return [reqGold, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const itemType = this.arg.itemType;
    const itemCode = this.arg.itemCode;

    if (itemCode === 'None') {
      const itemTypeName = TradeEquipmentCommand.itemMap[itemType];
      const josaUl = JosaUtil.pick(itemTypeName, '을');
      return `${itemTypeName}${josaUl} 판매`;
    }

    const itemObj = this.buildItemClass(itemCode);
    const itemName = itemObj.getName();
    const itemRawName = itemObj.getRawName();
    const josaUl = JosaUtil.pick(itemRawName, '을');
    return `【${itemName}】${josaUl} 구입`;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');

    const itemType = this.arg.itemType;
    let itemCode = this.arg.itemCode;
    let buying = false;

    if (itemCode === 'None') {
      buying = false;
      itemCode = general.data[itemType];
    } else {
      buying = true;
    }

    const itemObj = this.buildItemClass(itemCode);
    const cost = itemObj.getCost();
    const itemName = itemObj.getName();
    const itemRawName = itemObj.getRawName();
    const josaUl = JosaUtil.pick(itemRawName, '을');

    const logger = general.getLogger();

    if (buying) {
      logger.pushGeneralActionLog(`<C>${itemName}</>${josaUl} 구입했습니다. <1>${date}</>`);
      general.increaseVarWithLimit('gold', -cost, 0);
      general.setVar(itemType, itemCode);
      // TODO: await general.onArbitraryAction(general, rng, '장비매매', '구매', { itemCode });
    } else {
      logger.pushGeneralActionLog(`<C>${itemName}</>${josaUl} 판매했습니다. <1>${date}</>`);
      general.increaseVarWithLimit('gold', cost / 2);
      // TODO: await general.onArbitraryAction(general, rng, '장비매매', '판매', { itemCode });
      general.setVar(itemType, null);

      if (!itemObj.isBuyable()) {
        const generalName = general.data.name || general.name;
        const josaYi = JosaUtil.pick(generalName, '이');
        const staticNation2 = general.getStaticNation();
        const nationName2 = staticNation2?.name || '무명';
        logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <C>${itemName}</>${josaUl} 판매했습니다!`);
        logger.pushGlobalHistoryLog(`<R><b>【판매】</b></><D><b>${nationName2}</b></>의 <Y>${generalName}</>${josaYi} <C>${itemName}</>${josaUl} 판매했습니다!`);
      }
    }

    const exp = 10;
    general.addExperience(exp);
    
    this.setResultTurn(new LastTurn(TradeEquipmentCommand.getName(), this.arg));
    general.checkStatChange();
    
    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);
    
    await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const general = this.generalObj;
    const db = DB.db();
    
    const citySecu = await db.queryFirstField(
      'SELECT secu FROM city WHERE city = ?', 
      [this.generalObj.getCityID()]
    );
    
    const itemList: any = {};
    const allItems = GameConst.allItems;
    
    for (const [itemType, itemCategories] of Object.entries(allItems) as [string, any][]) {
      const typeName = TradeEquipmentCommand.itemMap[itemType];
      const values: any[] = [];
      
      for (const [itemCode, cnt] of Object.entries(itemCategories) as [string, any][]) {
        if (cnt > 0) {
          continue;
        }
        const item = this.buildItemClass(itemCode);
        if (!item.isBuyable()) {
          continue;
        }
        values.push({
          id: itemCode,
          name: item.getName(),
          reqSecu: item.getReqSecu(),
          cost: item.getCost(),
          info: item.getInfo(),
          isBuyable: item.isBuyable(),
        });
      }
      
      itemList[itemType] = {
        typeName,
        values
      };
    }

    const ownItem: any = this.getItems();

    return {
      procRes: {
        citySecu,
        gold: general.data.gold,
        itemList,
        ownItem,
      }
    };
  }

  private getItems(): any {
    const general = this.generalObj;
    const ownItem: any = {};
    const itemTypes = ['horse', 'weapon', 'book', 'item'];
    
    for (const itemType of itemTypes) {
      const itemCode = general.data[itemType] || general[itemType];
      if (itemCode && itemCode !== 'None') {
        const item = this.buildItemClass(itemCode);
        ownItem[itemType] = {
          id: item.getRawClassName?.() || itemCode,
          name: item.getName?.() || '',
          reqSecu: item.getReqSecu?.() || 0,
          cost: item.getCost?.() || 0,
          info: item.getInfo?.() || '',
          isBuyable: item.isBuyable?.() || false,
        };
      }
    }
    return ownItem;
  }

  private buildItemClass(itemCode: string): any {
    return global.buildItemClass(itemCode);
  }
}
