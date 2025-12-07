import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGin7User extends Document {
  userId: string;
  username: string;
  email?: string;
  
  // Access Control
  role: 'admin' | 'user' | 'guest';
  isBanned: boolean;

  // Global Preferences
  preferences: {
    theme?: string;
    notifications?: boolean;
    [key: string]: any;
  };

  // Meta
  lastLogin: Date;
  data: Record<string, any>;
}

const Gin7UserSchema = new Schema<IGin7User>({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  email: { type: String },
  
  role: { type: String, enum: ['admin', 'user', 'guest'], default: 'user' },
  isBanned: { type: Boolean, default: false },

  preferences: { type: Schema.Types.Mixed, default: {} },

  lastLogin: { type: Date, default: Date.now },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
Gin7UserSchema.index({ userId: 1 }); // Primary lookup
Gin7UserSchema.index({ username: 1 }, { unique: true }); // Login lookup
Gin7UserSchema.index({ email: 1 }, { sparse: true }); // Optional email lookup
Gin7UserSchema.index({ role: 1, isBanned: 1 }); // Admin queries

export const Gin7User: Model<IGin7User> = 
  mongoose.models.Gin7User || mongoose.model<IGin7User>('Gin7User', Gin7UserSchema);

