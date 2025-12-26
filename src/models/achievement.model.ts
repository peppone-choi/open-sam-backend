import mongoose, { Schema, Document } from 'mongoose';

export interface IAchievement extends Document {
  user_id: string;
  achievement_id: string; // 'first_unification', 'max_level', 'millionaire', etc.
  name: string;
  description: string;
  icon: string;
  points: number;
  earned_at: Date;
  metadata?: Record<string, any>;
}

const AchievementSchema = new Schema<IAchievement>({
  user_id: { type: String, required: true, index: true },
  achievement_id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String },
  points: { type: Number, default: 0 },
  earned_at: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'achievements'
});

AchievementSchema.index({ user_id: 1, achievement_id: 1 }, { unique: true });

export const Achievement = mongoose.models.Achievement || mongoose.model<IAchievement>('Achievement', AchievementSchema);
