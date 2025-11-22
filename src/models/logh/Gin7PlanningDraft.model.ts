import mongoose, { Document, Model, Schema } from 'mongoose';

export type Gin7PlanObjective = 'occupy' | 'defend' | 'sweep';
export type Gin7PlanStatus = 'draft' | 'issued' | 'active' | 'completed';

export interface IGin7PlanningDraft extends Document {
  session_id: string;
  characterId: string;
  planId: string;
  objective: Gin7PlanObjective;
  target: string;
  plannedStart?: string;
  participants: string[];
  status: Gin7PlanStatus;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const Gin7PlanningDraftSchema = new Schema<IGin7PlanningDraft>(
  {
    session_id: { type: String, required: true, index: true },
    characterId: { type: String, required: true, index: true },
    planId: { type: String, required: true },
    objective: {
      type: String,
      enum: ['occupy', 'defend', 'sweep'],
      default: 'occupy',
    },
    target: { type: String, required: true },
    plannedStart: { type: String },
    participants: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['draft', 'issued', 'active', 'completed'],
      default: 'draft',
    },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

Gin7PlanningDraftSchema.index({ session_id: 1, characterId: 1, planId: 1 }, { unique: true });

export const Gin7PlanningDraft: Model<IGin7PlanningDraft> =
  (mongoose.models.Gin7PlanningDraft as Model<IGin7PlanningDraft>) ||
  mongoose.model<IGin7PlanningDraft>('Gin7PlanningDraft', Gin7PlanningDraftSchema);
