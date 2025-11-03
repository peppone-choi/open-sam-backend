// Re-export from core/message
export { Message } from '../core/message/Message';
export { MessageTarget } from '../core/message/MessageTarget';
export { DiplomaticMessage } from '../core/message/DiplomaticMessage';

// Legacy exports for compatibility
export const MessageType = {
  public: 9999,
  national: 9000,
  diplomacy: 8000,
  private: 1,
  general: 1,
};
