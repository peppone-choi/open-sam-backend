import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Message represents an individual mail message.
 * 
 * Design:
 * - Linked to a MailBox via mailBoxId
 * - Supports both character and role addressing
 * - Tracks read status and timestamps
 */
export interface IGin7Message extends Document {
  messageId: string;
  sessionId: string;
  mailBoxId: string;     // Recipient's mailbox
  
  // Sender info
  senderId?: string;      // Character ID
  senderRoleId?: string;  // Role ID if sent as role
  senderName: string;     // Display name at send time
  
  // Recipient info
  recipientId?: string;
  recipientRoleId?: string;
  recipientName: string;
  
  // Content
  subject: string;
  body: string;
  
  // Status
  isRead: boolean;
  readAt?: Date;
  
  // Timestamps
  sentAt: Date;
  
  // Message type
  messageType: 'personal' | 'system' | 'broadcast' | 'diplomatic';
  
  // Attachments (optional)
  attachments?: Array<{
    type: string;        // 'item', 'gold', 'report', etc.
    data: Record<string, any>;
    claimed: boolean;
  }>;
  
  // Reply chain
  replyToId?: string;
  
  // Flags
  isArchived: boolean;
  isStarred: boolean;
  
  data: Record<string, any>;
}

const Gin7MessageSchema = new Schema<IGin7Message>({
  messageId: { type: String, required: true },
  sessionId: { type: String, required: true },
  mailBoxId: { type: String, required: true },
  
  senderId: { type: String },
  senderRoleId: { type: String },
  senderName: { type: String, required: true },
  
  recipientId: { type: String },
  recipientRoleId: { type: String },
  recipientName: { type: String, required: true },
  
  subject: { type: String, required: true, maxlength: 100 },
  body: { type: String, required: true, maxlength: 5000 },
  
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  
  sentAt: { type: Date, default: Date.now },
  
  messageType: { 
    type: String, 
    enum: ['personal', 'system', 'broadcast', 'diplomatic'],
    default: 'personal'
  },
  
  attachments: [{
    type: { type: String },
    data: Schema.Types.Mixed,
    claimed: { type: Boolean, default: false }
  }],
  
  replyToId: { type: String },
  
  isArchived: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
Gin7MessageSchema.index({ messageId: 1, sessionId: 1 }, { unique: true });
Gin7MessageSchema.index({ sessionId: 1, mailBoxId: 1, sentAt: -1 });
Gin7MessageSchema.index({ sessionId: 1, mailBoxId: 1, isRead: 1 });
Gin7MessageSchema.index({ sessionId: 1, senderId: 1, sentAt: -1 });

export const Gin7Message: Model<IGin7Message> = 
  mongoose.models.Gin7Message || mongoose.model<IGin7Message>('Gin7Message', Gin7MessageSchema);

