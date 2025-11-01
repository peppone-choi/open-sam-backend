import { getSessionConfig } from './session-config';

/**
 * 완전 동적 필드 접근 헬퍼
 * 
 * 세션 설정의 field_mappings를 사용하여 필드에 접근
 */

export class FieldAccessor {
  private session: any;
  
  constructor(session: any) {
    this.session = session;
  }
  
  // General 필드 접근
  getGeneralField(general: any, logicalName: string): any {
    const fieldName = this.session.field_mappings?.general?.[logicalName];
    if (!fieldName) return undefined;
    return general.data?.[fieldName];
  }
  
  setGeneralField(general: any, logicalName: string, value: any) {
    const fieldName = this.session.field_mappings?.general?.[logicalName];
    if (!fieldName) return;
    if (!general.data) general.data = {};
    general.data[fieldName] = value;
  }
  
  // City 필드 접근
  getCityField(city: any, logicalName: string): any {
    const fieldName = this.session.field_mappings?.city?.[logicalName];
    if (!fieldName) return undefined;
    return city.data?.[fieldName];
  }
  
  setCityField(city: any, logicalName: string, value: any) {
    const fieldName = this.session.field_mappings?.city?.[logicalName];
    if (!fieldName) return;
    if (!city.data) city.data = {};
    city.data[fieldName] = value;
  }
  
  // Nation 필드 접근
  getNationField(nation: any, logicalName: string): any {
    const fieldName = this.session.field_mappings?.nation?.[logicalName];
    if (!fieldName) return undefined;
    return nation.data?.[fieldName];
  }
  
  setNationField(nation: any, logicalName: string, value: any) {
    const fieldName = this.session.field_mappings?.nation?.[logicalName];
    if (!fieldName) return;
    if (!nation.data) nation.data = {};
    nation.data[fieldName] = value;
  }
}

/**
 * 팩토리 함수
 */
export async function createFieldAccessor(sessionId: string): Promise<FieldAccessor> {
  const session = await getSessionConfig(sessionId);
  return new FieldAccessor(session);
}
