/**
 * ClassConversionService - 정치가/군인 전환 시스템
 * 매뉴얼 500-503행 기반 구현
 *
 * 기능:
 * - 군인 → 정치가 전환
 * - 정치가 → 군인 전환
 * - 전환 조건 검증
 * - 계급 래더 이동
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

export enum CharacterClass {
  MILITARY = 'military',     // 군인
  POLITICIAN = 'politician', // 정치가
}

export interface ClassConversionRequest {
  sessionId: string;
  characterId: string;
  targetClass: CharacterClass;
  requestedBy: string; // 요청자 (본인 또는 상관)
}

export interface ClassConversionResult {
  success: boolean;
  previousClass?: CharacterClass;
  newClass?: CharacterClass;
  previousRank?: string;
  newRank?: string;
  error?: string;
}

// ============================================================
// 계급 매핑 테이블
// ============================================================

// 제국 군인 계급
const EMPIRE_MILITARY_RANKS = [
  '이등병', '일등병', '상등병', '병장',
  '하사', '중사', '상사', '원사',
  '소위', '중위', '대위',
  '소령', '중령', '대령',
  '준장', '소장', '중장', '대장', '원수',
];

// 제국 정치가 계급
const EMPIRE_POLITICIAN_RANKS = [
  '견습사무관', '사무관', '주사',
  '참사관', '이사관', '국장',
  '차관', '장관', '재상',
];

// 동맹 군인 계급
const ALLIANCE_MILITARY_RANKS = [
  '이등병', '일등병', '상등병', '병장',
  '하사', '중사', '상사', '원사',
  '소위', '중위', '대위',
  '소령', '중령', '대령',
  '준장', '소장', '중장', '대장', '원수',
];

// 동맹 정치가 계급
const ALLIANCE_POLITICIAN_RANKS = [
  '견습사무관', '사무관', '주사',
  '참사관', '이사관', '국장',
  '차관', '장관', '의장',
];

// 계급 간 대응 관계 (인덱스 기준)
const RANK_CONVERSION_MAP: Record<number, number> = {
  // 군인 인덱스 -> 정치가 인덱스
  0: 0, 1: 0, 2: 0, 3: 0,     // 이등병~병장 -> 견습사무관
  4: 1, 5: 1, 6: 1, 7: 1,     // 하사~원사 -> 사무관
  8: 2, 9: 2, 10: 2,          // 소위~대위 -> 주사
  11: 3, 12: 3, 13: 3,        // 소령~대령 -> 참사관
  14: 4, 15: 5,               // 준장 -> 이사관, 소장 -> 국장
  16: 6, 17: 7, 18: 8,        // 중장 -> 차관, 대장 -> 장관, 원수 -> 재상
};

// ============================================================
// ClassConversionService Class
// ============================================================

export class ClassConversionService extends EventEmitter {
  private static instance: ClassConversionService;

  private constructor() {
    super();
    logger.info('[ClassConversionService] Initialized');
  }

  public static getInstance(): ClassConversionService {
    if (!ClassConversionService.instance) {
      ClassConversionService.instance = new ClassConversionService();
    }
    return ClassConversionService.instance;
  }

  // ============================================================
  // 전환 조건 확인
  // ============================================================

  /**
   * 전환 가능 여부 확인
   */
  public async canConvert(
    sessionId: string,
    characterId: string,
    targetClass: CharacterClass,
  ): Promise<{ canConvert: boolean; reason?: string }> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { canConvert: false, reason: '캐릭터를 찾을 수 없습니다.' };
    }

    // 현재 분류 확인
    const currentClass = character.characterClass as CharacterClass;
    if (currentClass === targetClass) {
      return { canConvert: false, reason: '이미 해당 분류입니다.' };
    }

    // 직무 권한 카드 확인 (직위가 있으면 전환 불가)
    if (character.commandCards && character.commandCards.length > 0) {
      return { canConvert: false, reason: '직위를 보유한 상태에서는 전환할 수 없습니다.' };
    }

    // 전술전 참가 중인지 확인 (전투 중일 때는 status가 보통 ACTIVE지만 플래그로 체크)
    // @ts-ignore - 전투 중 상태는 별도 플래그로 처리
    if ((character as any).inBattle === true) {
      return { canConvert: false, reason: '전투 중에는 전환할 수 없습니다.' };
    }

    // 작전 참가 중인지 확인
    // TODO: OperationService와 연동

    return { canConvert: true };
  }

  // ============================================================
  // 분류 전환
  // ============================================================

  /**
   * 분류 전환 실행
   * 매뉴얼: "전역하여 정치가로 전환" 또는 "입대하여 군인으로 전환"
   */
  public async convertClass(request: ClassConversionRequest): Promise<ClassConversionResult> {
    const { sessionId, characterId, targetClass, requestedBy } = request;

    // 1. 전환 가능 여부 확인
    const canConvertResult = await this.canConvert(sessionId, characterId, targetClass);
    if (!canConvertResult.canConvert) {
      return { success: false, error: canConvertResult.reason };
    }

    // 2. 캐릭터 조회
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    const previousClass = character.characterClass as CharacterClass;
    const previousRank = character.rank;

    // 3. 새 계급 계산
    const newRank = this.calculateNewRank(character.factionId, previousRank, targetClass);
    if (!newRank) {
      return { success: false, error: '계급 변환에 실패했습니다.' };
    }

    // 4. 분류 및 계급 변경
    character.characterClass = targetClass as any;
    character.rank = newRank;
    
    // 5. 공적 초기화 (전환 시 계급 래더 최하위로)
    character.merit = 0;
    
    await character.save();

    // 6. 이벤트 발생
    this.emit('class:converted', {
      sessionId,
      characterId,
      characterName: character.name,
      previousClass,
      newClass: targetClass,
      previousRank,
      newRank,
      requestedBy,
    });

    logger.info(`[ClassConversionService] ${character.name}: ${previousClass}(${previousRank}) -> ${targetClass}(${newRank})`);

    return {
      success: true,
      previousClass,
      newClass: targetClass,
      previousRank,
      newRank,
    };
  }

  /**
   * 새 계급 계산
   */
  private calculateNewRank(
    factionId: string,
    currentRank: string,
    targetClass: CharacterClass,
  ): string | null {
    const isEmpire = factionId === 'EMPIRE' || factionId.toLowerCase().includes('empire');
    
    // 현재 계급 인덱스 찾기
    let currentIndex: number;
    let currentRanks: string[];
    let targetRanks: string[];

    if (targetClass === CharacterClass.POLITICIAN) {
      // 군인 -> 정치가
      currentRanks = isEmpire ? EMPIRE_MILITARY_RANKS : ALLIANCE_MILITARY_RANKS;
      targetRanks = isEmpire ? EMPIRE_POLITICIAN_RANKS : ALLIANCE_POLITICIAN_RANKS;
    } else {
      // 정치가 -> 군인
      currentRanks = isEmpire ? EMPIRE_POLITICIAN_RANKS : ALLIANCE_POLITICIAN_RANKS;
      targetRanks = isEmpire ? EMPIRE_MILITARY_RANKS : ALLIANCE_MILITARY_RANKS;
    }

    currentIndex = currentRanks.indexOf(currentRank);
    if (currentIndex === -1) {
      // 계급을 찾을 수 없으면 최하위로
      return targetRanks[0];
    }

    // 대응되는 계급 찾기
    if (targetClass === CharacterClass.POLITICIAN) {
      // 군인 -> 정치가 변환
      const targetIndex = RANK_CONVERSION_MAP[currentIndex] ?? 0;
      return targetRanks[targetIndex] || targetRanks[0];
    } else {
      // 정치가 -> 군인 변환 (역방향)
      // 역매핑 찾기
      for (const [milIndex, polIndex] of Object.entries(RANK_CONVERSION_MAP)) {
        if (polIndex === currentIndex) {
          return targetRanks[parseInt(milIndex)] || targetRanks[0];
        }
      }
      return targetRanks[0];
    }
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 캐릭터 분류 조회
   */
  public async getCharacterClass(
    sessionId: string,
    characterId: string,
  ): Promise<CharacterClass | null> {
    const character = await Gin7Character.findOne({ sessionId, characterId }).lean();
    return character?.characterClass as CharacterClass || null;
  }

  /**
   * 전환 시 예상 계급 조회
   */
  public async getExpectedRank(
    sessionId: string,
    characterId: string,
    targetClass: CharacterClass,
  ): Promise<string | null> {
    const character = await Gin7Character.findOne({ sessionId, characterId }).lean();
    if (!character) return null;

    return this.calculateNewRank(character.factionId, character.rank, targetClass);
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    logger.info(`[ClassConversionService] Cleaned up session: ${sessionId}`);
  }
}

export const classConversionService = ClassConversionService.getInstance();
export default ClassConversionService;





