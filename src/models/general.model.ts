import mongoose, { Schema, Document } from 'mongoose';

// 장수 인터페이스
export interface IGeneral extends Document {
  no: number;
  session_id: string;
  owner: string;
  
  // 기본 정보
  name: string;
  picture?: string;
  
  // 턴제 전용
  custom_turn_hour?: number;
  custom_turn_minute?: number;
  
  // 추가 필드
  aux?: Record<string, any>;
  rank?: Record<string, any>;
  special2?: string;
  turn_time?: number;
  turntime?: Date | string;
  npc?: number;
  leadership?: number;
  strength?: number;
  intel?: number;
  nation?: number;
  owner_name?: string;
  
  // 완전 동적 데이터 (모든 것이 세션 설정에 따라 다름!)
  data: Record<string, any>;
  // 예시:
  // {
  //   // 자원 (resources)
  //   gold: 10000,
  //   rice: 5000,
  //   crew: 0,
  //   crewtype: 0,
  //   
  //   // 능력치 (attributes)
  //   leadership: 80,
  //   strength: 75,
  //   intel: 85,
  //   leadership_exp: 0,
  //   strength_exp: 0,
  //   intel_exp: 0,
  //   experience: 0,
  //   dedication: 0,
  //   train: 0,
  //   atmos: 0,
  //   injury: 0,
  //   
  //   // 게임 로직 필드 (하드코딩 아님!)
  //   nation: 1,
  //   city: 10,
  //   officer_level: 12,
  //   troop: 0,
  //   weapon: 'None',
  //   book: 'None',
  //   horse: 'None',
  //   special: 'None',
  //   personal: 'None'
  // }
  
  // 헬퍼 메서드
  getVar(key: string): any;
  setVar(key: string, value: any): void;
  increaseVar(key: string, amount: number): void;
  increaseVarWithLimit(key: string, amount: number, limit: number): void;
  getID(): number;
  getNationID(): number;
  getCityID(): number;
  getLogger(): any;
  getLastTurn(): any;
  getResultTurn(): any;
  _setResultTurn(turn: any): void;
  getRawCity(): any;
  setRawCity(city: any): void;
  getStaticNation(): any;
  addExperience(exp: number): void;
  addDedication(ded: number): void;
  checkStatChange(): Promise<void>;
  applyDB(db: any): Promise<void>;
  markModified(path: string): void;
  save(): Promise<this>;
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number;
}

const GeneralSchema = new Schema<IGeneral>({
  no: { type: Number, required: true },
  session_id: { type: String, required: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  picture: { type: String },
  
  custom_turn_hour: { type: Number },
  custom_turn_minute: { type: Number },
  
  aux: { type: Schema.Types.Mixed, default: {} },
  rank: { type: Schema.Types.Mixed, default: {} },
  special2: { type: String },
  turn_time: { type: Number },
  turntime: { type: Date },
  npc: { type: Number, default: 0 },
  leadership: { type: Number },
  strength: { type: Number },
  intel: { type: Number },
  nation: { type: Number },
  owner_name: { type: String },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

GeneralSchema.index({ session_id: 1, no: 1 }, { unique: true });

// 메서드 추가 (PHP의 General 클래스 메서드들)
GeneralSchema.methods.getVar = function(key: string): any {
  return this.data?.[key];
};

GeneralSchema.methods.setVar = function(key: string, value: any): void {
  this.data[key] = value;
  this.markModified('data');
};

GeneralSchema.methods.increaseVar = function(key: string, amount: number): void {
  if (!this.data[key]) this.data[key] = 0;
  this.data[key] += amount;
  this.markModified('data');
};

GeneralSchema.methods.increaseVarWithLimit = function(key: string, amount: number, limit: number): void {
  if (!this.data[key]) this.data[key] = 0;
  this.data[key] += amount;
  if (amount > 0) {
    this.data[key] = Math.min(this.data[key], limit);
  } else {
    this.data[key] = Math.max(this.data[key], limit);
  }
  this.markModified('data');
};

GeneralSchema.methods.getID = function(): number {
  return this.no;
};

GeneralSchema.methods.getNationID = function(): number {
  return this.data.nation || 0;
};

GeneralSchema.methods.getCityID = function(): number {
  return this.data.city || 0;
};

GeneralSchema.methods.getSessionID = function(): string {
  return this.session_id;
};

GeneralSchema.methods.getLogger = function(): any {
  // TODO: Implement logger
  return {
    pushGeneralActionLog: (message: string) => {
      console.log(`[General ${this.no}] ${message}`);
    }
  };
};

GeneralSchema.methods.getLastTurn = function(): any {
  return this.data.last_turn || { command: '휴식', arg: null, term: 0 };
};

GeneralSchema.methods.getResultTurn = function(): any {
  return this.data.result_turn || { command: '휴식', arg: null, term: 0 };
};

GeneralSchema.methods._setResultTurn = function(turn: any): void {
  this.data.result_turn = turn;
  this.markModified('data');
};

GeneralSchema.methods.getRawCity = function(): any {
  return this.data._cached_city || null;
};

GeneralSchema.methods.setRawCity = function(city: any): void {
  this.data._cached_city = city;
  this.markModified('data');
};

GeneralSchema.methods.getStaticNation = function(): any {
  return this.data._cached_nation || {
    nation: 0,
    name: '재야',
    color: '#000000',
    type: 0,
    level: 0,
    capital: 0
  };
};

GeneralSchema.methods.addExperience = function(exp: number): void {
  if (!this.data.experience) this.data.experience = 0;
  this.data.experience += exp;
  this.markModified('data');
};

GeneralSchema.methods.addDedication = function(ded: number): void {
  if (!this.data.dedication) this.data.dedication = 0;
  this.data.dedication += ded;
  this.markModified('data');
};

GeneralSchema.methods.checkStatChange = async function(): Promise<void> {
  // TODO: Implement stat change logic
};

GeneralSchema.methods.applyDB = async function(db: any): Promise<void> {
  await this.save();
};

GeneralSchema.methods.onCalcDomestic = function(turnType: string, varType: string, value: number, aux?: any): number {
  // PHP의 onCalcDomestic과 동일
  // 특수 아이템/능력의 영향을 계산하는 메서드
  // 기본적으로는 value를 그대로 반환하지만,
  // 특수 아이템이나 능력이 있으면 값을 조정
  
  // TODO: 특수 아이템/능력 목록을 가져와서 onCalcDomestic을 호출
  // 현재는 기본값 반환
  // const actionList = this.getActionList();
  // for (const iObj of actionList) {
  //   if (iObj && iObj.onCalcDomestic) {
  //     value = iObj.onCalcDomestic(turnType, varType, value, aux);
  //   }
  // }
  
  return value;
};

export const General = mongoose.models.General || mongoose.model<IGeneral>('General', GeneralSchema);
