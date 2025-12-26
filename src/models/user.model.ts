import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  no?: string;
  username: string;
  email: string;
  name: string;
  password: string;
  
  // 게임 모드
  game_mode: 'turn' | 'realtime';
  
  // 턴제 전용: 유저의 턴 시각 (예: 21:00)
  turn_hour?: number;    // 0-23
  turn_minute?: number;  // 0-59
  
  // 다음 턴 시각 (계산됨)
  next_turn_time?: Date;
  
  // 권한 관련 (레거시 호환)
  grade?: number;        // 사용자 등급 (1-10, 5 이상이 어드민)
  acl?: Record<string, any>; // 접근 제어 목록 (JSON)

    // 계정 보안/삭제 관련
    global_salt?: string;
    token_valid_until?: Date;
    delete_after?: Date;
    deleted?: boolean;
  
    // OAuth 관련
    oauth_type?: string; // kakao, google, etc
    oauth_id?: string;
    oauth_access_token?: string;
    oauth_refresh_token?: string;
    picture?: string;
  }
  
  
  const UserSchema = new Schema<IUser>({
    no: { type: String },
    username: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
  
    game_mode: { type: String, default: 'turn' },
    turn_hour: { type: Number, default: 21 },
    turn_minute: { type: Number, default: 0 },
    next_turn_time: { type: Date },
  
    grade: { type: Number, default: 1 }, // 기본 등급 1, 5 이상이 어드민
    acl: { type: Schema.Types.Mixed, default: {} }, // 접근 제어 목록
    global_salt: { type: String },
    token_valid_until: { type: Date },
    delete_after: { type: Date },
    deleted: { type: Boolean, default: false },
  
    // OAuth
    oauth_type: { type: String },
    oauth_id: { type: String },
    oauth_access_token: { type: String, select: false }, // 보안상 select: false
    oauth_refresh_token: { type: String, select: false },
    picture: { type: String }
  }, {
    timestamps: true
  });

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
