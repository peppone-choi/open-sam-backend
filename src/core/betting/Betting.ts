// @ts-nocheck - Type issues need investigation
import { KVStorage } from '../../utils/KVStorage';
import { General } from '../../models/general.model';
import { NgBetting } from '../../models/ng_betting.model';
import { Util } from '../../utils/Util';
import { GameConst } from '../../const/GameConst';
import { logger } from '../../common/logger';
import { GeneralRecord } from '../../models/general_record.model';

/**
 * Betting 클래스
 * 
 * PHP 버전의 sammo\Betting 클래스를 TypeScript로 변환
 */
export class Betting {
  public static readonly LAST_BETTING_ID_KEY = 'last_betting_id';

  private info: any; // BettingInfo
  private bettingID: number;

  /**
   * 다음 베팅 ID 생성
   */
  static async genNextBettingID(sessionId: string): Promise<number> {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    gameStor.invalidateCacheValue(this.LAST_BETTING_ID_KEY);
    const bettingID = ((await gameStor.getValue(this.LAST_BETTING_ID_KEY)) ?? 0) + 1;
    await gameStor.setValue(this.LAST_BETTING_ID_KEY, bettingID);
    return bettingID;
  }

  /**
   * 베팅 열기
   */
  static async openBetting(sessionId: string, info: any): Promise<void> {
    const bettingID = info.id;
    const bettingStor = KVStorage.getStorage(`betting:${sessionId}`);
    await bettingStor.setValue(`id_${bettingID}`, info);
    logger.info('[Betting] Betting opened', { sessionId, bettingID });
  }

  private sessionId: string;

  constructor(sessionId: string, bettingID: number) {
    this.sessionId = sessionId;
    this.bettingID = bettingID;
  }

  /**
   * 베팅 정보 로드
   */
  async loadInfo(): Promise<void> {
    const bettingStor = KVStorage.getStorage(`betting:${this.sessionId}`);
    const rawBettingInfo = await bettingStor.getValue(`id_${this.bettingID}`);
    if (rawBettingInfo === null || rawBettingInfo === undefined) {
      throw new Error(`해당 베팅이 없습니다: ${this.bettingID}`);
    }
    this.info = rawBettingInfo;
  }

  /**
   * 베팅 키 변환 (내부)
   */
  private convertBettingKeyInternal(bettingType: number[]): string {
    return JSON.stringify(bettingType.sort((a, b) => a - b));
  }

  /**
   * 베팅 키 정제
   */
  public purifyBettingKey(bettingType: number[], noValidate: boolean = false): number[] {
    const selectCnt = this.info.selectCnt;
    const sorted = [...bettingType].sort((a, b) => a - b);
    const unique = Array.from(new Set(sorted));
    
    if (unique.length !== selectCnt) {
      throw new Error('중복된 값이 있습니다.');
    }

    if (!noValidate) {
      for (const key of unique) {
        if (!(key in this.info.candidates)) {
          throw new Error('올바른 후보가 아닙니다.');
        }
      }
    }

    return unique;
  }

  /**
   * 베팅 종료
   */
  public async closeBetting(): Promise<void> {
    await this.loadInfo();
    const bettingID = this.info.id;
    const gameStor = KVStorage.getStorage(`game_env:${this.sessionId}`);
    const year = await gameStor.getValue('year') || 184;
    const month = await gameStor.getValue('month') || 1;
    this.info.closeYearMonth = Util.joinYearMonth(year, month);
    const bettingStor = KVStorage.getStorage(`betting:${this.sessionId}`);
    await bettingStor.setValue(`id_${bettingID}`, this.info);
    logger.info('[Betting] Betting closed', { sessionId: this.sessionId, bettingID });
  }

  /**
   * 베팅 키 변환 (공개)
   */
  public convertBettingKey(bettingType: number[]): string {
    const purified = this.purifyBettingKey(bettingType);
    return this.convertBettingKeyInternal(purified);
  }

  /**
   * 베팅 정보 가져오기
   */
  public getInfo(): any {
    return this.info;
  }

