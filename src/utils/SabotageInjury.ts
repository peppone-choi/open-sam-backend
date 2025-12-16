/**
 * SabotageInjury - 재난/전투 부상 처리 함수
 * PHP func.php의 SabotageInjury 함수와 동일한 로직
 * 
 * @module utils/SabotageInjury
 */

import { RandUtil } from './RandUtil';
import { JosaUtil } from './JosaUtil';

/**
 * 장수 인터페이스 (부상 처리에 필요한 최소 필드)
 */
export interface InjurableGeneral {
  no?: number;
  data?: {
    no?: number;
    injury?: number;
    crew?: number;
    atmos?: number;
    train?: number;
  };
  injury?: number;
  crew?: number;
  atmos?: number;
  train?: number;
  
  // General 객체의 메서드들 (존재하면 사용)
  getLogger?: () => {
    pushGeneralActionLog: (text: string, format?: number) => void;
  } | null;
  onCalcStat?: (general: any, statName: string, value: any) => any;
  increaseVarWithLimit?: (varName: string, delta: number, min: number, max: number) => void;
  multiplyVar?: (varName: string, multiplier: number) => void;
  applyDB?: (db: any) => Promise<boolean>;
}

/**
 * 도시 내 장수들에게 부상을 입히는 함수
 * PHP func.php의 SabotageInjury와 동일한 로직
 * 
 * @param rng - 난수 생성기
 * @param cityGeneralList - 도시 내 장수 목록
 * @param reason - 부상 원인 (예: '재난', '화계', '지진')
 * @param saveCallback - 장수 저장 콜백 (없으면 applyDB 호출)
 * @returns 부상당한 장수 수
 * 
 * @example
 * ```ts
 * const injuryCount = await SabotageInjury(rng, generals, '재난', async (general) => {
 *   await saveGeneral(sessionId, general.no, general.data);
 * });
 * ```
 */
export async function SabotageInjury(
  rng: RandUtil,
  cityGeneralList: InjurableGeneral[],
  reason: string,
  saveCallback?: (general: InjurableGeneral) => Promise<void>
): Promise<number> {
  let injuryCount = 0;
  
  // PHP: $josaRo = JosaUtil::pick($reason, '로');
  const josaRo = JosaUtil.pick(reason, '로');
  // PHP: $text = "<M>{$reason}</>{$josaRo} 인해 <R>부상</>을 당했습니다.";
  const text = `<M>${reason}</>${josaRo} 인해 <R>부상</>을 당했습니다.`;
  
  for (const general of cityGeneralList) {
    // 기본 부상 확률 30%
    let injuryProb = 0.3;
    
    // PHP: $injuryProb = $general->onCalcStat($general, 'injuryProb', $injuryProb);
    // 특기/아이템에 의해 부상 확률 조정 가능
    if (typeof general.onCalcStat === 'function') {
      injuryProb = general.onCalcStat(general, 'injuryProb', injuryProb);
    }
    
    // PHP: if(!$rng->nextBool($injuryProb)) continue;
    if (!rng.nextBool(injuryProb)) {
      continue;
    }
    
    // 로그 기록
    // PHP: $general->getLogger()->pushGeneralActionLog($text);
    if (typeof general.getLogger === 'function') {
      const logger = general.getLogger();
      if (logger && typeof logger.pushGeneralActionLog === 'function') {
        logger.pushGeneralActionLog(text, 0); // 0 = PLAIN
      }
    }
    
    // 데이터 참조 (data 필드가 있으면 사용, 없으면 직접 필드)
    const data = general.data || general;
    
    // PHP: $general->increaseVarWithLimit('injury', $rng->nextRangeInt(1, 16), 0, 80);
    // 부상 1~16 증가, 최대 80
    const injuryIncrease = rng.nextRangeInt(1, 16);
    const currentInjury = data.injury || 0;
    const newInjury = Math.min(80, Math.max(0, currentInjury + injuryIncrease));
    
    if (general.data) {
      general.data.injury = newInjury;
    } else if (typeof (general as any).injury !== 'undefined') {
      (general as any).injury = newInjury;
    }
    
    // 병종별 메서드가 있으면 사용, 없으면 직접 계산
    if (typeof general.increaseVarWithLimit === 'function') {
      general.increaseVarWithLimit('injury', injuryIncrease, 0, 80);
    }
    
    // PHP: $general->multiplyVar('crew', 0.98);
    if (typeof general.multiplyVar === 'function') {
      general.multiplyVar('crew', 0.98);
      general.multiplyVar('atmos', 0.98);
      general.multiplyVar('train', 0.98);
    } else {
      // 직접 계산
      if (general.data) {
        general.data.crew = Math.floor((general.data.crew || 0) * 0.98);
        general.data.atmos = Math.floor((general.data.atmos || 0) * 0.98);
        general.data.train = Math.floor((general.data.train || 0) * 0.98);
      } else {
        (general as any).crew = Math.floor(((general as any).crew || 0) * 0.98);
        (general as any).atmos = Math.floor(((general as any).atmos || 0) * 0.98);
        (general as any).train = Math.floor(((general as any).train || 0) * 0.98);
      }
    }
    
    // 저장
    if (saveCallback) {
      await saveCallback(general);
    } else if (typeof general.applyDB === 'function') {
      // PHP: $general->applyDB($db);
      await general.applyDB(null);
    }
    
    injuryCount += 1;
  }
  
  return injuryCount;
}

/**
 * 동기 버전 (DB 저장 없이 데이터만 수정)
 */
export function SabotageInjurySync(
  rng: RandUtil,
  cityGeneralList: InjurableGeneral[],
  reason: string
): { injuryCount: number; affectedGenerals: InjurableGeneral[] } {
  let injuryCount = 0;
  const affectedGenerals: InjurableGeneral[] = [];
  
  const josaRo = JosaUtil.pick(reason, '로');
  const text = `<M>${reason}</>${josaRo} 인해 <R>부상</>을 당했습니다.`;
  
  for (const general of cityGeneralList) {
    let injuryProb = 0.3;
    
    if (typeof general.onCalcStat === 'function') {
      injuryProb = general.onCalcStat(general, 'injuryProb', injuryProb);
    }
    
    if (!rng.nextBool(injuryProb)) {
      continue;
    }
    
    if (typeof general.getLogger === 'function') {
      const logger = general.getLogger();
      if (logger && typeof logger.pushGeneralActionLog === 'function') {
        logger.pushGeneralActionLog(text, 0);
      }
    }
    
    const data = general.data || general;
    
    const injuryIncrease = rng.nextRangeInt(1, 16);
    const currentInjury = data.injury || 0;
    const newInjury = Math.min(80, Math.max(0, currentInjury + injuryIncrease));
    
    if (general.data) {
      general.data.injury = newInjury;
      general.data.crew = Math.floor((general.data.crew || 0) * 0.98);
      general.data.atmos = Math.floor((general.data.atmos || 0) * 0.98);
      general.data.train = Math.floor((general.data.train || 0) * 0.98);
    } else {
      (general as any).injury = newInjury;
      (general as any).crew = Math.floor(((general as any).crew || 0) * 0.98);
      (general as any).atmos = Math.floor(((general as any).atmos || 0) * 0.98);
      (general as any).train = Math.floor(((general as any).train || 0) * 0.98);
    }
    
    injuryCount += 1;
    affectedGenerals.push(general);
  }
  
  return { injuryCount, affectedGenerals };
}

export default SabotageInjury;








