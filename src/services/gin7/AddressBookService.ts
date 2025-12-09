/**
 * AddressBookService - 아드레스북(연락처) 시스템
 * 매뉴얼 626-641행 기반 구현
 *
 * 기능:
 * - 명함 교환으로 주소 획득
 * - 최대 100개 주소 제한
 * - 망명 시 아드레스북 초기화
 * - 주소 수동 삭제
 * - 연락처 검색 (이름, 이메일, 메모, 진영)
 * - 명함 교환 요청/수락 흐름
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../../common/logger';

// ============================================================
// Types & Models
// ============================================================

export interface IAddressEntry {
  entryId: string;
  characterId: string;
  characterName: string;
  factionId: string;
  rank?: string;
  position?: string;
  personalEmail: string;
  addedAt: Date;
  memo?: string;
}

export interface IAddressBook extends Document {
  addressBookId: string;
  sessionId: string;
  ownerCharacterId: string;
  ownerCharacterName: string;
  
  // 주소 목록 (최대 100개)
  entries: IAddressEntry[];
  
  // 메타데이터
  lastUpdatedAt: Date;
}

const AddressEntrySchema = new Schema<IAddressEntry>({
  entryId: { type: String, required: true },
  characterId: { type: String, required: true },
  characterName: { type: String, required: true },
  factionId: { type: String, required: true },
  rank: { type: String },
  position: { type: String },
  personalEmail: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
  memo: { type: String },
}, { _id: false });

const AddressBookSchema = new Schema<IAddressBook>({
  addressBookId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  ownerCharacterId: { type: String, required: true, index: true },
  ownerCharacterName: { type: String, required: true },
  entries: [AddressEntrySchema],
  lastUpdatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'address_books',
});

// 복합 인덱스
AddressBookSchema.index({ sessionId: 1, ownerCharacterId: 1 }, { unique: true });

export const AddressBook: Model<IAddressBook> = mongoose.models.AddressBook as Model<IAddressBook> ||
  mongoose.model<IAddressBook>('AddressBook', AddressBookSchema);

// ============================================================
// Constants
// ============================================================

const MAX_ADDRESS_ENTRIES = 100;

// ============================================================
// Request Types
// ============================================================

export interface ExchangeCardsRequest {
  sessionId: string;
  requesterId: string;
  requesterName: string;
  requesterFactionId: string;
  requesterRank?: string;
  requesterPosition?: string;
  requesterEmail: string;
  targetId: string;
  targetName: string;
  targetFactionId: string;
  targetRank?: string;
  targetPosition?: string;
  targetEmail: string;
}

export interface AddAddressRequest {
  sessionId: string;
  ownerCharacterId: string;
  entry: {
    characterId: string;
    characterName: string;
    factionId: string;
    rank?: string;
    position?: string;
    personalEmail: string;
    memo?: string;
  };
}

// ============================================================
// AddressBookService Class
// ============================================================

export class AddressBookService extends EventEmitter {
  private static instance: AddressBookService;

  private constructor() {
    super();
    logger.info('[AddressBookService] Initialized');
  }

  public static getInstance(): AddressBookService {
    if (!AddressBookService.instance) {
      AddressBookService.instance = new AddressBookService();
    }
    return AddressBookService.instance;
  }

  // ============================================================
  // 아드레스북 생성/조회
  // ============================================================

  /**
   * 아드레스북 조회 또는 생성
   */
  public async getOrCreateAddressBook(
    sessionId: string,
    characterId: string,
    characterName: string,
  ): Promise<IAddressBook> {
    let addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId: characterId,
    });

    if (!addressBook) {
      addressBook = await AddressBook.create({
        addressBookId: `ADDR-${uuidv4().slice(0, 8)}`,
        sessionId,
        ownerCharacterId: characterId,
        ownerCharacterName: characterName,
        entries: [],
        lastUpdatedAt: new Date(),
      });
      
      logger.info(`[AddressBookService] Created address book for ${characterName}`);
    }

    return addressBook;
  }

  /**
   * 아드레스북 조회
   */
  public async getAddressBook(
    sessionId: string,
    characterId: string,
  ): Promise<IAddressBook | null> {
    return AddressBook.findOne({
      sessionId,
      ownerCharacterId: characterId,
    }).lean() as unknown as IAddressBook | null;
  }

  // ============================================================
  // 명함 교환
  // ============================================================

  /**
   * 명함 교환 (양방향)
   * 매뉴얼: "이 커맨드를 실행하면 채팅 중인 상대에게 캐릭터 개인의 메일 주소가 전송됩니다"
   */
  public async exchangeCards(request: ExchangeCardsRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    const {
      sessionId,
      requesterId, requesterName, requesterFactionId, requesterRank, requesterPosition, requesterEmail,
      targetId, targetName, targetFactionId, targetRank, targetPosition, targetEmail,
    } = request;

    // 양쪽 아드레스북에 추가
    const result1 = await this.addAddress({
      sessionId,
      ownerCharacterId: requesterId,
      entry: {
        characterId: targetId,
        characterName: targetName,
        factionId: targetFactionId,
        rank: targetRank,
        position: targetPosition,
        personalEmail: targetEmail,
      },
    });

    const result2 = await this.addAddress({
      sessionId,
      ownerCharacterId: targetId,
      entry: {
        characterId: requesterId,
        characterName: requesterName,
        factionId: requesterFactionId,
        rank: requesterRank,
        position: requesterPosition,
        personalEmail: requesterEmail,
      },
    });

    if (!result1.success) {
      return { success: false, error: `요청자 아드레스북: ${result1.error}` };
    }
    if (!result2.success) {
      return { success: false, error: `대상자 아드레스북: ${result2.error}` };
    }

    this.emit('cards:exchanged', {
      sessionId,
      requesterId,
      requesterName,
      targetId,
      targetName,
    });

    logger.info(`[AddressBookService] Cards exchanged: ${requesterName} <-> ${targetName}`);

    return { success: true };
  }

  /**
   * 주소 추가
   */
  public async addAddress(request: AddAddressRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { sessionId, ownerCharacterId, entry } = request;

    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId,
    });

    if (!addressBook) {
      return { success: false, error: '아드레스북을 찾을 수 없습니다.' };
    }

    // 최대 개수 확인
    if (addressBook.entries.length >= MAX_ADDRESS_ENTRIES) {
      return {
        success: false,
        error: `아드레스북이 가득 찼습니다. (최대 ${MAX_ADDRESS_ENTRIES}개)`,
      };
    }

    // 이미 등록된 주소인지 확인
    const existing = addressBook.entries.find(e => e.characterId === entry.characterId);
    if (existing) {
      // 정보 업데이트
      existing.characterName = entry.characterName;
      existing.rank = entry.rank;
      existing.position = entry.position;
      existing.personalEmail = entry.personalEmail;
    } else {
      // 새 항목 추가
      addressBook.entries.push({
        entryId: `ENT-${uuidv4().slice(0, 8)}`,
        ...entry,
        addedAt: new Date(),
      });
    }

    addressBook.lastUpdatedAt = new Date();
    await addressBook.save();

    return { success: true };
  }

  // ============================================================
  // 주소 삭제
  // ============================================================

  /**
   * 주소 삭제
   * 매뉴얼: "플레이어는 임의로 등록한 주소를 삭제할 수 있습니다"
   */
  public async removeAddress(
    sessionId: string,
    ownerCharacterId: string,
    targetCharacterId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await AddressBook.updateOne(
      { sessionId, ownerCharacterId },
      {
        $pull: { entries: { characterId: targetCharacterId } },
        $set: { lastUpdatedAt: new Date() },
      },
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: '주소를 찾을 수 없습니다.' };
    }

    this.emit('address:removed', {
      sessionId,
      ownerCharacterId,
      targetCharacterId,
    });

    return { success: true };
  }

  /**
   * 메모 업데이트
   */
  public async updateMemo(
    sessionId: string,
    ownerCharacterId: string,
    targetCharacterId: string,
    memo: string,
  ): Promise<{ success: boolean; error?: string }> {
    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId,
    });

    if (!addressBook) {
      return { success: false, error: '아드레스북을 찾을 수 없습니다.' };
    }

    const entry = addressBook.entries.find(e => e.characterId === targetCharacterId);
    if (!entry) {
      return { success: false, error: '주소를 찾을 수 없습니다.' };
    }

    entry.memo = memo;
    addressBook.lastUpdatedAt = new Date();
    await addressBook.save();

    return { success: true };
  }

  // ============================================================
  // 망명 시 초기화
  // ============================================================

  /**
   * 아드레스북 초기화 (망명 시)
   * 매뉴얼: "망명에 의해 캐릭터의 소속 세력이 변화한 경우, 그 캐릭터의 아드레스북에 등록된 메일 주소는 모두 삭제됩니다"
   */
  public async clearAddressBookOnDefection(
    sessionId: string,
    characterId: string,
  ): Promise<void> {
    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId: characterId,
    });

    if (addressBook) {
      const previousCount = addressBook.entries.length;
      addressBook.entries = [];
      addressBook.lastUpdatedAt = new Date();
      await addressBook.save();

      this.emit('addressBook:cleared', {
        sessionId,
        characterId,
        previousCount,
        reason: 'defection',
      });

      logger.info(`[AddressBookService] Address book cleared for ${characterId} (defection)`);
    }
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 특정 캐릭터의 주소가 등록되어 있는지 확인
   */
  public async hasAddress(
    sessionId: string,
    ownerCharacterId: string,
    targetCharacterId: string,
  ): Promise<boolean> {
    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId,
      'entries.characterId': targetCharacterId,
    }).lean();

    return !!addressBook;
  }

  /**
   * 주소 검색
   */
  public async searchAddresses(
    sessionId: string,
    ownerCharacterId: string,
    query: string,
  ): Promise<IAddressEntry[]> {
    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId,
    }).lean();

    if (!addressBook) return [];

    const lowerQuery = query.toLowerCase();
    return addressBook.entries.filter(entry =>
      entry.characterName.toLowerCase().includes(lowerQuery) ||
      entry.personalEmail.toLowerCase().includes(lowerQuery) ||
      entry.memo?.toLowerCase().includes(lowerQuery),
    );
  }

  // ============================================================
  // 확장된 검색
  // ============================================================

  /**
   * 연락처 고급 검색
   * 이름, 이메일, 메모, 진영, 직책 필터링 지원
   */
  public async searchContacts(
    sessionId: string,
    ownerCharacterId: string,
    options: {
      query?: string;
      factionId?: string;
      hasPosition?: boolean;
      sortBy?: 'name' | 'addedAt' | 'rank';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
    },
  ): Promise<IAddressEntry[]> {
    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId,
    }).lean();

    if (!addressBook) return [];

    let results = [...addressBook.entries];

    // 텍스트 검색
    if (options.query) {
      const lowerQuery = options.query.toLowerCase();
      results = results.filter(entry =>
        entry.characterName.toLowerCase().includes(lowerQuery) ||
        entry.personalEmail.toLowerCase().includes(lowerQuery) ||
        entry.memo?.toLowerCase().includes(lowerQuery) ||
        entry.position?.toLowerCase().includes(lowerQuery) ||
        entry.rank?.toLowerCase().includes(lowerQuery),
      );
    }

    // 진영 필터
    if (options.factionId) {
      results = results.filter(entry => entry.factionId === options.factionId);
    }

    // 직책 보유자만
    if (options.hasPosition) {
      results = results.filter(entry => entry.position);
    }

    // 정렬
    const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
    switch (options.sortBy) {
      case 'name':
        results.sort((a, b) => sortOrder * a.characterName.localeCompare(b.characterName));
        break;
      case 'addedAt':
        results.sort((a, b) => sortOrder * (new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()));
        break;
      case 'rank':
        results.sort((a, b) => sortOrder * ((a.rank || '').localeCompare(b.rank || '')));
        break;
    }

    // 개수 제한
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 진영별 연락처 그룹화
   */
  public async getContactsByFaction(
    sessionId: string,
    ownerCharacterId: string,
  ): Promise<Map<string, IAddressEntry[]>> {
    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId,
    }).lean();

    const grouped = new Map<string, IAddressEntry[]>();
    if (!addressBook) return grouped;

    for (const entry of addressBook.entries) {
      const factionId = entry.factionId || 'unknown';
      if (!grouped.has(factionId)) {
        grouped.set(factionId, []);
      }
      grouped.get(factionId)!.push(entry);
    }

    return grouped;
  }

  // ============================================================
  // 명함 교환 요청 흐름
  // ============================================================

  // 대기 중인 명함 교환 요청 (sessionId:requestId -> request)
  private pendingExchangeRequests: Map<string, {
    requesterId: string;
    requesterName: string;
    targetId: string;
    targetName: string;
    expiresAt: Date;
  }> = new Map();

  /**
   * 명함 교환 요청 생성
   * 상대방의 수락을 기다림
   */
  public async requestCardExchange(
    sessionId: string,
    requesterId: string,
    requesterName: string,
    targetId: string,
    targetName: string,
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    // 이미 등록된 연락처인지 확인
    const hasContact = await this.hasAddress(sessionId, requesterId, targetId);
    if (hasContact) {
      return { success: false, error: '이미 등록된 연락처입니다.' };
    }

    // 요청 ID 생성
    const requestId = `EXCH-${uuidv4().slice(0, 8)}`;
    const key = `${sessionId}:${requestId}`;

    // 요청 저장 (5분 만료)
    this.pendingExchangeRequests.set(key, {
      requesterId,
      requesterName,
      targetId,
      targetName,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // 이벤트 발생 (대상에게 알림)
    this.emit('cardExchange:requested', {
      sessionId,
      requestId,
      requesterId,
      requesterName,
      targetId,
      targetName,
    });

    logger.info(`[AddressBookService] Card exchange requested: ${requesterName} -> ${targetName}`);

    return { success: true, requestId };
  }

  /**
   * 명함 교환 요청 수락
   */
  public async acceptCardExchange(
    sessionId: string,
    requestId: string,
    requesterFactionId: string,
    requesterRank?: string,
    requesterPosition?: string,
    requesterEmail?: string,
    targetFactionId?: string,
    targetRank?: string,
    targetPosition?: string,
    targetEmail?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const key = `${sessionId}:${requestId}`;
    const request = this.pendingExchangeRequests.get(key);

    if (!request) {
      return { success: false, error: '명함 교환 요청을 찾을 수 없거나 만료되었습니다.' };
    }

    if (new Date() > request.expiresAt) {
      this.pendingExchangeRequests.delete(key);
      return { success: false, error: '명함 교환 요청이 만료되었습니다.' };
    }

    // 양방향 명함 교환 실행
    const result = await this.exchangeCards({
      sessionId,
      requesterId: request.requesterId,
      requesterName: request.requesterName,
      requesterFactionId,
      requesterRank,
      requesterPosition,
      requesterEmail: requesterEmail || `${request.requesterId}@mail.game`,
      targetId: request.targetId,
      targetName: request.targetName,
      targetFactionId: targetFactionId || requesterFactionId,
      targetRank,
      targetPosition,
      targetEmail: targetEmail || `${request.targetId}@mail.game`,
    });

    // 요청 제거
    this.pendingExchangeRequests.delete(key);

    if (result.success) {
      this.emit('cardExchange:accepted', {
        sessionId,
        requestId,
        requesterId: request.requesterId,
        targetId: request.targetId,
      });
    }

    return result;
  }

  /**
   * 명함 교환 요청 거절
   */
  public async rejectCardExchange(
    sessionId: string,
    requestId: string,
    targetId: string,
  ): Promise<{ success: boolean }> {
    const key = `${sessionId}:${requestId}`;
    const request = this.pendingExchangeRequests.get(key);

    if (!request || request.targetId !== targetId) {
      return { success: false };
    }

    this.pendingExchangeRequests.delete(key);

    this.emit('cardExchange:rejected', {
      sessionId,
      requestId,
      requesterId: request.requesterId,
      targetId,
    });

    logger.info(`[AddressBookService] Card exchange rejected by ${request.targetName}`);

    return { success: true };
  }

  /**
   * 만료된 요청 정리
   */
  public cleanupExpiredRequests(): void {
    const now = new Date();
    for (const [key, request] of this.pendingExchangeRequests.entries()) {
      if (now > request.expiresAt) {
        this.pendingExchangeRequests.delete(key);
      }
    }
  }

  // ============================================================
  // 망명 시 초기화 확장
  // ============================================================

  /**
   * 망명 시 연락처 정리
   * 매뉴얼: 망명 시 아드레스북 전체 삭제 + 다른 사람의 아드레스북에서도 제거
   */
  public async handleDefection(
    sessionId: string,
    characterId: string,
    newFactionId: string,
  ): Promise<void> {
    // 1. 본인 아드레스북 초기화
    await this.clearAddressBookOnDefection(sessionId, characterId);

    // 2. 다른 사람의 아드레스북에서 이 캐릭터 제거 (선택적)
    const result = await AddressBook.updateMany(
      { sessionId, 'entries.characterId': characterId },
      {
        $pull: { entries: { characterId } },
        $set: { lastUpdatedAt: new Date() },
      },
    );

    if (result.modifiedCount > 0) {
      this.emit('defection:contactsRemoved', {
        sessionId,
        characterId,
        removedFromCount: result.modifiedCount,
      });

      logger.info(`[AddressBookService] Removed ${characterId} from ${result.modifiedCount} address books (defection)`);
    }
  }

  // ============================================================
  // 통계
  // ============================================================

  /**
   * 아드레스북 통계 조회
   */
  public async getStatistics(
    sessionId: string,
    ownerCharacterId: string,
  ): Promise<{
    totalContacts: number;
    byFaction: Record<string, number>;
    recentlyAdded: number;
    capacity: number;
    remaining: number;
  }> {
    const addressBook = await AddressBook.findOne({
      sessionId,
      ownerCharacterId,
    }).lean();

    if (!addressBook) {
      return {
        totalContacts: 0,
        byFaction: {},
        recentlyAdded: 0,
        capacity: MAX_ADDRESS_ENTRIES,
        remaining: MAX_ADDRESS_ENTRIES,
      };
    }

    const byFaction: Record<string, number> = {};
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let recentlyAdded = 0;

    for (const entry of addressBook.entries) {
      // 진영별 카운트
      const factionId = entry.factionId || 'unknown';
      byFaction[factionId] = (byFaction[factionId] || 0) + 1;

      // 최근 추가
      if (new Date(entry.addedAt) > oneWeekAgo) {
        recentlyAdded++;
      }
    }

    return {
      totalContacts: addressBook.entries.length,
      byFaction,
      recentlyAdded,
      capacity: MAX_ADDRESS_ENTRIES,
      remaining: MAX_ADDRESS_ENTRIES - addressBook.entries.length,
    };
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    // 해당 세션의 대기 요청 정리
    for (const key of this.pendingExchangeRequests.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.pendingExchangeRequests.delete(key);
      }
    }

    logger.info(`[AddressBookService] Cleaned up session: ${sessionId}`);
  }
}

export const addressBookService = AddressBookService.getInstance();
export default AddressBookService;

