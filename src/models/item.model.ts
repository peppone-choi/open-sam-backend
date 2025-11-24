/**
 * BaseItem - PHP sammo\BaseItem 직접 변환
 * 
 * 모든 아이템의 기본 추상 클래스
 * 참고: core/hwe/sammo/BaseItem.php
 */

import type { IGeneral } from './general.model';
import type { RandUtil } from '../utils/RandUtil';

/**
 * 아이템 소비 결과
 */
export interface ItemConsumeResult {
  success: boolean;
  message?: string;
  effects?: Record<string, any>;
}

/**
 * BaseItem 추상 클래스
 * PHP의 BaseItem 및 iAction 인터페이스 구현
 */
export abstract class BaseItem {
  protected rawName: string = '-';
  protected name: string = '-';
  protected info: string = '';
  protected cost: number | null = null;
  protected consumable: boolean = false;
  protected buyable: boolean = false;
  protected reqSecu: number = 0;

  /**
   * 아이템의 원본 이름 반환
   */
  getRawName(): string {
    return this.rawName;
  }

  /**
   * 아이템의 표시 이름 반환
   */
  getName(): string {
    return this.name;
  }

  /**
   * 아이템의 설명 반환
   */
  getInfo(): string {
    return this.info;
  }

  /**
   * 아이템 클래스명 반환
   */
  getRawClassName(shortName: boolean = true): string {
    if (shortName) {
      return this.constructor.name;
    }
    return this.constructor.name;
  }

  /**
   * 아이템 가격 반환
   */
  getCost(): number | null {
    return this.cost;
  }

  /**
   * 소모품 여부 반환
   */
  isConsumable(): boolean {
    return this.consumable;
  }

  /**
   * 구매 가능 여부 반환
   */
  isBuyable(): boolean {
    return this.buyable;
  }

  /**
   * 필요 치안도 반환
   */
  getReqSecu(): number {
    return this.reqSecu;
  }

  /**
   * 아이템 소비 가능 여부 확인
   * @param general 장수 객체
   * @returns 소비 가능하면 true
   */
  canConsume(general: IGeneral): boolean {
    return false;
  }

  /**
   * 아이템 소비 실행
   * @param general 장수 객체
   * @returns 소비 결과
   */
  consume(general: IGeneral): ItemConsumeResult {
    return {
      success: false,
      message: '이 아이템은 소비할 수 없습니다.'
    };
  }

  /**
   * 특정 액션 타입과 커맨드에서 아이템을 즉시 소비할지 결정
   * @param general 장수 객체
   * @param actionType 액션 타입 (예: 'GeneralTrigger', '장비매매')
   * @param command 커맨드 이름
   * @returns true면 아이템이 소비됨 (제거됨)
   */
  tryConsumeNow(general: IGeneral, actionType: string, command: string): boolean {
    return false;
  }

  /**
   * 내정 수치 계산 시 호출 (예: 계략 성공률, 훈련 효과 등)
   * @param turnType 턴 타입 (예: '계략', '훈련')
   * @param varType 변수 타입 (예: 'success', 'rate')
   * @param value 현재 값
   * @param aux 추가 데이터
   * @returns 수정된 값
   */
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return value;
  }

  /**
   * 장수 스탯 계산 시 호출
   * @param general 장수 객체
   * @param statName 스탯 이름 (예: 'leadership', 'strength', 'intel')
   * @param value 현재 값
   * @param aux 추가 데이터
   * @returns 수정된 값
   */
  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    return value;
  }

  /**
   * 적 스탯 계산 시 호출 (디버프 효과 등)
   * @param general 장수 객체
   * @param statName 스탯 이름
   * @param value 현재 값
   * @param aux 추가 데이터
   * @returns 수정된 값
   */
  onCalcOpposeStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    return value;
  }

  /**
   * 임의 액션 처리 (구매 시 등)
   * @param general 장수 객체
   * @param rng 랜덤 유틸
   * @param actionType 액션 타입
   * @param phase 페이즈 (예: '구매', '판매')
   * @param aux 추가 데이터
   * @returns 수정된 aux 또는 null
   */
  onArbitraryAction(
    general: IGeneral,
    rng: RandUtil,
    actionType: string,
    phase: string | null = null,
    aux: any = null
  ): any {
    return aux;
  }

  /**
   * 턴 실행 전 트리거 목록 반환
   * @param general 장수 객체
   * @returns 트리거 리스트 또는 null
   */
  getPreTurnExecuteTriggerList(general: IGeneral): any | null {
    return null;
  }

  /**
   * 전투 초기화 스킬 트리거 목록 반환
   * @param unit 전투 유닛
   * @returns 트리거 리스트 또는 null
   */
  getBattleInitSkillTriggerList(unit: any): any | null {
    return null;
  }

  /**
   * 전투 페이즈 스킬 트리거 목록 반환
   * @param unit 전투 유닛
   * @returns 트리거 리스트 또는 null
   */
  getBattlePhaseSkillTriggerList(unit: any): any | null {
    return null;
  }

  /**
   * 장수의 auxVar 가져오기 헬퍼
   */
  protected getAuxVar(general: IGeneral, key: string): any {
    return general.aux?.[key];
  }

  /**
   * 장수의 auxVar 설정 헬퍼
   */
  protected setAuxVar(general: IGeneral, key: string, value: any): void {
    if (!general.aux) {
      general.aux = {};
    }
    general.aux[key] = value;
    if (typeof general.markModified === 'function') {
      general.markModified('aux');
    }
  }
}
