import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  FortressType,
  FortressStatus,
  FortressComponent,
  FORTRESS_SPECS,
  FORTRESS_COMPONENT_HP_RATIO,
} from '../../types/gin7/fortress.types';

/**
 * 요새 부위별 상태
 */
export interface IFortressComponentState {
  component: FortressComponent;
  hp: number;
  maxHp: number;
  isDestroyed: boolean;
}

/**
 * 요새 스키마
 * 이제르론, 가이에스부르크 등 전략적 요새를 표현
 */
export interface IFortress extends Document {
  fortressId: string;
  sessionId: string;
  
  // 기본 정보
  type: FortressType;
  name: string;
  customName?: string;          // 플레이어 지정 이름
  
  // 소유권
  ownerId: string;              // 소유 세력 ID
  commanderId?: string;         // 요새 사령관 캐릭터 ID
  
  // 위치
  location: {
    type: 'SYSTEM' | 'CORRIDOR' | 'DEEP_SPACE';
    systemId?: string;
    corridorId?: string;        // 회랑 (이제르론 회랑, 페잔 회랑)
    coordinates?: { x: number; y: number };
  };
  
  // 상태
  status: FortressStatus;
  
  // 전투 능력
  currentHp: number;
  maxHp: number;
  currentShield: number;
  maxShield: number;
  shieldRegenRate: number;
  armor: number;
  
  // 주포 상태
  mainCannonReady: boolean;
  mainCannonCooldown: number;   // 남은 쿨다운 턴
  mainCannonPower: number;
  
  // 부위별 상태
  components: IFortressComponentState[];
  
  // 수비 함대
  garrisonFleetIds: string[];
  garrisonCapacity: number;
  
  // 함재기 및 병력
  fighterCount: number;
  fighterCapacity: number;
  troopCount: number;
  troopCapacity: number;
  
  // 이동 (가이에스부르크 등)
  canMove: boolean;
  isMoving: boolean;
  movementTarget?: {
    systemId?: string;
    coordinates?: { x: number; y: number };
  };
  movementProgress?: number;    // 0-100
  
  // 포위전 상태
  siegeId?: string;             // 현재 진행 중인 포위전 ID
  
  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
  data: Record<string, unknown>;
}

const FortressComponentStateSchema = new Schema<IFortressComponentState>({
  component: {
    type: String,
    enum: ['MAIN_CANNON', 'SHIELD_GENERATOR', 'ENGINE', 'DOCK', 'COMMAND_CENTER', 'LIFE_SUPPORT', 'REACTOR'],
    required: true,
  },
  hp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  isDestroyed: { type: Boolean, default: false },
}, { _id: false });

