import { Schema, model, Document } from 'mongoose';
import { INgHistory } from '../@types/ng-history.types';

export interface INgHistoryDocument extends Omit<INgHistory, 'id'>, Document {
  id: string;
}

const NgHistorySchema = new Schema<INgHistoryDocument>({
  serverId: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  map: { type: Schema.Types.Mixed },
  globalHistory: { type: Schema.Types.Mixed },
  globalAction: { type: Schema.Types.Mixed },
  nations: { type: Schema.Types.Mixed },
}, { timestamps: true });

NgHistorySchema.index({ serverId: 1, year: 1, month: 1 });

export const NgHistoryModel = model<INgHistoryDocument>('NgHistory', NgHistorySchema);
