import { Schema, model, Document } from 'mongoose';

export interface ITroopDocument extends Document {
  sessionId: string;
  troopLeader: string; // General ID
  nation: string;
  name: string;
}

const TroopSchema = new Schema<ITroopDocument>(
  {
    sessionId: { type: String, required: true },
    troopLeader: { type: String, required: true },
    nation: { type: String, required: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

TroopSchema.index({ sessionId: 1, troopLeader: 1 });

export const TroopModel = model<ITroopDocument>('Troop', TroopSchema);
