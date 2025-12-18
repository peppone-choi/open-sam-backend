// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { NationTurn } from '../../../models/nation_turn.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { Util } from '../../../utils/Util';
import { JosaUtil } from '../../../utils/JosaUtil';
import { saveNation, saveGeneral } from '../../../common/cache/model-cache.helper';
import { RandUtil } from '../../../utils/rand-util';
import { LiteHashDRBG } from '../../../utils/LiteHashDRBG';
import { giveRandomUniqueItem } from '../../../utils/unique-item-lottery';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('UpdateNationLevel');

/**
 * PHP와 동일한 국가 레벨(작위) 테이블
 * 인덱스 = 레벨, 값 = 필요 도시 수
 * 0: 방랑군, 1: 호족, 2: 군벌, 3: 주자사, 4: 주목, 5: 공, 6: 왕, 7: 황제
 */
const NATION_LEVEL_BY_CITY_COUNT = [
  0,  // 방랑군 (0개 도시)
  1,  // 호족 (1개 도시)
  2,  // 군벌 (2개 도시)
  5,  // 주자사 (5개 도시)
  8,  // 주목 (8개 도시)
  11, // 공 (11개 도시)
  16, // 왕 (16개 도시)
  21, // 황제 (21개 도시)
];

/**
 * PHP와 동일한 국가 레벨 텍스트 반환
 */
function getNationLevel(level: number): string {
  const levels = ['방랑군', '호족', '군벌', '주자사', '주목', '공', '왕', '황제'];
  return levels[level] || '방랑군';
}

/**
 * PHP와 동일한 국가 수석 레벨 반환 (최소 관직 레벨)
 * getNationChiefLevel 함수와 동일
 */
function getNationChiefLevel(nationLevel: number): number {
  // PHP: sammo\getNationChiefLevel 함수와 동일
  // 작위가 높을수록 더 많은 관직 슬롯 사용 가능
  if (nationLevel >= 7) return 5;   // 황제: 5~12
  if (nationLevel >= 6) return 6;   // 왕: 6~12
  if (nationLevel >= 5) return 7;   // 공: 7~12
  if (nationLevel >= 4) return 8;   // 주목: 8~12
  if (nationLevel >= 3) return 9;   // 주자사: 9~12
  if (nationLevel >= 2) return 10;  // 군벌: 10~12
  return 11; // 호족: 11~12
}

// PHP GameConst와 동일한 상수
const MAX_CHIEF_TURN = 12; // GameConst::$maxChiefTurn

// PHP GameConst::$maxUniqueItemLimit와 동일
const MAX_UNIQUE_ITEM_LIMIT: [number, number][] = [
  [-1, 1],  // 기본 1개
  [3, 2],   // 3년 후 2개
  [5, 3],   // 5년 후 3개
];

/**
 * 국가 레벨(작위) 업데이트 액션
 * PHP UpdateNationLevel.php와 완전히 동일한 로직
 * 
 * - 도시 수에 따른 작위 변경
 * - 호족 → 군벌 → 주자사 → 주목 → 공 → 왕 → 황제
 * - 레벨업 시 보상 지급 (금/쌀)
 * - 유니크 아이템 추첨
 * - 국가 턴 슬롯 자동 생성
 */
export class UpdateNationLevel extends Action {
  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;
    const startYear = env['startyear'] || 184;
    const killTurn = env['killturn'] || 0;
    const turnTerm = env['turnterm'] || 10;

    logger.info('[UpdateNationLevel] 국가 레벨 업데이트 시작', { sessionId, year, month });

    // 1. 국가별 도시 수 집계 (레벨 4 이상 도시만 - PHP와 동일)
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
      const nationTech = nation.data?.tech || 0;
      const nationAux = nation.data?.aux || {};

      // 3. 도시 수에 따른 새 레벨 계산 (PHP와 동일한 로직)
      let newLevel = 0;
      for (let i = 0; i < NATION_LEVEL_BY_CITY_COUNT.length; i++) {
        if (cityCnt >= NATION_LEVEL_BY_CITY_COUNT[i]) {
          newLevel = i;
        } else {
          break;
        }
      }

