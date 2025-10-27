import { Schema, model, Document } from 'mongoose';
import { IGameConfig } from '../@types/admin.types';

export interface IGameConfigDocument extends Omit<IGameConfig, 'id'>, Document {
  id: string;
}

const GameConfigSchema = new Schema<IGameConfigDocument>(
  {
    unitAdvantage: {
      advantages: { type: Map, of: [Number], required: true },
      advantageMultiplier: { type: Number, required: true, default: 1.2 },
      disadvantageMultiplier: { type: Number, required: true, default: 0.8 },
      units: [
        {
          id: { type: Number, required: true },
          name: { type: String, required: true },
          type: { type: String, required: true },
          description: { type: String, required: true },
          baseAttack: { type: Number, required: true },
          baseDefense: { type: Number, required: true },
          baseMobility: { type: Number, required: true },
          recruitCost: { type: Number, required: true },
          hiringCost: { type: Number, required: true },
          maintenanceCost: { type: Number, required: true },
          requiredTech: { type: Number },
          requiredFacility: { type: String },
        },
      ],
    },
    
    balance: {
      domestic: {
        agriculture: { type: Number, required: true, default: 1.0 },
        commerce: { type: Number, required: true, default: 1.0 },
        technology: { type: Number, required: true, default: 1.0 },
        defense: { type: Number, required: true, default: 1.0 },
        wall: { type: Number, required: true, default: 1.0 },
        security: { type: Number, required: true, default: 1.0 },
        settlement: { type: Number, required: true, default: 1.0 },
        governance: { type: Number, required: true, default: 1.0 },
      },
      military: {
        trainEfficiency: { type: Number, required: true, default: 1.0 },
        moraleEfficiency: { type: Number, required: true, default: 1.0 },
        recruitmentRate: { type: Number, required: true, default: 1.0 },
        hiringRate: { type: Number, required: true, default: 1.0 },
      },
      production: {
        goldPerPopulation: { type: Number, required: true, default: 10 },
        ricePerAgriculture: { type: Number, required: true, default: 100 },
        taxRate: { type: Number, required: true, default: 0.1 },
      },
      combat: {
        baseDamage: { type: Number, required: true, default: 100 },
        criticalRate: { type: Number, required: true, default: 0.05 },
        criticalMultiplier: { type: Number, required: true, default: 1.5 },
        retreatThreshold: { type: Number, required: true, default: 0.3 },
      },
    },
    
    turnConfig: {
      turnDuration: { type: Number, required: true, default: 60 },
      maxTurnsPerDay: { type: Number, required: true, default: 1440 },
      pcp: {
        max: { type: Number, required: true, default: 100 },
        recovery: { type: Number, required: true, default: 1 },
      },
      mcp: {
        max: { type: Number, required: true, default: 50 },
        recovery: { type: Number, required: true, default: 1 },
      },
    },
    
    expConfig: {
      levelUpExp: { type: [Number], required: true, default: [] },
      leadership: {
        domestic: { type: Number, required: true, default: 10 },
        military: { type: Number, required: true, default: 10 },
      },
      strength: {
        combat: { type: Number, required: true, default: 10 },
        training: { type: Number, required: true, default: 5 },
      },
      intel: {
        research: { type: Number, required: true, default: 10 },
        stratagem: { type: Number, required: true, default: 5 },
      },
    },
    
    version: { type: String, required: true, default: '1.0.0' },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const GameConfigModel = model<IGameConfigDocument>('GameConfig', GameConfigSchema);
