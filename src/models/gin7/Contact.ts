import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Contact represents an entry in a character's address book.
 * 
 * Design:
 * - Characters exchange "business cards" to add contacts
 * - Allows custom nicknames for contacts
 * - Can block/favorite contacts
 */
export interface IGin7Contact extends Document {
  contactEntryId: string;
  sessionId: string;
  
  // Owner of this address book entry
  ownerId: string;
  
  // Contact info
  contactId: string;      // Character ID of the contact
  contactName: string;    // Name when added
  nickname?: string;      // Custom nickname set by owner
  
  // Status
  isFavorite: boolean;
  isBlocked: boolean;
  
  // When the contact was added
  addedAt: Date;
  
  // Notes
  notes?: string;
  
  data: Record<string, any>;
}

const Gin7ContactSchema = new Schema<IGin7Contact>({
  contactEntryId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  ownerId: { type: String, required: true },
  
  contactId: { type: String, required: true },
  contactName: { type: String, required: true },
  nickname: { type: String },
  
  isFavorite: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  
  addedAt: { type: Date, default: Date.now },
  
  notes: { type: String, maxlength: 500 },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
Gin7ContactSchema.index({ contactEntryId: 1, sessionId: 1 }, { unique: true });
Gin7ContactSchema.index({ sessionId: 1, ownerId: 1, contactId: 1 }, { unique: true });
Gin7ContactSchema.index({ sessionId: 1, ownerId: 1, isFavorite: -1 });

export const Gin7Contact: Model<IGin7Contact> = 
  mongoose.models.Gin7Contact || mongoose.model<IGin7Contact>('Gin7Contact', Gin7ContactSchema);

