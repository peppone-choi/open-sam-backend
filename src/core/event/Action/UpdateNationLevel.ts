// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { Util } from '../../../utils/Util';
import { saveNation, saveGeneral } from '../../../common/cache/model-cache.helper';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('UpdateNationLevel');

/**
 * 국가 레벨(작위) 테이블
 * 0: 방랑군, 1: 호족, 2: 방백, 3: 주자사, 4: 주목, 5: 승상, 6: 공, 7: 왕, 8: 황제
 */
const NATION_LEVEL_BY_CITY_COUNT = [
  0,  // 방랑군 (0개 도시)
  1,  // 호족 (1개 도시)
  2,  // 방백 (2개 도시)
  5,  // 주자사 (5개 도시)
  8,  // 주목 (8개 도시)
  11, // 공 (11개 도시)
  16, // 왕 (16개 도시)
  21, // 황제 (21개 도시)
];

/**
 * 국가 레벨 텍스트 반환
 */
function getNationLevel(level: number): string {
  const levels = ['방랑군', '호족', '방백', '주자사', '주목', '승상', '공', '왕', '황제'];
  return levels[level] || '방랑군';
}

/**
 * 국가 수석 레벨 반환 (최소 관직 레벨)
 */
function getNationChiefLevel(nationLevel: number): number {
  // 작위가 높을수록 더 많은 관직 슬롯 사용 가능
  if (nationLevel >= 7) return 5;  // 황제
  if (nationLevel >= 6) return 6;  // 왕
  if (nationLevel >= 5) return 7;  // 공
  if (nationLevel >= 4) return 8;  // 주목
  if (nationLevel >= 3) return 9;  // 주자사
  if (nationLevel >= 2) return 10; // 방백
  return 11; // 호족
}

/**
 * 조사 선택 유틸리티 (JosaUtil.pick 대체)
 */
function pickJosa(word: string, josas: string): string {
  if (!word) return josas.split('/')[0] || '';
  const lastChar = word.charCodeAt(word.length - 1);
  
  // 한글 범위 체크
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
    return josas.split('/')[0] || '';
  }
  
  const hasFinalConsonant = (lastChar - 0xAC00) % 28 !== 0;
  const josaParts = josas.split('/');
  
  return hasFinalConsonant ? josaParts[0] : (josaParts[1] || josaParts[0]);
}

/**
 * 국가 레벨(작위) 업데이트 액션
 * - 도시 수에 따른 작위 변경
 * - 호족 → 방백 → 주자사 → 주목 → 승상 → 공 → 왕 → 황제
 * - 레벨업 시 보상 지급
 */
export class UpdateNationLevel extends Action {
  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;
    const startYear = env['startyear'] || 184;

    logger.info('[UpdateNationLevel] 국가 레벨 업데이트 시작', { sessionId, year, month });

    // 1. 국가별 도시 수 집계 (레벨 4 이상 도시만)
    const cities = await City.find({ session_id: sessionId });
    const nationCityCounts: Record<number, number> = {};
    
    for (const city of cities) {
      const nationId = city.nation || 0;
      if (nationId === 0) continue;
      
      const cityLevel = city.level || 0;
      if (cityLevel >= 4) {
        nationCityCounts[nationId] = (nationCityCounts[nationId] || 0) + 1;
      }
    }

    // 2. 국가 목록 조회
    const nations = await Nation.find({ session_id: sessionId });
    let levelUpCount = 0;

