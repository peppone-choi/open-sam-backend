/**
 * SpotService - 스팟(위치) 시스템
 * 매뉴얼 668-676행 기반 구현
 *
 * 스팟: 게임상 캐릭터의 소재를 나타내는 구역
 * - 자택 (Home)
 * - 호텔 (Hotel)
 * - 회의실 (Conference Room)
 * - 술집/주점 (Bar)
 * - 기함 (Flagship)
 * - 행성 시설 (Planetary Facilities)
 * - 요새 시설 (Fortress Facilities)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

export enum SpotType {
  // 주거 시설
  HOME = 'HOME',                       // 자택
  HOTEL_ROOM = 'HOTEL_ROOM',           // 호텔 객실
  RESIDENCE = 'RESIDENCE',             // 거주구 자실
  
  // 공공 시설
  BAR = 'BAR',                         // 술집/주점
  RESTAURANT = 'RESTAURANT',           // 음식점
  CONFERENCE_ROOM = 'CONFERENCE_ROOM', // 회의실
  LOBBY = 'LOBBY',                     // 로비
  
  // 군사 시설
  FLAGSHIP = 'FLAGSHIP',               // 기함 내부
  BRIDGE = 'BRIDGE',                   // 함교
  HEADQUARTERS = 'HEADQUARTERS',       // 사령부
  BARRACKS = 'BARRACKS',               // 병영
  
  // 행정 시설
  GOVERNMENT_OFFICE = 'GOVERNMENT_OFFICE', // 관공서
  PALACE = 'PALACE',                       // 황궁
  COUNCIL_HALL = 'COUNCIL_HALL',           // 평의회장
  
  // 기타 시설
  SHIPYARD = 'SHIPYARD',               // 조선소
  WAREHOUSE = 'WAREHOUSE',             // 창고
  HOSPITAL = 'HOSPITAL',               // 병원
  ACADEMY = 'ACADEMY',                 // 사관학교
  PRISON = 'PRISON',                   // 수용소
  
  // 이동 중
  IN_TRANSIT = 'IN_TRANSIT',           // 이동 중
  IN_SPACE = 'IN_SPACE',               // 우주 공간
}

export interface ISpot extends Document {
  spotId: string;
  sessionId: string;
  name: string;
  type: SpotType;
  
  // 위치 정보
  planetId?: string;
  fortressId?: string;
  shipId?: string;
  gridId?: string;
  
  // 소유/접근 제한
  ownerId?: string;          // 개인 소유 시 (자택 등)
  factionId?: string;        // 진영 제한
  rankRequired?: string;     // 필요 계급
  positionRequired?: string; // 필요 직위
  
  // 용량
  capacity: number;          // 최대 수용 인원
  currentOccupants: string[]; // 현재 있는 캐릭터 ID 목록
  
  // 메타데이터
  isPublic: boolean;
  description?: string;
  data: Record<string, any>;
}

const SpotSchema = new Schema<ISpot>({
  spotId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: Object.values(SpotType), required: true },
  
  planetId: { type: String, index: true },
  fortressId: { type: String, index: true },
  shipId: { type: String, index: true },
  gridId: { type: String, index: true },
  
  ownerId: { type: String, index: true },
  factionId: { type: String },
  rankRequired: { type: String },
  positionRequired: { type: String },
  
  capacity: { type: Number, default: 50 },
  currentOccupants: [{ type: String }],
  
  isPublic: { type: Boolean, default: true },
  description: { type: String },
  data: { type: Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
  collection: 'spots',
});

// 인덱스
SpotSchema.index({ sessionId: 1, planetId: 1 });
SpotSchema.index({ sessionId: 1, fortressId: 1 });
SpotSchema.index({ sessionId: 1, shipId: 1 });
SpotSchema.index({ sessionId: 1, type: 1 });

export const Spot: Model<ISpot> = mongoose.models.Spot as Model<ISpot> || mongoose.model<ISpot>('Spot', SpotSchema);

// ============================================================
// Character Location Tracking
// ============================================================

export interface CharacterSpotInfo {
  characterId: string;
  characterName: string;
  spotId: string;
  enteredAt: Date;
}

// ============================================================
// Request Types
// ============================================================

export interface MoveToSpotRequest {
  sessionId: string;
  characterId: string;
  characterName: string;
  targetSpotId: string;
  isShortDistance: boolean; // 근거리(같은 시설 내) vs 원거리(시설 간)
}

export interface CreateSpotRequest {
  sessionId: string;
  name: string;
  type: SpotType;
  planetId?: string;
  fortressId?: string;
  shipId?: string;
  gridId?: string;
  ownerId?: string;
  factionId?: string;
  capacity?: number;
  isPublic?: boolean;
}

// ============================================================
// SpotService Class
// ============================================================

export class SpotService extends EventEmitter {
  private static instance: SpotService;
  
  // 캐릭터 현재 스팟 추적 (sessionId:characterId -> spotId)
  private characterSpots: Map<string, string> = new Map();
  
  // CP 비용
  private readonly SHORT_DISTANCE_CP = 5;  // 근거리 이동 CP
  private readonly LONG_DISTANCE_CP = 10;  // 원거리 이동 CP

  private constructor() {
    super();
    logger.info('[SpotService] Initialized');
  }

  public static getInstance(): SpotService {
    if (!SpotService.instance) {
      SpotService.instance = new SpotService();
    }
    return SpotService.instance;
  }

  // ============================================================
  // 스팟 생성/조회
  // ============================================================

  /**
   * 스팟 생성
   */
  public async createSpot(request: CreateSpotRequest): Promise<ISpot> {
    const spot = await Spot.create({
      spotId: `SPOT-${uuidv4().slice(0, 8)}`,
      ...request,
      currentOccupants: [],
      data: {},
    });
    
    logger.info(`[SpotService] Spot created: ${spot.name} (${spot.type})`);
    return spot;
  }

  /**
   * 스팟 조회
   */
  public async getSpot(spotId: string): Promise<ISpot | null> {
    return Spot.findOne({ spotId }).lean() as unknown as ISpot | null;
  }

  /**
   * 행성의 스팟 목록
   */
  public async getPlanetSpots(sessionId: string, planetId: string): Promise<ISpot[]> {
    return Spot.find({ sessionId, planetId }).lean() as unknown as ISpot[];
  }

  /**
   * 요새의 스팟 목록
   */
  public async getFortressSpots(sessionId: string, fortressId: string): Promise<ISpot[]> {
    return Spot.find({ sessionId, fortressId }).lean() as unknown as ISpot[];
  }

  /**
   * 함선의 스팟 목록
   */
  public async getShipSpots(sessionId: string, shipId: string): Promise<ISpot[]> {
    return Spot.find({ sessionId, shipId }).lean() as unknown as ISpot[];
  }

  /**
   * 캐릭터의 자택 스팟 조회/생성
   */
  public async getOrCreateHomeSpot(
    sessionId: string,
    characterId: string,
    characterName: string,
    planetId: string,
  ): Promise<ISpot> {
    let home = await Spot.findOne({
      sessionId,
      type: SpotType.HOME,
      ownerId: characterId,
    }) as ISpot | null;
    
    if (!home) {
      home = await this.createSpot({
        sessionId,
        name: `${characterName}의 자택`,
        type: SpotType.HOME,
        planetId,
        ownerId: characterId,
        capacity: 5,
        isPublic: false,
      }) as ISpot;
    }
    
    return home as ISpot;
  }

  // ============================================================
  // 스팟 이동
  // ============================================================

  /**
   * 스팟 이동
   * 매뉴얼: 근거리 이동(같은 시설 내), 원거리 이동(시설 간)
   */
  public async moveToSpot(request: MoveToSpotRequest): Promise<{
    success: boolean;
    cpCost?: number;
    error?: string;
  }> {
    const { sessionId, characterId, characterName, targetSpotId, isShortDistance } = request;
    
    // 1. 대상 스팟 확인
    const targetSpot = await Spot.findOne({ spotId: targetSpotId });
    if (!targetSpot) {
      return { success: false, error: '스팟을 찾을 수 없습니다.' };
    }
    
    // 2. 접근 권한 확인
    const accessCheck = await this.checkAccess(sessionId, characterId, targetSpot);
    if (!accessCheck.allowed) {
      return { success: false, error: accessCheck.reason };
    }
    
    // 3. 수용 인원 확인
    if (targetSpot.currentOccupants.length >= targetSpot.capacity) {
      return { success: false, error: '스팟이 가득 찼습니다.' };
    }
    
    // 4. 현재 스팟에서 제거
    const currentSpotId = this.characterSpots.get(`${sessionId}:${characterId}`);
    if (currentSpotId) {
      await Spot.updateOne(
        { spotId: currentSpotId },
        { $pull: { currentOccupants: characterId } },
      );
    }
    
    // 5. 새 스팟에 추가
    await Spot.updateOne(
      { spotId: targetSpotId },
      { $addToSet: { currentOccupants: characterId } },
    );
    
    // 6. 캐시 업데이트
    this.characterSpots.set(`${sessionId}:${characterId}`, targetSpotId);
    
    // 7. CP 비용 계산
    const cpCost = isShortDistance ? this.SHORT_DISTANCE_CP : this.LONG_DISTANCE_CP;
    
    // 8. 이벤트 발생
    this.emit('spot:moved', {
      sessionId,
      characterId,
      characterName,
      fromSpotId: currentSpotId,
      toSpotId: targetSpotId,
      spotName: targetSpot.name,
      spotType: targetSpot.type,
      cpCost,
    });
    
    logger.debug(`[SpotService] ${characterName} moved to ${targetSpot.name}`);
    
    return { success: true, cpCost };
  }

  /**
   * 접근 권한 확인
   */
  private async checkAccess(
    sessionId: string,
    characterId: string,
    spot: ISpot,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 비공개 스팟은 소유자만
    if (!spot.isPublic && spot.ownerId !== characterId) {
      return { allowed: false, reason: '비공개 스팟입니다.' };
    }
    
    // TODO: 진영, 계급, 직위 확인 로직 추가
    // if (spot.factionId) { ... }
    // if (spot.rankRequired) { ... }
    // if (spot.positionRequired) { ... }
    
    return { allowed: true };
  }

  // ============================================================
  // 스팟 내 캐릭터 관리
  // ============================================================

  /**
   * 캐릭터 스팟 입장 (초기 배치)
   */
  public async enterSpot(
    sessionId: string,
    characterId: string,
    spotId: string,
  ): Promise<boolean> {
    const spot = await Spot.findOne({ spotId });
    if (!spot) return false;
    
    if (spot.currentOccupants.length >= spot.capacity) {
      return false;
    }
    
    // 이전 스팟에서 제거
    const oldSpotId = this.characterSpots.get(`${sessionId}:${characterId}`);
    if (oldSpotId) {
      await Spot.updateOne(
        { spotId: oldSpotId },
        { $pull: { currentOccupants: characterId } },
      );
    }
    
    // 새 스팟에 추가
    await Spot.updateOne(
      { spotId },
      { $addToSet: { currentOccupants: characterId } },
    );
    
    this.characterSpots.set(`${sessionId}:${characterId}`, spotId);
    
    return true;
  }

  /**
   * 캐릭터 스팟 퇴장
   */
  public async leaveSpot(sessionId: string, characterId: string): Promise<void> {
    const spotId = this.characterSpots.get(`${sessionId}:${characterId}`);
    if (!spotId) return;
    
    await Spot.updateOne(
      { spotId },
      { $pull: { currentOccupants: characterId } },
    );
    
    this.characterSpots.delete(`${sessionId}:${characterId}`);
  }

  /**
   * 현재 스팟 조회
   */
  public getCurrentSpot(sessionId: string, characterId: string): string | undefined {
    return this.characterSpots.get(`${sessionId}:${characterId}`);
  }

  /**
   * 같은 스팟의 캐릭터 목록
   */
  public async getSpotOccupants(spotId: string): Promise<string[]> {
    const spot = await Spot.findOne({ spotId }).lean();
    return spot?.currentOccupants || [];
  }

  // ============================================================
  // 기함 스팟 관리
  // ============================================================

  /**
   * 기함 스팟 생성 (캐릭터 생성 시)
   */
  public async createFlagshipSpot(
    sessionId: string,
    shipId: string,
    ownerName: string,
  ): Promise<ISpot> {
    // 함교
    const bridge = await this.createSpot({
      sessionId,
      name: `${ownerName}의 기함 함교`,
      type: SpotType.BRIDGE,
      shipId,
      capacity: 10,
      isPublic: false,
    });
    
    // 기함 내부 (일반)
    await this.createSpot({
      sessionId,
      name: `${ownerName}의 기함`,
      type: SpotType.FLAGSHIP,
      shipId,
      capacity: 50,
      isPublic: false,
    });
    
    return bridge;
  }

  // ============================================================
  // 행성 기본 스팟 생성
  // ============================================================

  /**
   * 행성 기본 스팟 생성
   */
  public async createPlanetDefaultSpots(
    sessionId: string,
    planetId: string,
    planetName: string,
    factionId?: string,
  ): Promise<ISpot[]> {
    const spots: ISpot[] = [];
    
    // 로비
    spots.push(await this.createSpot({
      sessionId,
      name: `${planetName} 로비`,
      type: SpotType.LOBBY,
      planetId,
      factionId,
      capacity: 100,
      isPublic: true,
    }));
    
    // 술집
    spots.push(await this.createSpot({
      sessionId,
      name: `${planetName} 술집`,
      type: SpotType.BAR,
      planetId,
      factionId,
      capacity: 50,
      isPublic: true,
    }));
    
    // 호텔
    spots.push(await this.createSpot({
      sessionId,
      name: `${planetName} 호텔`,
      type: SpotType.HOTEL_ROOM,
      planetId,
      factionId,
      capacity: 200,
      isPublic: true,
    }));
    
    // 사령부
    spots.push(await this.createSpot({
      sessionId,
      name: `${planetName} 사령부`,
      type: SpotType.HEADQUARTERS,
      planetId,
      factionId,
      capacity: 30,
      isPublic: true,
    }));
    
    return spots;
  }

  // ============================================================
  // 정리
  // ============================================================

  public async cleanup(sessionId: string): Promise<void> {
    // 메모리 캐시 정리
    for (const key of this.characterSpots.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.characterSpots.delete(key);
      }
    }
    
    logger.info(`[SpotService] Cleaned up session: ${sessionId}`);
  }
}

export const spotService = SpotService.getInstance();
export default SpotService;





