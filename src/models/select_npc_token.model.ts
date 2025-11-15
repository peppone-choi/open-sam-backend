import mongoose, { Schema, Document } from 'mongoose';

/**
 * SelectNpcToken - select_npc_token
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface ISelectNpcToken extends Document {
  session_id: string;
  data?: Record<string, any>;
  pick_result?: Record<string, any>;
}

const SelectNpcTokenSchema = new Schema<ISelectNpcToken>({
  session_id: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  pick_result: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'select_npc_tokens',
  strict: false
});

// 복합 인덱스 추가
SelectNpcTokenSchema.index({ session_id: 1, 'data.owner': 1 });

export const SelectNpcToken = mongoose.models.SelectNpcToken || mongoose.model<ISelectNpcToken>('SelectNpcToken', SelectNpcTokenSchema);
