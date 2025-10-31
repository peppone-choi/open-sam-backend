import { ICommand } from '../models/command.model';
import { General } from '../models/general.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import { getSessionConfig } from '../utils/session-config';
import { createFieldAccessor } from '../utils/field-accessor';
import { applyEffects } from './effect-engine';

/**
 * 커맨드 실행기
 * 
 * ⭐ 중요: 모든 DB 업데이트는 여기서만 발생!
 * 
 * 완전 동적: 모든 필드 접근이 세션 설정 기반
 */

export async function executeCommand(command: ICommand) {
  const { action, arg, general_id, session_id } = command;
  
  console.log(`🎮 커맨드 실행: ${action} (세션: ${session_id})`);
  
  // 세션 설정 조회
  const session = await getSessionConfig(session_id);
  const commandConfig = session.commands?.[action];
  
  if (!commandConfig || !commandConfig.enabled) {
    throw new Error(`커맨드를 사용할 수 없습니다: ${action}`);
  }
  
  // 필드 접근자 생성
  const accessor = await createFieldAccessor(session_id);
  
  // General 커맨드
  if (general_id) {
    const general = await General.findOne({ session_id, no: general_id });
    if (!general) throw new Error('장수를 찾을 수 없습니다');
    
    // 동적 필드 접근!
    const cityId = accessor.getGeneralField(general, 'location');
    const city = await City.findOne({ session_id, city: cityId });
    
    // 우선순위 1: TypeScript 함수로 구현된 효과
    const effectFn = getEffectFunction(action);
    if (effectFn) {
      await effectFn({ general, city, nation: null, arg, session });
    }
    // 우선순위 2: JSON 설정 기반 효과
    else if (commandConfig.effects) {
      await applyEffects(session_id, commandConfig.effects, {
        general,
        city,
        arg
      });
    }
  }
  // Nation 커맨드
  else if (command.nation_id) {
    const nation = await Nation.findOne({ session_id, nation: command.nation_id });
    if (!nation) throw new Error('국가를 찾을 수 없습니다');
    
    // 세션별 효과 적용!
    await applyEffects(session_id, commandConfig.effects, {
      nation,
      arg
    });
  }
}
