/**
 * 유니크 아이템 추첨 시스템
 * PHP func.php의 tryUniqueItemLottery와 giveRandomUniqueItem 함수를 TypeScript로 변환
 */

import path from 'path';
import fs from 'fs';
import type { Model } from 'mongoose';
import { General } from '../models/general.model';
import { Auction } from '../models/auction.model';
import { RankData } from '../models/rank_data.model';
import { KVStorage } from './KVStorage';
import { ActionLogger } from './ActionLogger';
import { JosaUtil } from './JosaUtil';
import { Util } from './Util';
import { logger } from '../common/logger';
import { buildItemClass } from './item-class';
import { UserRecord } from '../models/user_record.model';
import { KVStorage as KVStorageCollection, IKVStorage } from '../models/kv-storage.model';
import { KVStorageModel } from '../models/KVStorage.model';
import { saveGeneral } from '../common/cache/model-cache.helper';

type UniqueItemConstants = {
  allItems: Record<string, Record<string, number>>;
  maxUniqueItemLimit: [number, number][];
  uniqueTrialCoef: number;
  maxUniqueTrialProb: number;
  inheritItemRandomPoint: number;
  minMonthToAllowInheritItem: number;
};

// dist/utils에서 2단계 상위가 프로젝트 루트
const constantsFilePath = path.join(
  __dirname,
  '../../config/scenarios/sangokushi/data/constants.json'
);

const SessionKVStorageModel = KVStorageCollection as unknown as Model<IKVStorage>;
const LegacyKVStorageModel = KVStorageModel as unknown as Model<any>;
const RankDataModel = RankData as unknown as Model<any>;
const GeneralModel = General as unknown as Model<any>;
const AuctionModel = Auction as unknown as Model<any>;
const UserRecordModel = UserRecord as unknown as Model<any>;

const defaultUniqueItemConstants: UniqueItemConstants = {
  allItems: {},
  maxUniqueItemLimit: [[-1, 1]],
  uniqueTrialCoef: 1,
  maxUniqueTrialProb: 0.25,
  inheritItemRandomPoint: 3000,
  minMonthToAllowInheritItem: 4
};
let cachedUniqueItemConstants: UniqueItemConstants | null = null;

function loadUniqueItemConstants(): UniqueItemConstants {
  if (cachedUniqueItemConstants) {
    return cachedUniqueItemConstants;
  }

  try {
    if (fs.existsSync(constantsFilePath)) {
      const raw = fs.readFileSync(constantsFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      cachedUniqueItemConstants = {
        ...defaultUniqueItemConstants,
        ...parsed,
        allItems: parsed?.allItems ?? defaultUniqueItemConstants.allItems,
        maxUniqueItemLimit: parsed?.maxUniqueItemLimit ?? defaultUniqueItemConstants.maxUniqueItemLimit,
        uniqueTrialCoef: parsed?.uniqueTrialCoef ?? defaultUniqueItemConstants.uniqueTrialCoef,
        maxUniqueTrialProb: parsed?.maxUniqueTrialProb ?? defaultUniqueItemConstants.maxUniqueTrialProb,
        inheritItemRandomPoint:
          parsed?.inheritItemRandomPoint ?? defaultUniqueItemConstants.inheritItemRandomPoint,
        minMonthToAllowInheritItem:
          parsed?.minMonthToAllowInheritItem ?? defaultUniqueItemConstants.minMonthToAllowInheritItem
      };
      return cachedUniqueItemConstants;
    }
  } catch (error: any) {
    logger.warn('[unique-item-lottery] Failed to load constants.json', error);
  }

  cachedUniqueItemConstants = { ...defaultUniqueItemConstants };
  return cachedUniqueItemConstants;
}

type UniqueStorageEntry = {
  itemCode: string;
  count: number;
};

function resolveUniqueStorageCount(value: any): number {
  if (value === null || value === undefined) {
    return 1;
  }

  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return 1;
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.length || 1;
  }

  if (typeof parsed === 'object') {
    if (Array.isArray(parsed?.queue)) {
      return parsed.queue.length || 1;
    }
    if (Array.isArray(parsed?.items)) {
      return parsed.items.length || 1;
    }
    if (typeof parsed?.count === 'number') {
      return parsed.count || 1;
    }
  }

  return 1;
}

