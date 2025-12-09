import mongoose, { Schema, Document } from 'mongoose';

/**
 * 메뉴얼 1092행: 커맨드 포인트
 * 모든 캐릭터는 PCP(정략)와 MCP(군사) 두 종류의 포인트를 가집니다.
 */
export interface ICommandPoint extends Document {
  characterId: string;
  pcp: number; // Political Command Points
  mcp: number; // Military Command Points
  maxPcp: number;
  maxMcp: number;
  lastRecoveredAt: Date; // 마지막 회복 시간
  
  // 메서드
  consume(type: 'pcp' | 'mcp', amount: number): boolean;
  recover(pcpAmount: number, mcpAmount: number): void;
}

const CommandPointSchema: Schema = new Schema({
  characterId: { type: String, required: true, index: true, unique: true },
  pcp: { type: Number, default: 10, min: 0 },
  mcp: { type: Number, default: 10, min: 0 },
  maxPcp: { type: Number, default: 100 },
  maxMcp: { type: Number, default: 100 },
  lastRecoveredAt: { type: Date, default: Date.now }
});

/**
 * 메뉴얼 1114행: 커맨드 포인트 대용
 * 부족한 포인트는 다른 포인트로 대용 가능하며, 이때 소비량은 2배가 됩니다.
 */
CommandPointSchema.methods.consume = function(this: ICommandPoint, type: 'pcp' | 'mcp', amount: number): boolean {
  const primary = type === 'pcp' ? this.pcp : this.mcp;
  const secondary = type === 'pcp' ? this.mcp : this.pcp;
  
  // 1. 주 포인트로 충당 가능한 경우
  if (primary >= amount) {
    if (type === 'pcp') this.pcp -= amount;
    else this.mcp -= amount;
    return true;
  }
  
  // 2. 대용 로직 (메뉴얼 1117행: 소비량 2배)
  // 주 포인트 전부 사용 + 부족분 * 2 만큼 보조 포인트 사용
  const deficit = amount - primary;
  const secondaryCost = deficit * 2;
  
  if (secondary >= secondaryCost) {
    if (type === 'pcp') {
      this.pcp = 0;
      this.mcp -= secondaryCost;
    } else {
      this.mcp = 0;
      this.pcp -= secondaryCost;
    }
    return true;
  }
  
  return false;
};

/**
 * 포인트 회복
 */
CommandPointSchema.methods.recover = function(this: ICommandPoint, pcpAmount: number, mcpAmount: number) {
  this.pcp = Math.min(this.maxPcp, this.pcp + pcpAmount);
  this.mcp = Math.min(this.maxMcp, this.mcp + mcpAmount);
  this.lastRecoveredAt = new Date();
};

export const CommandPoint = mongoose.model<ICommandPoint>('CommandPoint', CommandPointSchema);






