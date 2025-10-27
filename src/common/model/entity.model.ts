import mongoose, { Schema, Document } from 'mongoose';
import { Role, ScenarioId, EntityId } from '../@types/role.types';

/**
 * Entity 문서 인터페이스
 */
export interface IEntity extends Document {
  scenario: ScenarioId;
  role: Role;
  id: EntityId;
  version: number;
  attributes?: Record<string, any>;
  slots?: Record<string, any>;
  resources?: Record<string, any>;
  refs?: Record<string, any>;
  systems?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entity 스키마
 * 모든 필드를 동적으로 저장 가능한 Mixed 타입 사용
 */
const EntitySchema = new Schema<IEntity>(
  {
    scenario: { type: String, required: true, index: true },
    role: { type: String, enum: Object.values(Role), required: true, index: true },
    id: { type: String, required: true },
    version: { type: Number, default: 1, required: true },
    
    // 동적 필드 (Mixed 타입)
    attributes: { type: Schema.Types.Mixed, default: {} },
    slots: { type: Schema.Types.Mixed, default: {} },
    resources: { type: Schema.Types.Mixed, default: {} },
    refs: { type: Schema.Types.Mixed, default: {} },
    systems: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'entities',
  }
);

// 복합 인덱스: scenario + role + id (고유 식별자)
EntitySchema.index({ scenario: 1, role: 1, id: 1 }, { unique: true });

// 버전 인덱스 (낙관적 잠금)
EntitySchema.index({ version: 1 });

// Wildcard 인덱스: attributes 모든 하위 필드
EntitySchema.index({ 'attributes.$**': 1 });

// Wildcard 인덱스: resources 모든 하위 필드
EntitySchema.index({ 'resources.$**': 1 });

export const Entity = mongoose.model<IEntity>('Entity', EntitySchema);