function extractUniqueItemCode(source: string | undefined, sessionId: string, enforceSession: boolean): string | null {
  if (!source || !source.startsWith('ut_')) {
    return null;
  }

  let remainder = source.substring(3);
  if (!remainder) {
    return null;
  }

  if (!enforceSession) {
    return remainder;
  }

  const colonPrefix = `${sessionId}:`;
  if (remainder.startsWith(colonPrefix)) {
    return remainder.substring(colonPrefix.length) || null;
  }

  const underscorePrefix = `${sessionId}_`;
  if (remainder.startsWith(underscorePrefix)) {
    return remainder.substring(underscorePrefix.length) || null;
  }

  return null;
}

async function collectReservedUniqueStorage(sessionId: string): Promise<UniqueStorageEntry[]> {
  try {
    const docs = await SessionKVStorageModel.find({
      session_id: sessionId,
      storage_id: { $regex: /^ut_/ }
    }).lean();

    if (docs.length > 0) {
      return docs
        .map((doc) => {
          const itemCode = extractUniqueItemCode(doc.storage_id, sessionId, false);
          if (!itemCode) {
            return null;
          }
          return {
            itemCode,
            count: resolveUniqueStorageCount(doc.value)
          };
        })
        .filter((entry): entry is UniqueStorageEntry => entry !== null);
    }
  } catch (error: any) {
    logger.debug('[unique-item-lottery] Failed to load session KVStorage ut_* entries', error.message);
  }

  try {
    const legacyDocs = await LegacyKVStorageModel.find({
      namespace: { $regex: /^ut_/ }
    }).lean();

    return legacyDocs
      .map((doc: any) => {
        const itemCode = extractUniqueItemCode(doc.namespace, sessionId, true);
        if (!itemCode) {
          return null;
        }
        return {
          itemCode,
          count: resolveUniqueStorageCount(doc.value)
        };
      })
      .filter((entry): entry is UniqueStorageEntry => entry !== null);
  } catch (error: any) {
    logger.debug('[unique-item-lottery] Failed to load legacy KVStorage ut_* entries', error.message);
    return [];
  }
}

function getOwnerId(general: any): string | null {
  const owner = general?.owner ?? general?.data?.owner;
  if (owner === undefined || owner === null) {
    return null;
  }
  return String(owner);
}

function getGeneralId(general: any): number {
  if (typeof general?.getID === 'function') {
    return general.getID();
  }
  return general?.no ?? general?.data?.no ?? 0;
}

async function refundInheritRandomUnique(
  general: any,
  sessionId: string,
  amount: number,
  message: string
): Promise<void> {
  const ownerId = getOwnerId(general);
  if (!ownerId || amount <= 0) {
    return;
  }

  general.data = general.data || {};
  general.data.aux = general.data.aux || {};
  if (general.data.aux.inheritRandomUnique) {
    general.data.aux.inheritRandomUnique = null;
  }

  if (typeof general.setAuxVar === 'function') {
    try {
      general.setAuxVar('inheritRandomUnique', null);
    } catch (error) {
      logger.debug('[unique-item-lottery] Failed to sync aux var', error);
    }
  }

  try {
    const inheritStor = KVStorage.getStorage(`inheritance_${ownerId}:${sessionId}`);
    const currentPoint = await inheritStor.getValue('previous');
    const previousPoint = Array.isArray(currentPoint) ? currentPoint[0] : (currentPoint || 0);
    await inheritStor.setValue('previous', [previousPoint + amount, null]);
  } catch (error) {
    logger.warn('[unique-item-lottery] Failed to refund inheritance storage', error);
  }

  const generalId = getGeneralId(general);
  if (generalId) {
    await RankDataModel.updateOne(
      { session_id: sessionId, 'data.general_id': generalId, 'data.type': 'inherit_point_spent_dyn' },
      { $inc: { 'data.value': -amount } },
      { upsert: true }
    );
  }

  const rankContainer = (general.rank ?? general.data?.rank ?? {}) as Record<string, any>;
  const currentSpent = rankContainer.inherit_point_spent_dynamic || 0;
  const nextSpent = currentSpent - amount;
  if (!general.rank) {
    general.rank = {};
  }
  general.rank.inherit_point_spent_dynamic = nextSpent;
  if (general.data) {
    general.data.rank = general.data.rank || {};
    general.data.rank.inherit_point_spent_dynamic = nextSpent;
  }
  if (typeof general.markModified === 'function') {
    general.markModified('rank');
    general.markModified('data');
  }

  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const [year, month] = await gameStor.getValuesAsArray(['year', 'month']);
    await UserRecordModel.create({
      session_id: sessionId,
      user_id: ownerId,
      log_type: 'inheritPoint',
      text: message,
      year: year || 0,
      month: month || 0,
      date: new Date().toISOString()
    });
  } catch (error) {
    logger.warn('[unique-item-lottery] Failed to write inheritPoint log', error);
  }

  // CQRS: 캐시에 저장
  const generalNo = general.no || general.data?.no;
  if (generalNo && sessionId) {
    await saveGeneral(sessionId, generalNo, general.toObject ? general.toObject() : general);
  }
}

