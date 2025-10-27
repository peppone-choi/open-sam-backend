import { Schema, model, Document } from 'mongoose';
import { IGeneralTurn } from '../@types/general-turn.types';

export interface IGeneralTurnDocument extends Omit<IGeneralTurn, 'id'>, Document {
  id: string;
}

const GeneralTurnSchema = new Schema<IGeneralTurnDocument>(
  {
    sessionId: { type: String, required: true, index: true },
    generalId: { type: String, required: true, index: true },
    turnIdx: { type: Number, required: true },
    action: { type: String, required: true },
    arg: { type: Schema.Types.Mixed },
    brief: { type: String },
  },
  {
    timestamps: true,
  }
);

GeneralTurnSchema.index({ generalId: 1, turnIdx: -1 });
GeneralTurnSchema.index({ sessionId: 1, turnIdx: -1 });

export const GeneralTurnModel = model<IGeneralTurnDocument>('GeneralTurn', GeneralTurnSchema);
