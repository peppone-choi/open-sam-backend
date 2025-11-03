import { DB } from '../../config/db';
import { General } from '../../models/General';
import { Util } from '../../utils/Util';
import { GameConst } from '../../const/GameConst';
import { InheritanceKey } from '../../Enums/InheritanceKey';

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
  static async genNextBettingID(): Promise<number> {
    const db = DB.db();
    // TODO: KVStorage 구현
    // const gameStor = KVStorage.getStorage(db, 'game_env');
    // gameStor.invalidateCacheValue(this.LAST_BETTING_ID_KEY);
    // const bettingID = (gameStor.getValue(this.LAST_BETTING_ID_KEY) ?? 0) + 1;
    // gameStor.setValue(this.LAST_BETTING_ID_KEY, bettingID);
    
    // 임시 구현
    return 1;
  }

  /**
   * 베팅 열기
   */
  static async openBetting(info: any): Promise<void> {
    const db = DB.db();
    const bettingID = info.id;
    // TODO: KVStorage 구현
    // const bettingStor = KVStorage.getStorage(db, 'betting');
    // bettingStor.setValue(`id_${bettingID}`, info.toArray());
  }

  constructor(bettingID: number) {
    this.bettingID = bettingID;
    // TODO: DB에서 베팅 정보 로드
    // const bettingStor = KVStorage.getStorage(db, 'betting');
    // const rawBettingInfo = bettingStor.getValue(`id_${bettingID}`);
    // if (rawBettingInfo === null) {
    //   throw new Error(`해당 베팅이 없습니다: ${bettingID}`);
    // }
    // this.info = BettingInfo.fromArray(rawBettingInfo);
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
    const db = DB.db();
    const bettingID = this.info.id;
    // TODO: KVStorage 구현
    // const gameStor = KVStorage.getStorage(db, 'game_env');
    // const [year, month] = gameStor.getValuesAsArray(['year', 'month']);
    // this.info.closeYearMonth = Util.joinYearMonth(year, month);
    // const bettingStor = KVStorage.getStorage(db, 'betting');
    // bettingStor.setValue(`id_${bettingID}`, this.info.toArray());
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
    const bettingInfo = this.info;

    if (bettingInfo.finished) {
      throw new Error('이미 종료된 베팅입니다');
    }

    const db = DB.db();
    // TODO: KVStorage 구현
    // const gameStor = KVStorage.getStorage(db, 'game_env');
    // const [year, month] = gameStor.getValuesAsArray(['year', 'month']);
    // const yearMonth = Util.joinYearMonth(year, month);

    // if (bettingInfo.closeYearMonth <= yearMonth) {
    //   throw new Error('이미 마감된 베팅입니다');
    // }

    // if (bettingInfo.openYearMonth > yearMonth) {
    //   throw new Error('아직 시작되지 않은 베팅입니다');
    // }

    if (bettingType.length !== bettingInfo.selectCnt) {
      throw new Error('필요한 선택 수를 채우지 못했습니다.');
    }

    const resKey = this.info.reqInheritancePoint ? '유산포인트' : '금';
    const bettingTypeKey = this.convertBettingKeyInternal(this.purifyBettingKey(bettingType));

    // TODO: 이전 베팅 금액 확인
    // const prevBetAmount = await db.queryFirstField(
    //   'SELECT sum(amount) FROM ng_betting WHERE betting_id = ? AND user_id = ?',
    //   [this.bettingID, userID]
    // ) ?? 0;

    // if (prevBetAmount + amount > 1000) {
    //   throw new Error(`${1000 - prevBetAmount}${resKey}까지만 베팅 가능합니다.`);
    // }

    // TODO: 자원 확인 및 차감 로직
    // TODO: 베팅 기록 저장
  }

  /**
   * 보상 계산 (단일 선택)
   */
  private calcRewardExclusive(bettingType: number[]): Array<{
    generalID: number;
    userID: number | null;
    amount: number;
    matchPoint: number;
  }> {
    const db = DB.db();
    // TODO: 구현
    // const totalAmount = await db.queryFirstField(
    //   'SELECT sum(amount) FROM ng_betting WHERE betting_id = ?',
    //   [this.bettingID]
    // );

    // if (totalAmount === 0) {
    //   return [];
    // }

    // const winnerList = await db.queryAllLists(
    //   'SELECT general_id, user_id, amount FROM ng_betting WHERE betting_id = ? AND betting_type = ? AND general_id > 0',
    //   [this.bettingID, this.convertBettingKey(bettingType)]
    // );

    // TODO: 배당 계산 로직

    return [];
  }

  /**
   * 보상 계산
   */
  public calcReward(winnerType: number[]): Array<{
    generalID: number;
    userID: number | null;
    amount: number;
    matchPoint: number;
  }> {
    const selectCnt = this.info.selectCnt;
    
    if (selectCnt === 1) {
      return this.calcRewardExclusive(winnerType);
    }

    if (this.info.isExclusive) {
      return this.calcRewardExclusive(winnerType);
    }

    // TODO: 복합 보상 계산 로직 (2개 이상 선택, 부분 당첨 지원)

    return [];
  }

  /**
   * 보상 지급
   */
  public async giveReward(winnerType: number[]): Promise<void> {
    const rewardList = this.calcReward(winnerType);
    const selectCnt = this.info.selectCnt;

    const db = DB.db();

    // TODO: 보상 지급 로직 구현
    // if (this.info.reqInheritancePoint) {
    //   // 유산포인트 보상
    // } else {
    //   // 금 보상
    // }

    this.info.finished = true;
    this.info.winner = winnerType;
    // TODO: KVStorage에 저장
  }
}

