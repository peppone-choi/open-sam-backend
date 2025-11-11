#!/bin/bash

# nation-turn.repository.ts
sed -i '/^export const nationTurnRepository/i \
  /**\n   * 세션의 모든 국가턴 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return NationTurn.deleteMany({ session_id: sessionId });\n  }\n' nation-turn.repository.ts

# general-record.repository.ts  
sed -i '/^export const generalRecordRepository/i \
  /**\n   * 세션의 모든 장수 기록 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return GeneralRecord.deleteMany({ session_id: sessionId });\n  }\n' general-record.repository.ts

# kvstorage.repository.ts
sed -i '/^export const kvStorageRepository/i \
  /**\n   * 세션의 모든 KV 스토리지 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return IKVStorage.deleteMany({ session_id: sessionId });\n  }\n' kvstorage.repository.ts

# battle.repository.ts
sed -i '/^export const battleRepository/i \
  /**\n   * 세션의 모든 전투 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return Battle.deleteMany({ session_id: sessionId });\n  }\n' battle.repository.ts

# diplomacy.repository.ts
sed -i '/^export const diplomacyRepository/i \
  /**\n   * 세션의 모든 외교 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return Diplomacy.deleteMany({ session_id: sessionId });\n  }\n' diplomacy.repository.ts

# auction.repository.ts
sed -i '/^export const auctionRepository/i \
  /**\n   * 세션의 모든 경매 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return Auction.deleteMany({ session_id: sessionId });\n  }\n' auction.repository.ts

# betting.repository.ts
sed -i '/^export const bettingRepository/i \
  /**\n   * 세션의 모든 베팅 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return await model.deleteMany({ session_id: sessionId });\n  }\n' betting.repository.ts

# ng-diplomacy.repository.ts
sed -i '/^export const ngDiplomacyRepository/i \
  /**\n   * 세션의 모든 NG 외교 삭제\n   */\n  async deleteBySession(sessionId: string) {\n    return NgDiplomacy.deleteMany({ session_id: sessionId });\n  }\n' ng-diplomacy.repository.ts

echo "✅ All repositories updated"
