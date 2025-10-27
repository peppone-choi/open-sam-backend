import { Schema, model, Document } from 'mongoose';
import { ISelectNpcToken } from '../@types/select-npc-token.types';

export interface ISelectNpcTokenDocument extends Omit<ISelectNpcToken, 'id'>, Document {
  id: string;
}

const SelectNpcTokenSchema = new Schema<ISelectNpcTokenDocument>(
  {
    sessionId: { type: String, required: true },
    owner: { type: String, required: true },
    validUntil: { type: Date, required: true },
    pickMoreFrom: { type: Date, required: true },
    pickResult: { type: Schema.Types.Mixed, default: {} },
    nonce: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  }
);

SelectNpcTokenSchema.index({ sessionId: 1, owner: 1 });
SelectNpcTokenSchema.index({ validUntil: 1 });

export const SelectNpcTokenModel = model<ISelectNpcTokenDocument>('SelectNpcToken', SelectNpcTokenSchema);
