import { Schema, model, Document } from 'mongoose';
import { IUserRecord } from '../@types/user-record.types';

export interface IUserRecordDocument extends Omit<IUserRecord, 'id'>, Document {
  id: string;
}

const UserRecordSchema = new Schema<IUserRecordDocument>(
  {
    userId: { type: String, required: true },
    serverId: { type: String, required: true },
    logType: { type: String, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    date: { type: Date },
    text: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

UserRecordSchema.index({ userId: 1, serverId: 1 });
UserRecordSchema.index({ serverId: 1, year: 1, month: 1 });
UserRecordSchema.index({ logType: 1 });

export const UserRecordModel = model<IUserRecordDocument>('UserRecord', UserRecordSchema);
