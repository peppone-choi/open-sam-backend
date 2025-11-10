/**
 * LOGH Map Grid Model
 * 은하영웅전설 맵 그리드 (100x50 항행 가능 영역)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IMapGrid extends Document {
  session_id: string;
  
  // Metadata
  name: string;
  nameKo?: string;
  description?: string;
  
  // Grid size
  gridSize: {
    width: number; // 100
    height: number; // 50
  };

  // Grid data (2D array)
  // 0 = impassable (obstacle), 1 = navigable space
  grid: number[][];

  // Statistics
  statistics: {
    totalCells: number;
    navigableCells: number;
    impassableCells: number;
    navigablePercentage: number;
  };

  // Source info
  sourceImage?: string;
  originalImageSize?: {
    width: number;
    height: number;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

const MapGridSchema = new Schema<IMapGrid>(
  {
    session_id: { type: String, required: true, index: true },
    
    name: { type: String, required: true },
    nameKo: { type: String },
    description: { type: String },
    
    gridSize: {
      width: { type: Number, required: true, default: 100 },
      height: { type: Number, required: true, default: 50 },
    },

    grid: {
      type: [[Number]],
      required: true,
    },

    statistics: {
      totalCells: { type: Number, required: true },
      navigableCells: { type: Number, required: true },
      impassableCells: { type: Number, required: true },
      navigablePercentage: { type: Number, required: true },
    },

    sourceImage: { type: String },
    originalImageSize: {
      width: { type: Number },
      height: { type: Number },
    },
  },
  {
    timestamps: true,
  }
);

// Unique index for session
MapGridSchema.index({ session_id: 1 }, { unique: true });

// Helper method to check if a coordinate is navigable
MapGridSchema.methods.isNavigable = function(x: number, y: number): boolean {
  if (x < 0 || x >= this.gridSize.width || y < 0 || y >= this.gridSize.height) {
    return false;
  }
  return this.grid[y][x] === 1;
};

export const MapGrid = mongoose.model<IMapGrid>('MapGrid', MapGridSchema);
