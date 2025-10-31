import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  no?: string;
  username: string;
  name?: string;
  password: string;
  
  // 게임 모드
  game_mode: 'turn' | 'realtime';
  
  // 턴제 전용: 유저의 턴 시각 (예: 21:00)
  turn_hour?: number;    // 0-23
  turn_minute?: number;  // 0-59
  
  // 다음 턴 시각 (계산됨)
  next_turn_time?: Date;
}

const UserSchema = new Schema<IUser>({
  no: { type: String },
  username: { type: String, required: true, unique: true },
  name: { type: String },
  password: { type: String, required: true },
  
  game_mode: { type: String, default: 'turn' },
  turn_hour: { type: Number, default: 21 },
  turn_minute: { type: Number, default: 0 },
  next_turn_time: { type: Date }
}, {
  timestamps: true
});

export const User = mongoose.model<IUser>('User', UserSchema);
