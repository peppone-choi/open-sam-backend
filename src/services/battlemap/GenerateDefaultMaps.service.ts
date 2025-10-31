import { BattleMapTemplate } from '../../models/battlemap-template.model';
import { ITerrainTile, IPosition } from '../../models/battlemap-template.model';

export class GenerateDefaultMapsService {
  static async execute(data: { session_id?: string }) {
    try {
      const sessionId = data.session_id || 'sangokushi_default';
      
      const templates = [
        this.generatePlainsCastle(sessionId),
        this.generateMountainCastle(sessionId),
        this.generateWaterCastle(sessionId)
      ];
      
      const results = [];
      
      for (const templateData of templates) {
        const existing = await BattleMapTemplate.findOne({
          session_id: sessionId,
          city_id: templateData.city_id
        });
        
        if (existing) {
          await BattleMapTemplate.updateOne(
            { _id: existing._id },
            { $set: templateData }
          );
          console.log(`🔄 맵 템플릿 업데이트: ${templateData.name}`);
          results.push(await BattleMapTemplate.findById(existing._id));
        } else {
          const template = await BattleMapTemplate.create(templateData);
          console.log(`✅ 맵 템플릿 생성: ${templateData.name}`);
          results.push(template);
        }
      }
      
      return {
        success: true,
        templates: results,
        count: results.length
      };
    } catch (error: any) {
      console.error('GenerateDefaultMaps error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  private static generatePlainsCastle(sessionId: string) {
    const width = 40;
    const height = 40;
    const centerX = 20;
    const centerY = 20;
    
    const terrain: ITerrainTile[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let type: ITerrainTile['type'] = 'plain';
        let elevation = 0;
        let heightValue = 0;
        
        const distFromCenter = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        );
        
        if (distFromCenter <= 8 && distFromCenter >= 7) {
          const isGate = 
            (x === centerX && (y === centerY - 7 || y === centerY + 7)) ||
            (y === centerY && (x === centerX - 7 || x === centerX + 7));
          type = isGate ? 'gate' : 'wall';
          heightValue = isGate ? 0 : 3;
        } else if (distFromCenter < 7) {
          type = 'road';
        } else if (Math.random() < 0.1) {
          type = 'forest';
          elevation = 0;
        } else if (Math.random() < 0.05) {
          type = 'hill';
          elevation = 1;
          heightValue = 1;
        }
        
        terrain.push({ x, y, type, elevation, height: heightValue });
      }
    }
    
    const walls: IPosition[] = [];
    const gates: IPosition[] = [];
    
    for (let angle = 0; angle < 360; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(centerX + 7 * Math.cos(rad));
      const y = Math.round(centerY + 7 * Math.sin(rad));
      
      const isGate = 
        (x === centerX && (y === centerY - 7 || y === centerY + 7)) ||
        (y === centerY && (x === centerX - 7 || x === centerX + 7));
      
      if (isGate) {
        gates.push({ x, y });
      } else {
        walls.push({ x, y });
      }
    }
    
    return {
      session_id: sessionId,
      city_id: 9001,
      name: '평지성 (기본 템플릿)',
      width,
      height,
      terrain,
      castle: {
        centerX,
        centerY,
        walls,
        gates,
        throne: { x: centerX, y: centerY }
      },
      exits: [
        { direction: 'north' as const, position: { x: centerX, y: 0 } },
        { direction: 'east' as const, position: { x: width - 1, y: centerY } },
        { direction: 'south' as const, position: { x: centerX, y: height - 1 } },
        { direction: 'west' as const, position: { x: 0, y: centerY } }
      ],
      deployment: {
        attacker: this.generateDeploymentZone(centerX, 0, 10, 5),
        defender: this.generateDeploymentZone(centerX, centerY, 5, 5)
      },
      strategicPoints: [
        { name: '북문 광장', position: { x: centerX, y: centerY - 10 }, bonus: '방어+10%' },
        { name: '동문 광장', position: { x: centerX + 10, y: centerY }, bonus: '방어+10%' },
        { name: '남문 광장', position: { x: centerX, y: centerY + 10 }, bonus: '방어+10%' },
        { name: '서문 광장', position: { x: centerX - 10, y: centerY }, bonus: '방어+10%' }
      ]
    };
  }
  
