import mongoose, { Schema, Document } from 'mongoose';
import { Role, ScenarioId, EntityId, RelationKey } from '../@types/role.types';

/**
 * Embedded RoleRef 스키마
 */
const RoleRefSchema = new Schema(
  {
    role: { type: String, enum: Object.values(Role), required: true },
    id: { type: String, required: true },
    scenario: { type: String, required: true },
  },
  { _id: false }
);

/**
 * Edge 문서 인터페이스
 */
export interface IEdge extends Document {
  scenario: ScenarioId;
  key: RelationKey;
  from: {
    role: Role;
    id: EntityId;
    scenario: ScenarioId;
  };
  to: {
    role: Role;
    id: EntityId;
    scenario: ScenarioId;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Edge 스키마
 * 엔티티 간 관계를 표현
 */
const EdgeSchema = new Schema<IEdge>(
  {
    scenario: { type: String, required: true, index: true },
    key: { type: String, required: true, index: true },
    from: { type: RoleRefSchema, required: true },
    to: { type: RoleRefSchema, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'edges',
  }
);

// 복합 인덱스: scenario + key + from (발신 엔티티 기준 조회)
EdgeSchema.index({ scenario: 1, key: 1, 'from.role': 1, 'from.id': 1 });

// 복합 인덱스: scenario + key + to (수신 엔티티 기준 조회)
EdgeSchema.index({ scenario: 1, key: 1, 'to.role': 1, 'to.id': 1 });

// 고유 인덱스: 동일한 관계 중복 방지
EdgeSchema.index(
  {
    scenario: 1,
    key: 1,
    'from.role': 1,
    'from.id': 1,
    'to.role': 1,
    'to.id': 1,
  },
  { unique: true }
);

export const Edge = mongoose.model<IEdge>('Edge', EdgeSchema);