const FortressSchema = new Schema<IFortress>({
  fortressId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  type: {
    type: String,
    enum: ['ISERLOHN', 'GEIERSBURG', 'RENTENBERG', 'STANDARD'],
    required: true,
  },
  name: { type: String, required: true },
  customName: String,
  
  ownerId: { type: String, required: true },
  commanderId: String,
  
  location: {
    type: {
      type: String,
      enum: ['SYSTEM', 'CORRIDOR', 'DEEP_SPACE'],
      default: 'SYSTEM',
    },
    systemId: String,
    corridorId: String,
    coordinates: {
      x: Number,
      y: Number,
    },
  },
  
  status: {
    type: String,
    enum: ['OPERATIONAL', 'DAMAGED', 'UNDER_SIEGE', 'REPAIRING', 'MOVING', 'DESTROYED'],
    default: 'OPERATIONAL',
  },
  
  currentHp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  currentShield: { type: Number, required: true },
  maxShield: { type: Number, required: true },
  shieldRegenRate: { type: Number, required: true },
  armor: { type: Number, default: 100 },
  
  mainCannonReady: { type: Boolean, default: true },
  mainCannonCooldown: { type: Number, default: 0 },
  mainCannonPower: { type: Number, required: true },
  
  components: { type: [FortressComponentStateSchema], default: [] },
  
  garrisonFleetIds: { type: [String], default: [] },
  garrisonCapacity: { type: Number, default: 2 },
  
  fighterCount: { type: Number, default: 0 },
  fighterCapacity: { type: Number, default: 500 },
  troopCount: { type: Number, default: 0 },
  troopCapacity: { type: Number, default: 20000 },
  
  canMove: { type: Boolean, default: false },
  isMoving: { type: Boolean, default: false },
  movementTarget: {
    systemId: String,
    coordinates: {
      x: Number,
      y: Number,
    },
  },
  movementProgress: Number,
  
  siegeId: String,
  
  data: { type: Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

// 인덱스
FortressSchema.index({ fortressId: 1, sessionId: 1 }, { unique: true });
FortressSchema.index({ sessionId: 1, ownerId: 1 });
FortressSchema.index({ sessionId: 1, status: 1 });
FortressSchema.index({ sessionId: 1, 'location.systemId': 1 });
FortressSchema.index({ sessionId: 1, 'location.corridorId': 1 });

/**
 * 요새 스펙에서 초기 상태 생성
 */
FortressSchema.statics.createFromSpec = function(
  sessionId: string,
  fortressId: string,
  type: FortressType,
  ownerId: string,
  location: IFortress['location']
): Partial<IFortress> {
  const spec = FORTRESS_SPECS[type];
  
  // 부위별 HP 초기화
  const components: IFortressComponentState[] = Object.entries(FORTRESS_COMPONENT_HP_RATIO).map(
    ([component, ratio]) => {
      // 이동형이 아닌 요새는 ENGINE 부위 제외
      if (component === 'ENGINE' && !spec.canMove) {
        return null;
      }
      const componentMaxHp = Math.floor(spec.maxHp * ratio);
      return {
        component: component as FortressComponent,
        hp: componentMaxHp,
        maxHp: componentMaxHp,
        isDestroyed: false,
      };
    }
  ).filter((c): c is IFortressComponentState => c !== null);
  
  return {
    fortressId,
    sessionId,
    type,
    name: spec.nameKo,
    ownerId,
    location,
    status: 'OPERATIONAL',
    currentHp: spec.maxHp,
    maxHp: spec.maxHp,
    currentShield: spec.maxShield,
    maxShield: spec.maxShield,
    shieldRegenRate: spec.shieldRegenRate,
    armor: spec.armor,
    mainCannonReady: true,
    mainCannonCooldown: 0,
    mainCannonPower: spec.mainCannonPower,
    components,
    garrisonFleetIds: [],
    garrisonCapacity: spec.garrisonCapacity,
    fighterCount: 0,
    fighterCapacity: spec.fighterCapacity,
    troopCount: 0,
    troopCapacity: spec.troopCapacity,
    canMove: spec.canMove,
    isMoving: false,
    data: {},
  };
};

/**
 * 전체 전투력 계산
 */
FortressSchema.methods.getCombatPower = function(): number {
  const hpRatio = this.currentHp / this.maxHp;
  const shieldRatio = this.currentShield / this.maxShield;
  const mainCannonFactor = this.isMainCannonOperational() ? 1 : 0.3;
  
  return Math.floor(
    (this.mainCannonPower * mainCannonFactor) +
    (this.maxHp * hpRatio * 0.5) +
    (this.maxShield * shieldRatio * 0.3) +
    (this.garrisonFleetIds.length * 5000)
  );
};

/**
 * 주포 사용 가능 여부
 */
FortressSchema.methods.isMainCannonOperational = function(): boolean {
  const mainCannon = this.components.find(
    (c: IFortressComponentState) => c.component === 'MAIN_CANNON'
  );
  return mainCannon ? !mainCannon.isDestroyed && this.mainCannonReady : false;
};

/**
 * 수비 함대 추가 가능 여부
 */
FortressSchema.methods.canAddGarrison = function(): boolean {
  return this.garrisonFleetIds.length < this.garrisonCapacity;
};

/**
 * HP 비율 계산
 */
FortressSchema.methods.getHpPercent = function(): number {
  return Math.floor((this.currentHp / this.maxHp) * 100);
};

/**
 * 방어막 비율 계산
 */
FortressSchema.methods.getShieldPercent = function(): number {
  return Math.floor((this.currentShield / this.maxShield) * 100);
};

/**
 * 특정 부위 상태 조회
 */
FortressSchema.methods.getComponent = function(
  component: FortressComponent
): IFortressComponentState | undefined {
  return this.components.find(
    (c: IFortressComponentState) => c.component === component
  );
};

/**
 * 파괴된 부위 목록
 */
FortressSchema.methods.getDestroyedComponents = function(): FortressComponent[] {
  return this.components
    .filter((c: IFortressComponentState) => c.isDestroyed)
    .map((c: IFortressComponentState) => c.component);
};

// 모델 타입 확장
interface IFortressModel extends Model<IFortress> {
  createFromSpec(
    sessionId: string,
    fortressId: string,
    type: FortressType,
    ownerId: string,
    location: IFortress['location']
  ): Partial<IFortress>;
}

export const Fortress: IFortressModel = 
  mongoose.models.Fortress as IFortressModel || 
  mongoose.model<IFortress, IFortressModel>('Fortress', FortressSchema);












