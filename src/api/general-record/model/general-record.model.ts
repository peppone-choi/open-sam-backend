import { Schema, model, Document } from 'mongoose';
import { IGeneralRecord } from '../@types/general-record.types';

export interface IGeneralRecordDocument extends Omit<IGeneralRecord, 'id'>, Document {
  id: string;
}

const GeneralRecordSchema = new Schema<IGeneralRecordDocument>(
  {
    sessionId: { type: String, required: true, index: true },
    generalId: { type: String, required: true, index: true },
    logType: { 
      type: String, 
      required: true, 
      enum: ['action', 'battle_brief', 'battle', 'history'] 
    },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    text: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

GeneralRecordSchema.index({ generalId: 1, year: -1, month: -1 });
GeneralRecordSchema.index({ sessionId: 1, logType: 1 });
GeneralRecordSchema.index({ logType: 1, year: -1, month: -1 });

export const GeneralRecordModel = model<IGeneralRecordDocument>('GeneralRecord', GeneralRecordSchema);