/**
 * 랜덤 유니크 아이템 지급
 * @param rng 난수 생성기 (nextBool, choiceUsingWeightPair 메서드 필요)
 * @param general 장수 모델 인스턴스
 * @param sessionId 세션 ID
 * @param acquireType 획득 타입 ('아이템', '설문조사', '랜덤 임관', '건국' 등)
 */
export async function giveRandomUniqueItem(
  rng: any,
  general: any,
  sessionId: string,
  acquireType: string = '아이템'
): Promise<boolean> {
  try {
    if (!general) {
      logger.warn('[giveRandomUniqueItem] general is undefined');
      return false;
    }
    const generalData = general.data || (typeof general.get === 'function' ? general.get('data') : {}) || {};
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);

    const constants = loadUniqueItemConstants();
    const { allItems, inheritItemRandomPoint, minMonthToAllowInheritItem } = constants;

    // 사용 가능한 유니크 아이템 목록
    const availableUnique: [string[], number][] = [];
    const occupiedUnique: Record<string, number> = {};
    const invalidItemType: Record<string, boolean> = {};

    // 장수가 이미 가진 유니크 아이템 확인 (구매 불가능한 아이템)
    for (const itemType of Object.keys(allItems)) {
      const itemCode = generalData[itemType] || 'None';
      if (itemCode !== 'None') {
        try {
          const ownItem = buildItemClass(itemCode);
          if (ownItem && !ownItem.isBuyable()) {
            invalidItemType[itemType] = true;
          }
        } catch (error) {
          // 무시
        }
      }
    }

    // 모든 장수들의 유니크 아이템 사용 현황 조회
    const generals = await GeneralModel.find({ session_id: sessionId }).lean();
    for (const gen of generals) {
      const genData = gen.data || {};
      for (const itemType of Object.keys(allItems)) {
        if (invalidItemType[itemType]) {
          continue;
        }
        const itemCode = genData[itemType] || 'None';
        if (itemCode !== 'None') {
          try {
            const itemClass = buildItemClass(itemCode);
            if (itemClass && !itemClass.isBuyable()) {
              occupiedUnique[itemCode] = (occupiedUnique[itemCode] || 0) + 1;
            }
          } catch (error) {
            // 무시
          }
        }
      }
    }

    // 경매 진행 중인 유니크 아이템 확인
    const auctionItems = await AuctionModel.find({
      session_id: sessionId,
      type: 'UniqueItem',
      finished: false
    }).lean();

    for (const auction of auctionItems) {
      const itemCode = auction.target;
      if (itemCode) {
        occupiedUnique[itemCode] = (occupiedUnique[itemCode] || 0) + 1;
      }
    }

    // KVStorage의 ut_* 네임스페이스 확인 (임시 저장된 유니크 아이템)
    try {
      const storageEntries = await collectReservedUniqueStorage(sessionId);
      for (const entry of storageEntries) {
        try {
          const itemClass = buildItemClass(entry.itemCode);
          if (itemClass && !itemClass.isBuyable()) {
            occupiedUnique[entry.itemCode] = (occupiedUnique[entry.itemCode] || 0) + entry.count;
          }
        } catch {
          // legacy 데이터 오류 무시
        }
      }
    } catch (error: any) {
      logger.debug('Failed to aggregate ut_* storage:', error.message);
    }

    // 사용 가능한 유니크 아이템 목록 생성
    for (const [itemType, itemCategories] of Object.entries(allItems)) {
      if (invalidItemType[itemType]) {
        continue;
      }
      for (const [itemCode, cnt] of Object.entries(itemCategories)) {
        if (cnt === 0) {
          continue;
        }
        const occupied = occupiedUnique[itemCode] || 0;
        const remain = cnt - occupied;
        if (remain > 0) {
          availableUnique.push([[itemType, itemCode], remain]);
        }
      }
    }

    // 사용 가능한 유니크 아이템이 없으면 포인트 반환
    if (availableUnique.length === 0) {
      if (generalData.aux?.inheritRandomUnique) {
        await refundInheritRandomUnique(
          general,
          sessionId,
          inheritItemRandomPoint,
          `얻을 유니크가 없어 ${inheritItemRandomPoint} 포인트 반환`
        );
      }
      return false;
    }

    // 유산 포인트로 구매한 경우 처리
    const inheritRandomUnique = generalData.aux?.inheritRandomUnique;
    if (inheritRandomUnique) {
      const [year, month, initYear, initMonth] = await gameStor.getValuesAsArray([
        'year',
        'month',
        'init_year',
        'init_month'
      ]);
      const relMonthByInit =
        Util.joinYearMonth(year || 184, month || 1) - Util.joinYearMonth(initYear || 184, initMonth || 1);
      const availableBuyUnique = relMonthByInit >= minMonthToAllowInheritItem;

      if (availableBuyUnique) {
        generalData.aux = generalData.aux || {};
        generalData.aux.inheritRandomUnique = null;
        if (typeof general.markModified === 'function') {
          general.markModified('data');
        }
      }
    }

    // 가중치 기반 랜덤 선택
    const [itemType, itemCode] = rng.choiceUsingWeightPair ? rng.choiceUsingWeightPair(availableUnique) : Util.choiceRandomUsingWeightPair(availableUnique)[0];

    // 국가 정보 가져오기
    const nationId = generalData.nation || 0;
    let nationName = '재야';
    if (nationId > 0) {
      const { Nation } = await import('../models/nation.model');
      const NationModel = Nation as unknown as Model<any>;
      const nation = (await NationModel.findOne({
        session_id: general.session_id,
        nation: nationId
      }).lean()) as { name?: string } | null;
      nationName = nation?.name || `국가 ${nationId}`;
    }
    const generalName = general.name || '';
    const josaYi = JosaUtil.pick(generalName, '이');

    // 아이템 정보
    const itemObj = buildItemClass(itemCode);
    const itemName = itemObj.getName();
    const itemRawName = itemObj.getRawClassName ? itemObj.getRawClassName() : itemCode;
    const josaUl = JosaUtil.pick(itemRawName, '을');

    // 장수에게 아이템 지급
    generalData[itemType] = itemCode;
    general.markModified('data');
    // CQRS: 캐시에 저장
    const generalNo = general.no || generalData.no;
    await saveGeneral(sessionId, generalNo, general.toObject());

    // 로그 기록
    const [year, month] = await gameStor.getValuesAsArray(['year', 'month']);
    const actionLogger = new ActionLogger(general.no, nationId, year || 184, month || 1);

    actionLogger.pushGeneralActionLog(`<C>${itemName}</>${josaUl} 습득했습니다!`);
    actionLogger.pushGeneralHistoryLog(`<C>${itemName}</>${josaUl} 습득`);
    actionLogger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <C>${itemName}</>${josaUl} 습득했습니다!`);
    actionLogger.pushGlobalHistoryLog(`<C><b>【${acquireType}】</b></><D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} <C>${itemName}</>${josaUl} 습득했습니다!`);
    await actionLogger.flush();

    return true;
  } catch (error: any) {
    logger.error(`[giveRandomUniqueItem] Error: ${error.message}`, { stack: error.stack });
    return false;
  }
}

/**
 * 유니크 아이템 추첨 시도
 * @param rng 난수 생성기 (nextBool, nextFloat 메서드 필요)
 * @param general 장수 모델 인스턴스
 * @param sessionId 세션 ID
 * @param acquireType 획득 타입 ('아이템', '설문조사', '랜덤 임관', '건국' 등)
 */
export async function tryUniqueItemLottery(
  rng: any,
  general: any,
  sessionId: string,
  acquireType: string = '아이템'
): Promise<boolean> {
  try {
    if (!general) {
      logger.warn('[tryUniqueItemLottery] general is undefined');
      return false;
    }
    const generalData = general.data || (typeof general.get === 'function' ? general.get('data') : {}) || {};
    const npcType = generalData.npc || 0;

    // NPC 타입 2 이상이면 추첨 불가
    if (npcType >= 2) {
      return false;
    }

    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);

    const {
      allItems,
      maxUniqueItemLimit,
      uniqueTrialCoef,
      maxUniqueTrialProb,
      inheritItemRandomPoint,
      minMonthToAllowInheritItem
    } = loadUniqueItemConstants();

    const itemTypeCnt = Object.keys(allItems).length;

    // 년도별 최대 시도 횟수 계산
    const [startYear, year, month, initYear, initMonth] = await gameStor.getValuesAsArray(['startyear', 'year', 'month', 'init_year', 'init_month']);
    const relYear = (year || 184) - (startYear || 184);
    let maxTrialCountByYear = 1;
    for (const [targetYear, targetTrialCnt] of maxUniqueItemLimit) {
      if (relYear < targetYear) {
        break;
      }
      maxTrialCountByYear = targetTrialCnt;
    }

    let trialCnt = Math.min(itemTypeCnt, maxTrialCountByYear);
    let maxCnt = itemTypeCnt;

    // 이미 가진 유니크 아이템만큼 시도 횟수 감소
    for (const itemType of Object.keys(allItems)) {
      const itemCode = generalData[itemType] || 'None';
      if (itemCode !== 'None') {
        try {
          const item = buildItemClass(itemCode);
          if (item && !item.isBuyable()) {
            trialCnt -= 1;
            maxCnt -= 1;
          }
        } catch (error) {
          // 무시
        }
      }
    }

    // 모든 아이템 슬롯이 유니크로 채워져 있으면 실패
    if (trialCnt <= 0) {
      if (generalData.aux?.inheritRandomUnique) {
        await refundInheritRandomUnique(
          general,
          sessionId,
          inheritItemRandomPoint,
          `유니크를 얻을 공간이 없어 ${inheritItemRandomPoint} 포인트 반환`
        );
      }
      return false;
    }

    // 시나리오 정보
    const scenario = (await gameStor.getValue('scenario')) || 0;
    const genCount = await GeneralModel.countDocuments({ session_id: sessionId, 'data.npc': { $lt: 2 } });

    // 확률 계산
    let prob: number;
    if (scenario < 100) {
      prob = 1 / (genCount * 3 * itemTypeCnt); // 3~4개월에 하나씩
    } else {
      prob = 1 / (genCount * itemTypeCnt); // 1~2개월에 하나씩
    }

    if (acquireType === '설문조사') {
      prob = 1 / (genCount * itemTypeCnt * 0.7 / 3); // 투표율 70%, 설문조사 한번에 2~3개
    } else if (acquireType === '랜덤 임관') {
      prob = 1 / (genCount * itemTypeCnt / 10 / 2); // 랜임시 2개(10%)
    }

    prob *= uniqueTrialCoef;
    prob = Math.min(prob, maxUniqueTrialProb);

    prob /= Math.sqrt(7);
    const moreProb = Math.pow(10, 1 / 4);

    // 유산 포인트로 구매한 경우 또는 건국 시 100% 확률
    const relMonthByInit = Util.joinYearMonth(year || 184, month || 1) - Util.joinYearMonth(initYear || 184, initMonth || 1);
    const availableBuyUnique = relMonthByInit >= minMonthToAllowInheritItem;
    const inheritRandomUnique = generalData.aux?.inheritRandomUnique;

    if (inheritRandomUnique && availableBuyUnique) {
      prob = 1; // 포인트로 랜덤 유니크 획득
    } else if (acquireType === '건국') {
      prob = 1; // 건국시 100%
    }

    // 확률 시도
    let result = false;
    for (let i = 0; i < maxCnt; i++) {
      const nextBool = rng.nextBool || ((p: number) => Math.random() < p);
      if (nextBool(prob)) {
        result = true;
        break;
      }
      prob *= moreProb;
    }

    if (!result) {
      return false;
    }

    // 유니크 아이템 지급
    return await giveRandomUniqueItem(rng, general, sessionId, acquireType);
  } catch (error: any) {
    logger.error(`[tryUniqueItemLottery] Error: ${error.message}`, { stack: error.stack });
    return false;
  }
}

