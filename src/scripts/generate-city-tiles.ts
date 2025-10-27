/**
 * 기존 도시에 타일이 없을 경우 일괄 생성하는 스크립트
 * 
 * 주의: 정상적인 플로우는 도시 생성 시 자동 생성됨
 * 이 스크립트는 마이그레이션/복구용
 * 
 * 실행 방법:
 * npm run generate:tiles
 */

import dotenv from 'dotenv';
import { mongoConnection } from '../db/connection';
import { CityModel } from '../api/city/model/city.model';
import { BattleFieldTileModel } from '../api/battlefield-tile/model/battlefield-tile.model';

dotenv.config();

async function generateAllCityTiles() {
  console.log('🚀 도시 타일 생성 시작...');
  
  try {
    // MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);
    console.log('✅ MongoDB 연결 완료');
    
    // TODO: 모든 도시 조회
    const cities = await CityModel.find().lean().exec();
    console.log(`📊 총 ${cities.length}개 도시 발견`);
    
    let created = 0;
    let skipped = 0;
    
    for (const city of cities) {
      // 이미 타일이 있는지 확인
      const cityObj = city.toObject ? city.toObject() : city;
      const existing = await BattleFieldTileModel.findOne({ 
        sessionId: (cityObj as any).sessionId || 'default',
        cityId: city._id.toString() 
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // TODO: 1600개 타일 생성
      const tiles = generateTilesForCity(city._id.toString());
      
      await BattleFieldTileModel.create({
        sessionId: city.sessionId || 'default',
        cityId: city._id.toString(),
        tiles,
        castleX: 20,
        castleY: 20,
        castleSize: 3,
      });
      
      created++;
      console.log(`  ✅ ${city.name} (${city._id}) - ${created}/${cities.length}`);
    }
    
    console.log('');
    console.log('🎉 타일 생성 완료!');
    console.log(`  - 생성: ${created}개`);
    console.log(`  - 스킵: ${skipped}개`);
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    process.exit(1);
  } finally {
    await mongoConnection.disconnect();
    process.exit(0);
  }
}

/**
 * 40x40 타일 생성 함수
 */
function generateTilesForCity(cityId: string) {
  const tiles = [];
  
  // TODO: 1600개 타일 생성
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      tiles.push({
        x,
        y,
        terrainType: randomTerrain(x, y),
        movable: true,
        moveCost: 1,
        defenseBonus: 0,
        height: 0,
      });
    }
  }
  
  // TODO: 중앙에 성 배치 (20, 20)
  const castleX = 20;
  const castleY = 20;
  const castleSize = 3;
  
  for (let dy = 0; dy < castleSize; dy++) {
    for (let dx = 0; dx < castleSize; dx++) {
      const x = castleX + dx;
      const y = castleY + dy;
      const idx = y * 40 + x;
      
      tiles[idx] = {
        x, y,
        terrainType: 'castle',
        movable: false,
        moveCost: 999,
        defenseBonus: 10,
        height: 5,
      };
    }
  }
  
  // TODO: 성벽 배치 (성 주변)
  const wallDistance = 1;
  for (let y = castleY - wallDistance; y <= castleY + castleSize; y++) {
    for (let x = castleX - wallDistance; x <= castleX + castleSize; x++) {
      if (x < 0 || x >= 40 || y < 0 || y >= 40) continue;
      
      const isCastle = (
        x >= castleX && x < castleX + castleSize &&
        y >= castleY && y < castleY + castleSize
      );
      
      if (!isCastle) {
        const idx = y * 40 + x;
        tiles[idx] = {
          x, y,
          terrainType: 'wall',
          movable: true,
          moveCost: 2,
          defenseBonus: 5,
          height: 3,
        };
      }
    }
  }
  
  return tiles;
}

/**
 * 랜덤 지형 생성
 */
function randomTerrain(x: number, y: number): string {
  // TODO: Perlin Noise 또는 패턴 기반 생성
  // 지금은 단순 랜덤
  const rand = (x * 7 + y * 13) % 100 / 100;
  
  if (rand < 0.65) return 'plain';
  if (rand < 0.80) return 'forest';
  if (rand < 0.90) return 'hill';
  return 'water';
}

// 스크립트 실행
generateAllCityTiles();
