import { Schema, model, Document } from 'mongoose';

/**
 * GeneralTurn Schema
 * schema.sql의 general_turn 테이블
 */
export interface IGeneralTurnDocument extends Document {
  id: string;
  sessionId: string;
  generalId: string;
  turnIdx: number;
  action: string;
  arg?: Record<string, any>;
  brief?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GeneralTurnSchema = new Schema<IGeneralTurnDocument>(
  {
    sessionId: { type: String, required: true },
    generalId: { type: String, required: true },
    turnIdx: { type: Number, required: true },
    action: { type: String, required: true },
    arg: { type: Schema.Types.Mixed },
    brief: { type: String },
  },
  { timestamps: true }
);

// TODO: 인덱스 추가
GeneralTurnSchema.index({ sessionId: 1, generalId: 1, turnIdx: 1 });

export const GeneralTurnModel = model<IGeneralTurnDocument>('GeneralTurn', GeneralTurnSchema);
