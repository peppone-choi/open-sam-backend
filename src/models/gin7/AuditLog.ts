import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction = 
  | 'USER_BAN'
  | 'USER_UNBAN'
  | 'USER_WARN'
  | 'USER_MUTE'
  | 'USER_UNMUTE'
  | 'CARD_GRANT'
  | 'CARD_REVOKE'
  | 'RESOURCE_ADD'
  | 'RESOURCE_REMOVE'
  | 'FORCE_MOVE'
  | 'FORCE_LOGOUT'
  | 'ROLE_CHANGE'
  | 'SESSION_MODIFY'
  | 'CONFIG_CHANGE';

export interface IAuditLog extends Document {
  // Who performed the action
  adminId: string;
  adminUsername: string;
  
  // What action was performed
  action: AuditAction;
  category: 'user' | 'card' | 'resource' | 'session' | 'config';
  
  // Target of the action
  targetId?: string;
  targetType?: 'user' | 'character' | 'session' | 'system';
  
  // Change details
  before?: Record<string, any>;
  after?: Record<string, any>;
  
  // Context
  reason?: string;
  metadata?: Record<string, any>;
  
  // Request info
  ipAddress?: string;
  userAgent?: string;
  
  // Timestamp
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  adminId: { type: String, required: true, index: true },
  adminUsername: { type: String, required: true },
  
  action: { 
    type: String, 
    required: true,
    enum: [
      'USER_BAN', 'USER_UNBAN', 'USER_WARN', 'USER_MUTE', 'USER_UNMUTE',
      'CARD_GRANT', 'CARD_REVOKE',
      'RESOURCE_ADD', 'RESOURCE_REMOVE',
      'FORCE_MOVE', 'FORCE_LOGOUT',
      'ROLE_CHANGE', 'SESSION_MODIFY', 'CONFIG_CHANGE'
    ],
    index: true
  },
  category: { 
    type: String, 
    required: true, 
    enum: ['user', 'card', 'resource', 'session', 'config'],
    index: true
  },
  
  targetId: { type: String, index: true },
  targetType: { type: String, enum: ['user', 'character', 'session', 'system'] },
  
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  
  reason: { type: String },
  metadata: { type: Schema.Types.Mixed },
  
  ipAddress: { type: String },
  userAgent: { type: String },
  
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: false // We use our own timestamp field
});

// Compound indexes for common queries
AuditLogSchema.index({ timestamp: -1, action: 1 });
AuditLogSchema.index({ targetId: 1, timestamp: -1 });
AuditLogSchema.index({ adminId: 1, timestamp: -1 });
AuditLogSchema.index({ category: 1, timestamp: -1 });

// TTL index: 자동 삭제 (90일 후)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Helper static methods
AuditLogSchema.statics.logAction = async function(
  adminId: string,
  adminUsername: string,
  action: AuditAction,
  options: {
    category: IAuditLog['category'];
    targetId?: string;
    targetType?: IAuditLog['targetType'];
    before?: Record<string, any>;
    after?: Record<string, any>;
    reason?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<IAuditLog> {
  return this.create({
    adminId,
    adminUsername,
    action,
    ...options,
    timestamp: new Date()
  });
};

export interface IAuditLogModel extends Model<IAuditLog> {
  logAction(
    adminId: string,
    adminUsername: string,
    action: AuditAction,
    options: {
      category: IAuditLog['category'];
      targetId?: string;
      targetType?: IAuditLog['targetType'];
      before?: Record<string, any>;
      after?: Record<string, any>;
      reason?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<IAuditLog>;
}

export const AuditLog: IAuditLogModel = 
  (mongoose.models.AuditLog as IAuditLogModel) || mongoose.model<IAuditLog, IAuditLogModel>('AuditLog', AuditLogSchema);

