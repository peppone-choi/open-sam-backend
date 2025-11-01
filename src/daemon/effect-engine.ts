import { General } from '../models/general.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import { evaluate } from './expression-evaluator';

/**
 * 효과 엔진
 * 
 * 세션별로 정의된 효과를 실행
 * JSON 템플릿 문자열 지원! ({{arg.amount}} 같은 것)
 */

export async function applyEffects(
  sessionId: string,
  effects: Record<string, any>,
  context: {
    general?: any;
    city?: any;
    nation?: any;
    arg?: any;
  }
) {
  const { general, city, nation, arg } = context;
  
  // 장수 효과
  if (general && effects.general) {
    await applyToData(general.data, effects.general, context);
    await general.save();
  }
  
  // 도시 효과
  if (city && effects.city) {
    await applyToData(city.data, effects.city, context);
    await city.save();
  }
  
  // 국가 효과
  if (nation && effects.nation) {
    await applyToData(nation.data, effects.nation, context);
    await nation.save();
  }
  
  // 특수 효과
  if (effects.special) {
    await applySpecialEffects(effects.special, context);
  }
}

/**
 * data 객체에 효과 적용 (템플릿 지원!)
 */
async function applyToData(data: Record<string, any>, effects: Record<string, any>, context: any) {
  for (const [key, value] of Object.entries(effects)) {
    // 1. 템플릿 문자열 평가
    const evaluated = evaluate(value, context);
    
    // 2. 평가된 값 적용
    if (typeof evaluated === 'number') {
      data[key] = (data[key] || 0) + evaluated;
    } else if (typeof evaluated === 'string') {
      // "+123" → 덧셈
      if (evaluated.startsWith('+')) {
        const num = parseFloat(evaluated.substring(1));
        data[key] = (data[key] || 0) + num;
      }
      // "-123" → 뺄셈
      else if (evaluated.startsWith('-')) {
        const num = parseFloat(evaluated.substring(1));
        data[key] = (data[key] || 0) + num; // 이미 음수
      }
      // "=123" → 설정
      else if (evaluated.startsWith('=')) {
        const num = parseFloat(evaluated.substring(1));
        data[key] = num;
      }
      // "123" → 숫자로 변환 시도
      else if (!isNaN(parseFloat(evaluated))) {
        data[key] = parseFloat(evaluated);
      }
      // "{{calculated}}" 같은 거 → 무시
      else if (evaluated.includes('{{')) {
        // 아직 평가 안 됨, 스킵
      }
      // 그 외 → 그대로 저장
      else {
        data[key] = evaluated;
      }
    } else if (typeof evaluated === 'object' && evaluated !== null) {
      // 객체면 조건부 처리
      if ('set' in evaluated) {
        data[key] = (evaluated as any).set;
      } else if ('min' in evaluated || 'max' in evaluated) {
        let newValue = (data[key] || 0) + ((evaluated as any).add || 0);
        if ((evaluated as any).min !== undefined) newValue = Math.max(newValue, (evaluated as any).min);
        if ((evaluated as any).max !== undefined) newValue = Math.min(newValue, (evaluated as any).max);
        data[key] = newValue;
      }
    } else {
      data[key] = evaluated;
    }
  }
}

/**
 * 특수 효과 (복잡한 로직)
 */
async function applySpecialEffects(special: any, context: any) {
  // 예: 메시지 전송, 다른 장수에게 영향, 이벤트 발생 등
  if (special.send_message) {
    // TODO: 메시지 전송
  }
  
  if (special.create_battle) {
    // TODO: 전투 생성
  }
}

function evaluateCondition(condition: any, context: any): boolean {
  // 간단한 조건 평가
  // 예: { general.gold: { $gte: 1000 } }
  return true; // TODO: 구현
}
