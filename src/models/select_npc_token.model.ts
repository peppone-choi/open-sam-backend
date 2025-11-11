import mongoose, { Schema, Document } from 'mongoose';

/**
 * SelectNpcToken - select_npc_token
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface ISelectNpcToken extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const SelectNpcTokenSchema = new Schema<ISelectNpcToken>({
  session_id: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'select_npc_tokens'
});

// 복합 인덱스 추가
SelectNpcTokenSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const SelectNpcToken = mongoose.models.SelectNpcToken || mongoose.model<ISelectNpcToken>('SelectNpcToken', SelectNpcTokenSchema);