    for (const nation of nations) {
      const nationId = nation.nation || 0;
      const cityCnt = nationCityCounts[nationId] || 0;
      const currentLevel = nation.data?.level || 0;

      // 3. 도시 수에 따른 새 레벨 계산
      let newLevel = 0;
      for (let i = NATION_LEVEL_BY_CITY_COUNT.length - 1; i >= 0; i--) {
        if (cityCnt >= NATION_LEVEL_BY_CITY_COUNT[i]) {
          newLevel = i;
          break;
        }
      }

      // 4. 레벨업 처리
      if (newLevel > currentLevel) {
        const levelDiff = newLevel - currentLevel;
        const oldLevel = currentLevel;

        // 보상 지급 (작위 * 1000 금/쌀)
        const goldBonus = newLevel * 1000;
        const riceBonus = newLevel * 1000;

        nation.data = nation.data || {};
        nation.data.level = newLevel;
        nation.data.gold = (nation.data.gold || 0) + goldBonus;
        nation.data.rice = (nation.data.rice || 0) + riceBonus;

        // 군주 이름 조회
        const lord = await General.findOne({
          session_id: sessionId,
          nation: nationId,
          'data.officer_level': 12
        });
        const lordName = lord?.data?.name || '군주';
        const nationName = nation.data?.name || `국가 ${nationId}`;

        const oldNationLevelText = getNationLevel(oldLevel);
        const nationLevelText = getNationLevel(newLevel);

        // 5. 히스토리 로그 기록
        const actionLogger = new ActionLogger(0, nationId, year, month);
        const josaYi = pickJosa(lordName, '이/가');
        const josaRo = pickJosa(nationLevelText, '로/으로');

        switch (newLevel) {
          case 7: // 황제
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><D><b>${nationName}</b></> ${oldNationLevelText} <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo} 옹립되었습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<D><b>${nationName}</b></> ${oldNationLevelText} <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo} 옹립`
            );
            // 황제 등극 시 국기/국호 변경 허용
            nation.data.aux = nation.data.aux || {};
            nation.data.aux['can_국기변경'] = 1;
            nation.data.aux['can_국호변경'] = 1;
            break;

          case 6: // 왕
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo} 책봉되었습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo} 책봉`
            );
            break;

          case 5: // 공
          case 4: // 주목
          case 3: // 주자사
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo} 임명되었습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo} 임명됨`
            );
            break;

          case 2: // 방백
            const josaRa = pickJosa(nationName, '라는/는');
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><Y>${lordName}</>${josaYi} 독립하여 <D><b>${nationName}</b></>${josaRa} <C>${nationLevelText}</>${josaRo} 나섰습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<Y>${lordName}</>${josaYi} 독립하여 <D><b>${nationName}</b></>${josaRa} <C>${nationLevelText}</>${josaRo} 나서다`
            );
            break;
        }

        await actionLogger.flush();
        await saveNation(sessionId, nationId, nation.toObject());

        // 6. 국가 턴 슬롯 추가 (새 관직용)
        // nation_turn 테이블에 새 관직 턴 추가
        const maxChiefTurn = 12; // GameConst.$maxChiefTurn
        const chiefLevel = getNationChiefLevel(newLevel);

        logger.info('[UpdateNationLevel] 국가 레벨업', {
          nationId,
          nationName,
          oldLevel,
          newLevel,
          levelDiff,
          cityCnt,
          goldBonus,
          riceBonus
        });

        // 7. 레벨업 보상 - 유니크 아이템 지급 (간소화)
        if (levelDiff > 0 && lord) {
          // 군주에게 통일자 포인트 지급
          const inheritanceBonus = 250 * levelDiff;
          lord.data = lord.data || {};
          lord.data.inheritance_point = (lord.data.inheritance_point || 0) + inheritanceBonus;
          await saveGeneral(sessionId, lord.no || lord.data?.no, lord.toObject());

          logger.info('[UpdateNationLevel] 군주 통일자 포인트 지급', {
            lordName,
            inheritanceBonus,
            totalPoints: lord.data.inheritance_point
          });
        }

        levelUpCount++;
      }
    }

    logger.info('[UpdateNationLevel] 국가 레벨 업데이트 완료', {
      sessionId,
      levelUpCount,
      totalNations: nations.length
    });

    return [UpdateNationLevel.name, levelUpCount];
  }
}