  /**
   * 베팅하기
   */
  public async bet(generalID: number, userID: number | null, bettingType: number[], amount: number): Promise<void> {
    await this.loadInfo();
    const bettingInfo = this.info;

    if (bettingInfo.finished) {
      throw new Error('이미 종료된 베팅입니다');
    }

    const gameStor = KVStorage.getStorage(`game_env:${this.sessionId}`);
    const year = await gameStor.getValue('year') || 184;
    const month = await gameStor.getValue('month') || 1;
    const yearMonth = Util.joinYearMonth(year, month);

    if (bettingInfo.closeYearMonth && bettingInfo.closeYearMonth <= yearMonth) {
      throw new Error('이미 마감된 베팅입니다');
    }

    if (bettingInfo.openYearMonth && bettingInfo.openYearMonth > yearMonth) {
      throw new Error('아직 시작되지 않은 베팅입니다');
    }

    if (bettingType.length !== bettingInfo.selectCnt) {
      throw new Error('필요한 선택 수를 채우지 못했습니다.');
    }

    const resKey = this.info.reqInheritancePoint ? '유산포인트' : '금';
    const bettingTypeKey = this.convertBettingKey(bettingType);

    // 이전 베팅 금액 확인
    const prevBettings = await NgBetting.find({
      session_id: this.sessionId,
      'data.betting_id': this.bettingID,
      'data.user_id': userID
    }).lean();

    const prevBetAmount = prevBettings.reduce((sum: number, bet: any) => {
      return sum + (bet.data?.amount || 0);
    }, 0);

    if (prevBetAmount + amount > 1000) {
      throw new Error(`${1000 - prevBetAmount}${resKey}까지만 베팅 가능합니다.`);
    }

    // 자원 확인 및 차감
    if (bettingInfo.reqInheritancePoint) {
      if (!userID) {
        throw new Error('유산포인트 베팅은 사용자 ID가 필요합니다.');
      }
      const inheritStor = KVStorage.getStorage(`inheritance_${userID}:${this.sessionId}`);
      const previousPoints = await inheritStor.getValue('previous') || [0, null];
      const remainPoint = previousPoints[0] || 0;
      
      if (remainPoint < amount) {
        throw new Error('유산포인트가 충분하지 않습니다.');
      }

      // 유산포인트 차감
      await inheritStor.setValue('previous', [remainPoint - amount, previousPoints[1]]);
    } else {
      // 금 확인 및 차감
      const general = await General.findOne({
        session_id: this.sessionId,
        no: generalID
      });

      if (!general) {
        throw new Error('장수를 찾을 수 없습니다.');
      }

      const gold = general.data?.gold || 0;
      const minGoldRequired = GameConst.minGoldRequiredWhenBetting || 0;

      if (gold < minGoldRequired + amount) {
        throw new Error('금이 부족합니다.');
      }

      // 금 차감
      general.data = general.data || {};
      general.data.gold = gold - amount;
      general.markModified('data');
      await general.save();
    }

    // 베팅 기록 저장 (upsert)
    const bettingItem = await NgBetting.findOne({
      session_id: this.sessionId,
      'data.betting_id': this.bettingID,
      'data.general_id': generalID,
      'data.user_id': userID,
      'data.betting_type': bettingTypeKey
    });

    if (bettingItem) {
      // 기존 베팅 업데이트
      bettingItem.data = bettingItem.data || {};
      bettingItem.data.amount = (bettingItem.data.amount || 0) + amount;
      bettingItem.markModified('data');
      await bettingItem.save();
    } else {
      // 새 베팅 생성
      await NgBetting.create({
        session_id: this.sessionId,
        data: {
          betting_id: this.bettingID,
          general_id: generalID,
          user_id: userID,
          betting_type: bettingTypeKey,
          amount: amount
        }
      });
    }

    logger.info('[Betting] Bet placed', {
      sessionId: this.sessionId,
      bettingID: this.bettingID,
      generalID,
      userID,
      amount,
      bettingType: bettingTypeKey
    });
  }

