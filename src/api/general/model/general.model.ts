import { Schema, model, Document } from 'mongoose';
import { IGeneral } from '../../@types';

/**
 * General Mongoose Schema
 * schema.sql의 general 테이블 기반
 */
export interface IGeneralDocument extends IGeneral, Document {}

const GeneralSchema = new Schema<IGeneralDocument>(
  {
    // 기본 정보
    name: { type: String, required: true },
    owner: { type: String },
    ownerName: { type: String },
    npc: { type: Boolean, required: true, default: false },
    npcOrg: { type: Boolean },
    
    // 국가/위치
    nation: { type: String },
    city: { type: String },
    troop: { type: String },
    
    // 능력치
    leadership: { type: Number, required: true, default: 50 },
    leadershipExp: { type: Number, required: true, default: 0 },
    strength: { type: Number, required: true, default: 50 },
    strengthExp: { type: Number, required: true, default: 0 },
    intel: { type: Number, required: true, default: 50 },
    intelExp: { type: Number, required: true, default: 0 },
    
    // 직책
    officerLevel: { type: Number, required: true, default: 0 },
    officerCity: { type: String },
    permission: { 
      type: String, 
      enum: ['normal', 'auditor', 'ambassador'], 
      default: 'normal' 
    },
    
    // 자원
    gold: { type: Number, required: true, default: 1000 },
    rice: { type: Number, required: true, default: 1000 },
    
    // 병력
    crew: { type: Number, required: true, default: 0 },
    crewType: { type: Number, required: true, default: 1100 }, // 보병
    train: { type: Number, required: true, default: 0 },
    atmos: { type: Number, required: true, default: 0 },
    
    // 장비
    weapon: { type: String, default: 'None' },
    book: { type: String, default: 'None' },
    horse: { type: String, default: 'None' },
    item: { type: String, default: 'None' },
    
    // 특기
    personal: { type: String, default: 'None' },
    special: { type: String, default: 'None' },
    specAge: { type: Number, default: 0 },
    special2: { type: String, default: 'None' },
    specAge2: { type: Number, default: 0 },
    
    // 경험치 & 헌신도
    experience: { type: Number, default: 0 },
    dedication: { type: Number, default: 0 },
    dedLevel: { type: Number, default: 0 },
    expLevel: { type: Number, default: 0 },
    
    // 특기 레벨
    dex1: { type: Number, default: 0 },
    dex2: { type: Number, default: 0 },
    dex3: { type: Number, default: 0 },
    dex4: { type: Number, default: 0 },
    dex5: { type: Number, default: 0 },
    
    // 턴/시간
    turnTime: { type: Date, required: true, default: Date.now },
    recentWar: { type: Date },
    
    // 상태
    injury: { type: Number, default: 0 },
    age: { type: Number, default: 20 },
    startAge: { type: Number, default: 20 },
    birthYear: { type: Number, default: 180 },
    deadYear: { type: Number, default: 300 },
    
    // 소속/배신
    belong: { type: Number, default: 1 },
    betray: { type: Number, default: 0 },
    affinity: { type: Number, default: 0 },
    
    // 이미지
    picture: { type: String, required: true },
    imgServer: { type: Number, default: 0 },
    
    // NPC 메시지
    npcMsg: { type: String },
    newMsg: { type: Boolean, default: false },
    
    // 기타
    makeLimiturn: { type: Number },
    killTurn: { type: Number },
    block: { type: Boolean, default: false },
    defenceTrain: { type: Number, default: 80 },
    tournament: { type: Number, default: 0 },
    newVote: { type: Boolean, default: false },
    
    // JSON 필드
    lastTurn: { type: Schema.Types.Mixed, default: {} },
    aux: { type: Schema.Types.Mixed, default: {} },
    penalty: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// 인덱스
GeneralSchema.index({ nation: 1, npc: 1 });
GeneralSchema.index({ city: 1 });
GeneralSchema.index({ name: 1 });
GeneralSchema.index({ owner: 1 });
GeneralSchema.index({ turnTime: 1 });

export const GeneralModel = model<IGeneralDocument>('General', GeneralSchema);