  private static generateMountainCastle(sessionId: string) {
    const width = 40;
    const height = 40;
    const centerX = 20;
    const centerY = 20;
    
    const terrain: ITerrainTile[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let type: ITerrainTile['type'] = 'plain';
        let elevation = 0;
        let heightValue = 0;
        
        const distFromCenter = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        );
        
        if (distFromCenter <= 6 && distFromCenter >= 5) {
          const isGate = 
            (x === centerX && (y === centerY - 5 || y === centerY + 5));
          type = isGate ? 'gate' : 'wall';
          heightValue = isGate ? 2 : 5;
          elevation = 2;
        } else if (distFromCenter < 5) {
          type = 'road';
          elevation = 2;
          heightValue = 2;
        } else if (distFromCenter < 15) {
          const roll = Math.random();
          if (roll < 0.3) {
            type = 'mountain';
            elevation = Math.floor(Math.random() * 3) + 2;
            heightValue = elevation;
          } else if (roll < 0.6) {
            type = 'hill';
            elevation = Math.floor(Math.random() * 2) + 1;
            heightValue = elevation;
          } else if (roll < 0.8) {
            type = 'forest';
            elevation = 1;
          }
        } else {
          if (Math.random() < 0.2) {
            type = 'hill';
            elevation = 1;
            heightValue = 1;
          } else if (Math.random() < 0.3) {
            type = 'forest';
          }
        }
        
        if (x <= 2 || x >= width - 3) {
          type = 'mountain';
          elevation = 5;
          heightValue = 5;
        }
        
        terrain.push({ x, y, type, elevation, height: heightValue });
      }
    }
    
    const walls: IPosition[] = [];
    const gates: IPosition[] = [];
    
    for (let angle = 0; angle < 360; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(centerX + 5 * Math.cos(rad));
      const y = Math.round(centerY + 5 * Math.sin(rad));
      
      const isGate = x === centerX && (y === centerY - 5 || y === centerY + 5);
      
      if (isGate) {
        gates.push({ x, y });
      } else {
        walls.push({ x, y });
      }
    }
    
    return {
      session_id: sessionId,
      city_id: 9002,
      name: '산성 (험준 템플릿)',
      width,
      height,
      terrain,
      castle: {
        centerX,
        centerY,
        walls,
        gates,
        throne: { x: centerX, y: centerY }
      },
      exits: [
        { direction: 'north' as const, position: { x: centerX, y: 0 } },
        { direction: 'south' as const, position: { x: centerX, y: height - 1 } }
      ],
      deployment: {
        attacker: this.generateDeploymentZone(centerX, 0, 8, 4),
        defender: this.generateDeploymentZone(centerX, centerY, 4, 4)
      },
      strategicPoints: [
        { name: '북문 고지', position: { x: centerX, y: centerY - 12 }, bonus: '방어+30%' },
        { name: '동쪽 산봉우리', position: { x: centerX + 8, y: centerY }, bonus: '사격+20%' },
        { name: '남문 고지', position: { x: centerX, y: centerY + 12 }, bonus: '방어+30%' },
        { name: '서쪽 산봉우리', position: { x: centerX - 8, y: centerY }, bonus: '사격+20%' }
      ]
    };
  }
  
  private static generateWaterCastle(sessionId: string) {
    const width = 40;
    const height = 40;
    const centerX = 20;
    const centerY = 20;
    
    const terrain: ITerrainTile[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let type: ITerrainTile['type'] = 'plain';
        let elevation = 0;
        let heightValue = 0;
        
        const distFromCenter = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        );
        
        if (distFromCenter <= 9 && distFromCenter >= 8) {
          const isGate = 
            (x === centerX && y === centerY - 8) ||
            (y === centerY && (x === centerX - 8 || x === centerX + 8));
          type = isGate ? 'gate' : 'wall';
          heightValue = isGate ? 0 : 3;
        } else if (distFromCenter < 8) {
          type = 'road';
        } else if (x <= 5 || (y >= height - 8 && x >= width / 2 - 5 && x <= width / 2 + 5)) {
          type = 'water';
          elevation = -1;
          heightValue = -1;
        } else {
          const roll = Math.random();
          if (roll < 0.15 && Math.abs(x - 5) <= 3) {
            type = 'water';
            elevation = -1;
            heightValue = -1;
          } else if (roll < 0.2) {
            type = 'forest';
          }
        }
        
        terrain.push({ x, y, type, elevation, height: heightValue });
      }
    }
    
    const walls: IPosition[] = [];
    const gates: IPosition[] = [];
    
    for (let angle = 0; angle < 360; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(centerX + 8 * Math.cos(rad));
      const y = Math.round(centerY + 8 * Math.sin(rad));
      
      const isGate = 
        (x === centerX && y === centerY - 8) ||
        (y === centerY && (x === centerX - 8 || x === centerX + 8));
      
      if (isGate) {
        gates.push({ x, y });
      } else {
        walls.push({ x, y });
      }
    }
    
    return {
      session_id: sessionId,
      city_id: 9003,
      name: '수성 (강 인접 템플릿)',
      width,
      height,
      terrain,
      castle: {
        centerX,
        centerY,
        walls,
        gates,
        throne: { x: centerX, y: centerY }
      },
      exits: [
        { direction: 'north' as const, position: { x: centerX, y: 0 } },
        { direction: 'east' as const, position: { x: width - 1, y: centerY } },
        { direction: 'south' as const, position: { x: centerX, y: height - 1 } }
      ],
      deployment: {
        attacker: this.generateDeploymentZone(centerX, 0, 10, 5),
        defender: this.generateDeploymentZone(centerX, centerY, 6, 6)
      },
      strategicPoints: [
        { name: '북문 나루터', position: { x: centerX, y: centerY - 12 }, bonus: '방어+20%' },
        { name: '동문 교두보', position: { x: centerX + 12, y: centerY }, bonus: '방어+15%' },
        { name: '남문 강변', position: { x: centerX, y: centerY + 12 }, bonus: '수전+30%' },
        { name: '서쪽 강', position: { x: 8, y: centerY }, bonus: '수전+40%' }
      ]
    };
  }
  
  private static generateDeploymentZone(
    centerX: number, 
    centerY: number, 
    width: number, 
    height: number
  ): IPosition[] {
    const positions: IPosition[] = [];
    
    for (let dy = -Math.floor(height / 2); dy <= Math.floor(height / 2); dy++) {
      for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) {
        positions.push({
          x: Math.max(0, Math.min(39, centerX + dx)),
          y: Math.max(0, Math.min(39, centerY + dy))
        });
      }
    }
    
    return positions;
  }
}