  /**
   * 보상 계산 (단일 선택)
   */
  private async calcRewardExclusive(bettingType: number[]): Promise<Array<{
    generalID: number;
    userID: number | null;
    amount: number;
    matchPoint: number;
  }>> {
    const bettingTypeKey = this.convertBettingKey(bettingType);
    
    // 전체 베팅 금액 계산
    const allBettings = await NgBetting.find({
      session_id: this.sessionId,
      'data.betting_id': this.bettingID
    }).lean();

    const totalAmount = allBettings.reduce((sum: number, bet: any) => {
      return sum + (bet.data?.amount || 0);
    }, 0);

    if (totalAmount === 0) {
      return [];
    }

    // 당첨자 목록
    const winnerBettings = allBettings.filter((bet: any) => {
      return bet.data?.betting_type === bettingTypeKey && bet.data?.general_id > 0;
    });

    const subAmount = winnerBettings.reduce((sum: number, bet: any) => {
      return sum + (bet.data?.amount || 0);
    }, 0);

    if (subAmount === 0) {
      // 당첨자가 없으면 무효 (환불 리스트는 반환하지 않음)
      return [];
    }

    const multiplier = totalAmount / subAmount;
    const selectCnt = this.info.selectCnt;

    const result = winnerBettings.map((bet: any) => ({
      generalID: bet.data?.general_id || 0,
      userID: bet.data?.user_id || null,
      amount: Math.round((bet.data?.amount || 0) * multiplier),
      matchPoint: selectCnt
    }));

    return result;
  }

  /**
   * 보상 계산
   */
  public async calcReward(winnerType: number[]): Promise<Array<{
    generalID: number;
    userID: number | null;
    amount: number;
    matchPoint: number;
  }>> {
    const selectCnt = this.info.selectCnt;
    
    if (selectCnt === 1) {
      return await this.calcRewardExclusive(winnerType);
    }

    if (this.info.isExclusive) {
      return await this.calcRewardExclusive(winnerType);
    }

    // 복합 보상 계산 로직 (2개 이상 선택, 부분 당첨 지원)
    const winnerTypeMap: Record<number, boolean> = {};
    for (const typeVal of winnerType) {
      winnerTypeMap[typeVal] = true;
    }

    const calcMatchPoint = (bettingType: number[]): number => {
      let result = 0;
      for (const typeVal of bettingType) {
        if (winnerTypeMap[typeVal]) {
          result += 1;
        }
      }
      return result;
    };

    const allBettings = await NgBetting.find({
      session_id: this.sessionId,
      'data.betting_id': this.bettingID
    }).lean();

    let totalAmount = 0;
    const subAmount: Record<number, number> = {};
    const subWinners: Record<number, Array<{
      generalID: number;
      userID: number | null;
      amount: number;
      matchPoint: number;
    }>> = {};

    // 초기화
    for (let matchPoint = 0; matchPoint <= selectCnt; matchPoint++) {
      subAmount[matchPoint] = 0;
      subWinners[matchPoint] = [];
    }

    // 베팅별로 매치 포인트 계산 및 분류
    for (const bet of allBettings) {
      const bettingTypeKey = bet.data?.betting_type;
      if (!bettingTypeKey) continue;

      const bettingType = JSON.parse(bettingTypeKey);
      const matchPoint = calcMatchPoint(bettingType);
      const amount = bet.data?.amount || 0;
      
      totalAmount += amount;
      
      const generalID = bet.data?.general_id || 0;
      if (generalID === 0) continue;

      subAmount[matchPoint] += amount;
      subWinners[matchPoint].push({
        generalID,
        userID: bet.data?.user_id || null,
        amount,
        matchPoint
      });
    }

    // 보상 배분 계산 (높은 매치 포인트부터 절반씩)
    let remainRewardAmount = totalAmount;
    let accumulatedRewardAmount = 0;
    let givenRewardAmount = totalAmount;
    const rewardAmount: Record<number, number> = {};

    for (let matchPoint = selectCnt; matchPoint >= 0; matchPoint--) {
      givenRewardAmount /= 2;
      accumulatedRewardAmount += givenRewardAmount;
      
      if (subWinners[matchPoint].length === 0 || subAmount[matchPoint] === 0) {
        continue;
      }

      rewardAmount[matchPoint] = accumulatedRewardAmount;
      remainRewardAmount -= accumulatedRewardAmount;
      accumulatedRewardAmount = 0;
    }

    // 남은 상금은 최고 매치 포인트 그룹에게
    if (Object.keys(rewardAmount).length > 0) {
      for (let matchPoint = selectCnt; matchPoint >= 0; matchPoint--) {
        if (rewardAmount[matchPoint] !== undefined) {
          rewardAmount[matchPoint] += remainRewardAmount;
          break;
        }
      }
    }

    // 최종 보상 계산
    const result: Array<{
      generalID: number;
      userID: number | null;
      amount: number;
      matchPoint: number;
    }> = [];

    for (let matchPoint = selectCnt; matchPoint >= 0; matchPoint--) {
      if (rewardAmount[matchPoint] === undefined || rewardAmount[matchPoint] === 0) {
        continue;
      }

      const subReward = rewardAmount[matchPoint];
      const multiplier = subReward / subAmount[matchPoint];

      for (const subWinner of subWinners[matchPoint]) {
        result.push({
          generalID: subWinner.generalID,
          userID: subWinner.userID,
          amount: Math.round(subWinner.amount * multiplier),
          matchPoint: subWinner.matchPoint
        });
      }
    }

    return result;
  }

