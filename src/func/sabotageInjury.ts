/**
 * SabotageInjury - 계략으로 인한 장수 부상 처리
 * 
 * PHP 원본: func.php의 SabotageInjury 함수
 * 
 * @param rng - 랜덤 유틸리티
 * @param cityGeneralList - 도시에 있는 장수 목록
 * @param reason - 부상 이유 (예: '계략')
 * @returns 부상당한 장수 수
 */

import { JosaUtil } from '../utils/JosaUtil';

export async function SabotageInjury(
  rng: any,
  cityGeneralList: any[],
  reason: string
): Promise<number> {
  let injuryCount = 0;
  const josaRo = JosaUtil.pick(reason, '로');
  const text = `<M>${reason}</>${josaRo} 인해 <R>부상</>을 당했습니다.`;

  for (const general of cityGeneralList) {
    // PHP: $injuryProb = 0.3;
    let injuryProb = 0.3;
    
    // 장수의 특수 능력으로 부상 확률 보정
    if (typeof general.onCalcStat === 'function') {
      injuryProb = general.onCalcStat(general, 'injuryProb', injuryProb);
    }
    
    if (!rng.nextBool(injuryProb)) {
      continue;
    }
    
    // 부상 로그 추가
    try {
      const logger = general.getLogger?.();
      if (logger) {
        logger.pushGeneralActionLog(text);
      }
    } catch (error) {
      console.error('로그 추가 실패:', error);
    }

    // PHP 원본:
    // $general->increaseVarWithLimit('injury', $rng->nextRangeInt(1, 16), 0, 80);
    // $general->multiplyVar('crew', 0.98);
    // $general->multiplyVar('atmos', 0.98);
    // $general->multiplyVar('train', 0.98);
    
    if (typeof general.increaseVarWithLimit === 'function') {
      general.increaseVarWithLimit('injury', rng.nextRangeInt(1, 16), 0, 80);
    } else if (typeof general.setVar === 'function') {
      const currentInjury = general.data?.injury || general.injury || 0;
      const newInjury = Math.min(80, Math.max(0, currentInjury + rng.nextRangeInt(1, 16)));
      general.setVar('injury', newInjury);
    }
    
    if (typeof general.multiplyVar === 'function') {
      general.multiplyVar('crew', 0.98);
      general.multiplyVar('atmos', 0.98);
      general.multiplyVar('train', 0.98);
    }

    // 장수 정보 저장
    try {
      if (typeof general.applyDB === 'function') {
        await general.applyDB();
      } else if (typeof general.save === 'function') {
        await general.save();
      }
    } catch (error) {
      console.error('장수 저장 실패:', error);
    }

    injuryCount += 1;
  }

  return injuryCount;
}



