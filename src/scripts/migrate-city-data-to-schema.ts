/**
 * City 데이터 마이그레이션 스크립트
 * 
 * data 필드에 있던 모든 값을 스키마 레벨로 이동
 * 실행: npx ts-node src/scripts/migrate-city-data-to-schema.ts
 */

import mongoose from 'mongoose';
import { City } from '../models/city.model';
import { connectDB } from '../config/db';

async function migrateCityData() {
  try {
    console.log('🚀 City 데이터 마이그레이션 시작...\n');
    
    // DB 연결
    await connectDB();
    
    // 모든 City 문서 조회
    const cities = await City.find({});
    console.log(`📊 총 ${cities.length}개 도시 발견\n`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const city of cities) {
      const data = city.data as any || {};
      let hasChanges = false;
      
      // data에 값이 있으면 스키마 레벨로 이동
      const migrations: Array<{ field: string, oldValue: any, newValue: any }> = [];
      
      // nation
      if (data.nation !== undefined && city.nation !== data.nation) {
        migrations.push({ field: 'nation', oldValue: city.nation, newValue: data.nation });
        city.nation = data.nation;
        hasChanges = true;
      }
      
      // level (문자열을 숫자로 변환)
      if (data.level !== undefined) {
        let levelNum = typeof data.level === 'number' ? data.level : parseLevelToNumber(data.level);
        if (city.level !== levelNum) {
          migrations.push({ field: 'level', oldValue: city.level, newValue: levelNum });
          city.level = levelNum;
          hasChanges = true;
        }
      }
      
      // state
      if (data.state !== undefined && city.state !== data.state) {
        migrations.push({ field: 'state', oldValue: city.state, newValue: data.state });
        city.state = data.state;
        hasChanges = true;
      }
      
      // region
      if (data.region !== undefined && city.region !== data.region) {
        migrations.push({ field: 'region', oldValue: city.region, newValue: data.region });
        city.region = data.region;
        hasChanges = true;
      }
      
      // 자원 필드들
      const resourceFields = [
        'pop', 'pop_max', 'agri', 'agri_max', 'comm', 'comm_max',
        'secu', 'secu_max', 'def', 'def_max', 'wall', 'wall_max'
      ];
      
      for (const field of resourceFields) {
        if (data[field] !== undefined && city[field] !== data[field]) {
          migrations.push({ field, oldValue: city[field], newValue: data[field] });
          city[field] = data[field];
          hasChanges = true;
        }
      }
      
      // 게임 속성
      if (data.trust !== undefined && city.trust !== data.trust) {
        migrations.push({ field: 'trust', oldValue: city.trust, newValue: data.trust });
        city.trust = data.trust;
        hasChanges = true;
      }
      
      if (data.front !== undefined && city.front !== data.front) {
        migrations.push({ field: 'front', oldValue: city.front, newValue: data.front });
        city.front = data.front;
        hasChanges = true;
      }
      
      if (data.supply !== undefined && city.supply !== data.supply) {
        migrations.push({ field: 'supply', oldValue: city.supply, newValue: data.supply });
        city.supply = data.supply;
        hasChanges = true;
      }
      
      if (data.trade !== undefined && city.trade !== data.trade) {
        migrations.push({ field: 'trade', oldValue: city.trade, newValue: data.trade });
        city.trade = data.trade;
        hasChanges = true;
      }
      
      // 지리 정보
      if (data.x !== undefined && city.x !== data.x) {
        migrations.push({ field: 'x', oldValue: city.x, newValue: data.x });
        city.x = data.x;
        hasChanges = true;
      }
      
      if (data.y !== undefined && city.y !== data.y) {
        migrations.push({ field: 'y', oldValue: city.y, newValue: data.y });
        city.y = data.y;
        hasChanges = true;
      }
      
      if (data.neighbors !== undefined && JSON.stringify(city.neighbors) !== JSON.stringify(data.neighbors)) {
        migrations.push({ field: 'neighbors', oldValue: city.neighbors, newValue: data.neighbors });
        city.neighbors = data.neighbors;
        hasChanges = true;
      }
      
      if (data.terrain !== undefined && city.terrain !== data.terrain) {
        migrations.push({ field: 'terrain', oldValue: city.terrain, newValue: data.terrain });
        city.terrain = data.terrain;
        hasChanges = true;
      }
      
      // conflict
      if (data.conflict !== undefined && JSON.stringify(city.conflict) !== JSON.stringify(data.conflict)) {
        migrations.push({ field: 'conflict', oldValue: city.conflict, newValue: data.conflict });
        city.conflict = data.conflict;
        hasChanges = true;
      }
      
      if (hasChanges) {
        await city.save();
        migratedCount++;
        console.log(`✅ [${city.city}] ${city.name}`);
        migrations.forEach(m => {
          console.log(`   ${m.field}: ${JSON.stringify(m.oldValue)} → ${JSON.stringify(m.newValue)}`);
        });
      } else {
        skippedCount++;
      }
    }
    
    console.log(`\n📈 마이그레이션 완료!`);
    console.log(`   - 변경됨: ${migratedCount}개`);
    console.log(`   - 스킵됨: ${skippedCount}개`);
    console.log(`   - 총합: ${cities.length}개\n`);
    
    console.log('⚠️  주의: data 필드는 아직 제거하지 않았습니다.');
    console.log('   마이그레이션 검증 후 수동으로 data 필드를 제거하세요.\n');
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 DB 연결 종료');
  }
}

function parseLevelToNumber(level: string | number): number {
  if (typeof level === 'number') return level;
  
  const levelMap: Record<string, number> = {
    '대': 3,
    '중': 2,
    '소': 1,
    '촌': 0
  };
  
  return levelMap[level] || 2;
}

// 실행
migrateCityData();
