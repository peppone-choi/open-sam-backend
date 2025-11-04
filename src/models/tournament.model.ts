/**
 * Tournament (토너먼트) 모델
 * 토너먼트 참가자 및 대진표 정보
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITournament extends Document {
  seq: number; // Entry ID (자동 증가)
  no: number; // General ID
  npc: number; // NPC flag
  name: string; // General name
  w: string; // Weapon
  b: string; // Book
  h: string; // Horse
  leadership: number;
  strength: number;
  intel: number;
  lvl: number; // Level
  grp: number; // Group number
  grp_no: number; // Group position
  win: number; // Win count
  draw: number; // Draw count
  lose: number; // Loss count
  gl: number; // Goal/score
  prmt: number; // Promotion flag
  session_id: string; // 세션 ID 추가
}

const TournamentSchema = new Schema<ITournament>(
  {
    seq: {
      type: Number,
      auto: true
    },
    no: {
      type: Number,
      default: 0,
      index: true
    },
    npc: {
      type: Number,
      default: 0
    },
    name: {
      type: String,
      default: ''
    },
    w: {
      type: String,
      default: 'None'
    },
    b: {
      type: String,
      default: 'None'
    },
    h: {
      type: String,
      default: 'None'
    },
    leadership: {
      type: Number,
      default: 0
    },
    strength: {
      type: Number,
      default: 0
    },
    intel: {
      type: Number,
      default: 0
    },
    lvl: {
      type: Number,
      default: 0
    },
    grp: {
      type: Number,
      default: 0,
      index: true
    },
    grp_no: {
      type: Number,
      default: 0,
      index: true
    },
    win: {
      type: Number,
      default: 0
    },
    draw: {
      type: Number,
      default: 0
    },
    lose: {
      type: Number,
      default: 0
    },
    gl: {
      type: Number,
      default: 0
    },
    prmt: {
      type: Number,
      default: 0
    },
    session_id: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: false
  }
);

// 복합 인덱스
TournamentSchema.index({ grp: 1, grp_no: 1 });
TournamentSchema.index({ session_id: 1, no: 1 });

// seq를 자동 증가시키기 위한 pre-save hook
TournamentSchema.pre('save', async function (next) {
  if (this.isNew && !this.seq) {
    const maxSeq = await (Tournament as any)
      .findOne({ session_id: this.session_id })
      .sort({ seq: -1 })
      .lean();
    this.seq = (maxSeq?.seq || 0) + 1;
  }
  next();
});

export const Tournament = mongoose.model<ITournament>('Tournament', TournamentSchema);
