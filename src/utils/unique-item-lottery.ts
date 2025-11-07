/**
 * 유니크 아이템 추첨 시스템
 * PHP func.php의 tryUniqueItemLottery와 giveRandomUniqueItem 함수를 TypeScript로 변환
 */

import { General } from '../models/general.model';
import { Auction } from '../models/auction.model';
import { RankData } from '../models/rank_data.model';
import { KVStorage } from './KVStorage';
import { ActionLogger } from './ActionLogger';
import { JosaUtil } from './JosaUtil';
import { Util } from './Util';
import { logger } from '../common/logger';

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
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    
    // buildItemClass 함수 가져오기
    const buildItemClass = global.buildItemClass;
    if (!buildItemClass) {
      logger.warn('buildItemClass function not found');
      return false;
    }

    // GameConst.allItems 가져오기 (constants.json에서)
    let allItems: Record<string, Record<string, number>> = {};
    try {
      const path = require('path');
      const fs = require('fs');
      const constantsPath = path.join(
        __dirname,
        '../../../config/scenarios/sangokushi/data/constants.json'
      );
      if (fs.existsSync(constantsPath)) {
        const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
        allItems = constantsData.allItems || {};
      }
    } catch (error: any) {
      logger.error('Failed to load allItems:', error);
      return false;
    }

    // 사용 가능한 유니크 아이템 목록
    const availableUnique: [string[], number][] = [];
    const occupiedUnique: Record<string, number> = {};
    const invalidItemType: Record<string, boolean> = {};

    // 장수가 이미 가진 유니크 아이템 확인 (구매 불가능한 아이템)
    const generalData = general.data || {};
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
    const generals = await General.find({ session_id: sessionId }).lean();
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
    const auctionItems = await Auction.find({
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
      const KVStorageModel = require('../models/KVStorage.model').KVStorageModel;
      const storageDocs = await KVStorageModel.find({
        namespace: { $regex: /^ut_/ }
      }).lean();

      for (const doc of storageDocs) {
        const itemCode = doc.namespace.substring(3); // 'ut_' 제거
        try {
          const itemClass = buildItemClass(itemCode);
          if (itemClass && !itemClass.isBuyable()) {
            const cnt = doc.value ? JSON.parse(doc.value).length || 1 : 1;
            occupiedUnique[itemCode] = (occupiedUnique[itemCode] || 0) + cnt;
          }
        } catch (error) {
          // 무시
        }
      }
    } catch (error: any) {
      logger.debug('Failed to check KVStorage ut_*:', error.message);
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
      const inheritRandomUnique = generalData.aux?.inheritRandomUnique;
      if (inheritRandomUnique) {
        generalData.aux = generalData.aux || {};
        generalData.aux.inheritRandomUnique = null;
        general.markModified('data');

        // 유산 포인트 반환
        const inheritItemRandomPoint = 3000; // GameConst에서 가져와야 함
        const inheritStor = KVStorage.getStorage(`inheritance_${generalData.owner}:${sessionId}`);
        const currentPoint = await inheritStor.getValue('previous');
        const previousPoint = Array.isArray(currentPoint) ? currentPoint[0] : (currentPoint || 0);
        await inheritStor.setValue('previous', [previousPoint + inheritItemRandomPoint, null]);

        // RankData 업데이트
        await RankData.updateOne(
          { session_id: sessionId, 'data.general_id': general.no, 'data.type': 'inherit_point_spent_dyn' },
          { $inc: { 'data.value': -inheritItemRandomPoint } },
          { upsert: true }
        );

        // UserRecord 로깅 (UserRecord 모델이 있다면)
        // TODO: UserRecord 로깅 구현
      }
      return false;
    }

    // 유산 포인트로 구매한 경우 처리
    const inheritRandomUnique = generalData.aux?.inheritRandomUnique;
    if (inheritRandomUnique) {
      const [year, month, initYear, initMonth] = await gameStor.getValuesAsArray(['year', 'month', 'init_year', 'init_month']);
      const relMonthByInit = Util.joinYearMonth(year || 180, month || 1) - Util.joinYearMonth(initYear || 180, initMonth || 1);
      const minMonthToAllowInheritItem = 4; // GameConst에서 가져와야 함
      const availableBuyUnique = relMonthByInit >= minMonthToAllowInheritItem;

      if (availableBuyUnique) {
        generalData.aux = generalData.aux || {};
        generalData.aux.inheritRandomUnique = null;
        general.markModified('data');
      }
    }

    // 가중치 기반 랜덤 선택
    const [itemType, itemCode] = rng.choiceUsingWeightPair ? rng.choiceUsingWeightPair(availableUnique) : Util.choiceRandomUsingWeightPair(availableUnique)[0];

    // 국가 정보 가져오기
    const nationId = generalData.nation || 0;
    const nationName = nationId === 0 ? '재야' : '국가'; // TODO: 실제 국가 이름 가져오기
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
    await general.save();

    // 로그 기록
    const [year, month] = await gameStor.getValuesAsArray(['year', 'month']);
    const actionLogger = new ActionLogger(general.no, nationId, year || 180, month || 1);

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
    const generalData = general.data || {};
    const npcType = generalData.npc || 0;

    // NPC 타입 2 이상이면 추첨 불가
    if (npcType >= 2) {
      return false;
    }

    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);

    // GameConst.allItems 가져오기
    let allItems: Record<string, Record<string, number>> = {};
    let maxUniqueItemLimit: [number, number][] = [];
    let uniqueTrialCoef = 1;
    let maxUniqueTrialProb = 0.25;
    let inheritItemRandomPoint = 3000;
    let minMonthToAllowInheritItem = 4;

    try {
      const path = require('path');
      const fs = require('fs');
      const constantsPath = path.join(
        __dirname,
        '../../../config/scenarios/sangokushi/data/constants.json'
      );
      if (fs.existsSync(constantsPath)) {
        const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
        allItems = constantsData.allItems || {};
        maxUniqueItemLimit = constantsData.maxUniqueItemLimit || [[-1, 1]];
        uniqueTrialCoef = constantsData.uniqueTrialCoef || 1;
        maxUniqueTrialProb = constantsData.maxUniqueTrialProb || 0.25;
        inheritItemRandomPoint = constantsData.inheritItemRandomPoint || 3000;
        minMonthToAllowInheritItem = constantsData.minMonthToAllowInheritItem || 4;
      }
    } catch (error: any) {
      logger.warn('Failed to load constants:', error.message);
    }

    const itemTypeCnt = Object.keys(allItems).length;

    // 년도별 최대 시도 횟수 계산
    const [startYear, year, month, initYear, initMonth] = await gameStor.getValuesAsArray(['startyear', 'year', 'month', 'init_year', 'init_month']);
    const relYear = (year || 180) - (startYear || 180);
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
    const buildItemClass = global.buildItemClass;
    for (const itemType of Object.keys(allItems)) {
      const itemCode = generalData[itemType] || 'None';
      if (itemCode !== 'None' && buildItemClass) {
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
      const inheritRandomUnique = generalData.aux?.inheritRandomUnique;
      if (inheritRandomUnique) {
        generalData.aux = generalData.aux || {};
        generalData.aux.inheritRandomUnique = null;
        general.markModified('data');
        await general.save();

        // 유산 포인트 반환
        const inheritStor = KVStorage.getStorage(`inheritance_${generalData.owner}:${sessionId}`);
        const currentPoint = await inheritStor.getValue('previous');
        const previousPoint = Array.isArray(currentPoint) ? currentPoint[0] : (currentPoint || 0);
        await inheritStor.setValue('previous', [previousPoint + inheritItemRandomPoint, null]);

        // RankData 업데이트
        await RankData.updateOne(
          { session_id: sessionId, 'data.general_id': general.no, 'data.type': 'inherit_point_spent_dyn' },
          { $inc: { 'data.value': -inheritItemRandomPoint } },
          { upsert: true }
        );
      }
      return false;
    }

    // 시나리오 정보
    const scenario = (await gameStor.getValue('scenario')) || 0;
    const genCount = await General.countDocuments({ session_id: sessionId, 'data.npc': { $lt: 2 } });

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
    const relMonthByInit = Util.joinYearMonth(year || 180, month || 1) - Util.joinYearMonth(initYear || 180, initMonth || 1);
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