      // 4. 레벨업 처리 (새 레벨이 현재보다 높을 때만)
      if (newLevel > currentLevel) {
        const levelDiff = newLevel - currentLevel;
        const oldLevel = currentLevel;

        // 보상 지급 (작위 * 1000 금/쌀 - PHP와 동일)
        const goldBonus = newLevel * 1000;
        const riceBonus = newLevel * 1000;

        nation.data = nation.data || {};
        nation.data.level = newLevel;
        nation.data.gold = (nation.data.gold || 0) + goldBonus;
        nation.data.rice = (nation.data.rice || 0) + riceBonus;

        // 군주 조회
        const lord = await General.findOne({
          session_id: sessionId,
          nation: nationId,
          'data.officer_level': 12
        });
        const lordName = lord?.data?.name || lord?.name || '군주';
        const nationName = nation.data?.name || nation.name || `국가 ${nationId}`;

        const oldNationLevelText = getNationLevel(oldLevel);
        const nationLevelText = getNationLevel(newLevel);

        // 5. 히스토리 로그 기록 (PHP와 동일한 포맷)
        const actionLogger = new ActionLogger(0, nationId, year, month, sessionId);
        const josaYi = JosaUtil.pick(lordName, '이');

        switch (newLevel) {
          case 7: // 황제
            const josaRo7 = JosaUtil.pick(nationLevelText, '로');
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><D><b>${nationName}</b></> ${oldNationLevelText} <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo7} 옹립되었습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<D><b>${nationName}</b></> ${oldNationLevelText} <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo7} 옹립`
            );
            // 황제 등극 시 국기/국호 변경 허용 (PHP와 동일)
            nation.data.aux = nation.data.aux || {};
            nation.data.aux['can_국기변경'] = 1;
            nation.data.aux['can_국호변경'] = 1;
            break;

          case 6: // 왕
            const josaRo6 = JosaUtil.pick(nationLevelText, '로');
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo6} 책봉되었습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo6} 책봉`
            );
            break;

          case 5: // 공
          case 4: // 주목
          case 3: // 주자사
            const josaRo345 = JosaUtil.pick(nationLevelText, '로');
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo345} 임명되었습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<D><b>${nationName}</b></>의 <Y>${lordName}</>${josaYi} <C>${nationLevelText}</>${josaRo345} 임명됨`
            );
            break;

          case 2: // 군벌
            const josaRa = JosaUtil.pick(nationName, '라');
            const josaRo2 = JosaUtil.pick(nationLevelText, '로');
            actionLogger.pushGlobalHistoryLog(
              `<Y><b>【작위】</b></><Y>${lordName}</>${josaYi} 독립하여 <D><b>${nationName}</b></>${josaRa}는 <C>${nationLevelText}</>${josaRo2} 나섰습니다.`
            );
            actionLogger.pushNationalHistoryLog(
              `<Y>${lordName}</>${josaYi} 독립하여 <D><b>${nationName}</b></>${josaRa}는 <C>${nationLevelText}</>${josaRo2} 나서다`
            );
            break;
        }

        await actionLogger.flush();

        // 6. 국가 저장
        await saveNation(sessionId, nationId, nation.toObject());

        // 7. 국가 턴 슬롯 추가 (PHP와 동일)
        // 새 관직 레벨에 대한 턴 슬롯 생성
        const chiefLevel = getNationChiefLevel(newLevel);
        const turnRows: any[] = [];

        for (let officerLevel = chiefLevel; officerLevel <= 12; officerLevel++) {
          for (let turnIdx = 0; turnIdx < MAX_CHIEF_TURN; turnIdx++) {
            turnRows.push({
              session_id: sessionId,
              data: {
                nation_id: nationId,
                officer_level: officerLevel,
                turn_idx: turnIdx,
                action: '휴식',
                arg: null,
                brief: '휴식'
              }
            });
          }
        }

        // insertIgnore 대신 upsert 사용
        for (const row of turnRows) {
          await NationTurn.findOneAndUpdate(
            {
              session_id: sessionId,
              'data.nation_id': nationId,
              'data.officer_level': row.data.officer_level,
              'data.turn_idx': row.data.turn_idx
            },
            { $setOnInsert: row },
            { upsert: true }
          );
        }

        logger.info('[UpdateNationLevel] 국가 턴 슬롯 생성', {
          nationId,
          chiefLevel,
          turnCount: turnRows.length
        });

        // 8. 유니크 아이템 추첨 (PHP와 동일)
        if (levelDiff > 0) {
          // 대상 킬턴 계산 (24시간 이내 활동한 장수)
          const targetKillTurn = killTurn - (24 * 60 / turnTerm);

          // 해당 국가의 활동 장수 조회 (npc < 2인 장수)
          const nationGenerals = await General.find({
            session_id: sessionId,
            nation: nationId,
            'data.npc': { $lt: 2 },
            'data.killturn': { $gte: targetKillTurn }
          });

          // 가중치 목록 생성 (PHP와 동일한 로직)
          const uniqueLotteryWeightList: Map<number, [any, number]> = new Map();
          let chiefId: number | null = null;

          // 연도별 최대 시도 횟수 계산
          const relYear = year - startYear;
          let maxTrialCountByYear = 1;
          for (const [targetYear, targetTrialCnt] of MAX_UNIQUE_ITEM_LIMIT) {
            if (relYear < targetYear) {
              break;
            }
            maxTrialCountByYear = targetTrialCnt;
          }

          for (const nationGen of nationGenerals) {
            const genData = nationGen.data || {};
            const officerLevel = genData.officer_level || 0;
            const genId = genData.no || nationGen.no || 0;

            if (officerLevel === 12) {
              chiefId = genId;
            }

            // 유니크 아이템 슬롯 확인
            let trialCnt = maxTrialCountByYear;
            const itemSlots = ['item', 'horse', 'weapon', 'book'];
            for (const slot of itemSlots) {
              const itemCode = genData[slot] || 'None';
              if (itemCode !== 'None') {
                // TODO: isBuyable 체크 (간소화)
                trialCnt -= 1;
              }
            }

            if (trialCnt <= 0) {
              continue;
            }

            // 가중치 계산 (PHP와 동일)
            let score = (genData.belong || 0) + 10;

            if (officerLevel === 12) {
              score += 60;  // 군주
            } else if (officerLevel === 11) {
              score += 30;  // 부군주
            } else if (officerLevel > 4) {
              score += 15;  // 고위 관직
            }

            score *= Math.pow(2, trialCnt);

            uniqueLotteryWeightList.set(genId, [nationGen, score]);
          }

          // 유니크 아이템 추첨 RNG
          const nationLevelUpRNG = new RandUtil(new LiteHashDRBG(
            `${sessionId}_nationLevelUp_${year}_${month}_${nationId}`
          ));

          // 레벨 차이만큼 유니크 아이템 추첨
          for (let idx = 0; idx < levelDiff; idx++) {
            if (uniqueLotteryWeightList.size === 0) {
              break;
            }

            // 가중치 기반 당첨자 선택
            const weightArray = Array.from(uniqueLotteryWeightList.values());
            const winner = nationLevelUpRNG.choiceUsingWeightPair(weightArray);

            if (winner) {
              const winnerId = winner.data?.no || winner.no || 0;
              uniqueLotteryWeightList.delete(winnerId);

              // 유니크 아이템 지급
              const givenUniqueRNG = new RandUtil(new LiteHashDRBG(
                `${sessionId}_givenUnique_${year}_${month}_${nationId}_${winnerId}`
              ));

              await giveRandomUniqueItem(givenUniqueRNG, winner, sessionId, '작위보상');
              await saveGeneral(sessionId, winnerId, winner.toObject ? winner.toObject() : winner);

              logger.info('[UpdateNationLevel] 유니크 아이템 지급', {
                nationId,
                generalId: winnerId,
                generalName: winner.data?.name || winner.name
              });
            }
          }

          // 군주에게 통일자 포인트 지급 (PHP와 동일)
          if (chiefId) {
            const chiefObj = await General.findOne({
              session_id: sessionId,
              $or: [{ no: chiefId }, { 'data.no': chiefId }]
            });

            if (chiefObj) {
              chiefObj.data = chiefObj.data || {};
              chiefObj.data.inheritance = chiefObj.data.inheritance || {};
              chiefObj.data.inheritance.unifier = (chiefObj.data.inheritance.unifier || 0) + (250 * levelDiff);
              await saveGeneral(sessionId, chiefId, chiefObj.toObject ? chiefObj.toObject() : chiefObj);

              logger.info('[UpdateNationLevel] 군주 통일자 포인트 지급', {
                chiefId,
                inheritanceBonus: 250 * levelDiff
              });
            }
          }
        }

        levelUpCount++;

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