  /**
   * 보상 지급
   */
  public async giveReward(winnerType: number[]): Promise<void> {
    await this.loadInfo();
    const rewardList = await this.calcReward(winnerType);
    const selectCnt = this.info.selectCnt;

    const gameStor = KVStorage.getStorage(`game_env:${this.sessionId}`);
    const [year, month] = Util.splitYearMonth(this.info.openYearMonth || Util.joinYearMonth(180, 1));

    if (this.info.reqInheritancePoint) {
      // 유산포인트 보상
      for (const rewardItem of rewardList) {
        if (rewardItem.userID === null) continue;

        const userID = rewardItem.userID;
        const amount = rewardItem.amount;

        const inheritStor = KVStorage.getStorage(`inheritance_${userID}:${this.sessionId}`);
        const previousPoints = await inheritStor.getValue('previous') || [0, null];
        const previousPoint = previousPoints[0] || 0;
        const nextPoint = previousPoint + amount;

        await inheritStor.setValue('previous', [nextPoint, previousPoints[1]]);

        // FUTURE: UserLogger 사용 (로그 기록)
        logger.info('[Betting] Inheritance point reward given', {
          sessionId: this.sessionId,
          userID,
          generalID: rewardItem.generalID,
          amount,
          previousPoint,
          nextPoint
        });
      }
    } else {
      // 금 보상
      const generalIds = [...new Set(rewardList.map(r => r.generalID))];
      const generals = await General.find({
        session_id: this.sessionId,
        no: { $in: generalIds }
      });

      const generalMap: Record<number, any> = {};
      for (const general of generals) {
        generalMap[general.no] = general;
      }

      for (const rewardItem of rewardList) {
        const general = generalMap[rewardItem.generalID];
        if (!general) continue;

        const reward = Util.round(rewardItem.amount);
        const matchPoint = rewardItem.matchPoint;

        // 금 증가
        general.data = general.data || {};
        general.data.gold = (general.data.gold || 0) + reward;
        general.markModified('data');

        // 로그 기록
        const partialText = matchPoint === selectCnt
          ? '베팅 당첨'
          : `베팅 부분 당첨(${matchPoint}/${selectCnt})`;
        const rewardText = reward.toLocaleString();
        const logMessage = `<C>${this.info.name}</>의 ${partialText} 보상으로 <C>${rewardText}</>의 <S>금</> 획득!`;

        // GeneralRecord에 로그 저장
        await GeneralRecord.create({
          session_id: this.sessionId,
          data: {
            general_id: general.no,
            log_type: 'action',
            text: logMessage,
            year,
            month
          }
        });
      }

      // 모든 장수 저장
      for (const general of generals) {
        await general.save();
      }
    }

    // 베팅 정보 업데이트
    this.info.finished = true;
    this.info.winner = winnerType;
    const bettingStor = KVStorage.getStorage(`betting:${this.sessionId}`);
    await bettingStor.setValue(`id_${this.bettingID}`, this.info);

    logger.info('[Betting] Rewards given', {
      sessionId: this.sessionId,
      bettingID: this.bettingID,
      winnerType,
      rewardCount: rewardList.length
    });
  }
}

