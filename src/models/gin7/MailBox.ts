import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * MailBox represents a character's or role's mailbox.
 * 
 * Design:
 * - Can belong to a character (characterId) or a role/position (roleId)
 * - Role-based mailboxes route to current holder of that position
 * - Capacity limit with auto-cleanup of old read messages
 */
export interface IGin7MailBox extends Document {
  mailBoxId: string;
  sessionId: string;
  
  // Owner - either character or role (one must be set)
  characterId?: string;
  roleId?: string;       // e.g., 'FACTION_LEADER_WEI', 'CITY_GOVERNOR_LUOYANG'
  
  // Configuration
  capacity: number;      // Default 120
  
  // Statistics
  unreadCount: number;
  totalCount: number;
  
  // Metadata
  label?: string;        // Display name
  
  data: Record<string, any>;
}

const Gin7MailBoxSchema = new Schema<IGin7MailBox>({
  mailBoxId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  characterId: { type: String, sparse: true },
  roleId: { type: String, sparse: true },
  
  capacity: { type: Number, default: 120 },
  
  unreadCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  
  label: { type: String },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
Gin7MailBoxSchema.index({ mailBoxId: 1, sessionId: 1 }, { unique: true });
Gin7MailBoxSchema.index({ sessionId: 1, characterId: 1 });
Gin7MailBoxSchema.index({ sessionId: 1, roleId: 1 });

export const Gin7MailBox: Model<IGin7MailBox> = 
  mongoose.models.Gin7MailBox || mongoose.model<IGin7MailBox>('Gin7MailBox', Gin7MailBoxSchema);

