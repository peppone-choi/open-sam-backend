/**
 * Hall (명예의 전당) 모델
 * 게임 종료 후 장수의 통계를 기록하는 테이블
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IHall extends Document {
  server_id: string;
  season: number;
  scenario: number;
  general_no: number;
  type: string; // experience, dedication, firenum, warnum, killnum 등
  value: number;
  owner: number | null; // 사용자 ID (owner)
  aux: any; // 추가 정보 (JSON)
}

const HallSchema = new Schema<IHall>(
  {
    server_id: {
      type: String,
      required: true,
      index: true
    },
    season: {
      type: Number,
      required: true,
      index: true
    },
    scenario: {
      type: Number,
      required: true,
      index: true
    },
    general_no: {
      type: Number,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      index: true
    },
    value: {
      type: Number,
      required: true,
      index: true
    },
    owner: {
      type: Number,
      default: null,
      index: true
    },
    aux: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: false
  }
);

// 복합 인덱스
HallSchema.index({ server_id: 1, type: 1, general_no: 1 }, { unique: true });
HallSchema.index({ owner: 1, server_id: 1, type: 1 }, { unique: true });
HallSchema.index({ server_id: 1, type: 1, value: -1 }); // 정렬용
HallSchema.index({ season: 1, scenario: 1, type: 1, value: -1 });

export const Hall = mongoose.model<IHall>('Hall', HallSchema);

