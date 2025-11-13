// @ts-nocheck
/**
 * DB 동기화 상태 확인 스크립트
 */
import dotenv from 'dotenv';
dotenv.config();

import { RedisService } from './src/infrastructure/queue/redis.service';

async function checkSyncQueue() {
  try {
    console.log('=== Sync Queue 상태 확인 ===\n');
    
    // Redis 연결
    const redis = await RedisService.connect();
    const client = redis.getClient();
    
    // 1. sync-queue 키 스캔
    console.log('1. Sync Queue 아이템 확인');
    const keys = await client.keys('sync-queue:*');
    console.log(`   총 ${keys.length}개의 항목이 대기 중\n`);
    
    if (keys.length === 0) {
      console.log('   ✅ 동기화 큐가 비어있습니다 (모든 변경사항이 DB에 저장됨)');
    } else {
      console.log('   ⚠️ 동기화 대기 중인 항목들:');
      
      // 타입별로 분류
      const byType: Record<string, number> = {};
      for (const key of keys) {
        const parts = key.split(':');
        const type = parts[1] || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
      }
      
      for (const [type, count] of Object.entries(byType)) {
        console.log(`   - ${type}: ${count}개`);
      }
      
      // 샘플 데이터 출력
      console.log('\n   샘플 데이터 (최근 5개):');
      for (const key of keys.slice(0, 5)) {
        const data = await client.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const age = Date.now() - parsed.timestamp;
          console.log(`   - ${key}`);
          console.log(`     타입: ${parsed.type}, 대기시간: ${Math.floor(age / 1000)}초`);
        }
      }
    }
    
    // 2. 일반 캐시 확인
    console.log('\n2. General 캐시 확인 (최근 5개)');
    const generalKeys = await client.keys('model:general:*');
    console.log(`   총 ${generalKeys.length}개의 장수가 캐시됨`);
    
    if (generalKeys.length > 0) {
      const sampleKey = generalKeys[0];
      const sampleData = await client.get(sampleKey);
      if (sampleData) {
        const parsed = JSON.parse(sampleData);
        console.log(`   샘플: ${sampleKey}`);
        console.log(`   - no: ${parsed.no || parsed.data?.no}`);
        console.log(`   - name: ${parsed.name || parsed.data?.name}`);
        console.log(`   - nation: ${parsed.nation || parsed.data?.nation}`);
      }
    }
    
    // 3. Command Queue 확인
    console.log('\n3. Command Queue 상태');
    const streamInfo = await client.xinfo('STREAM', 'game:commands').catch(() => null);
    if (streamInfo) {
      console.log(`   Stream 길이: ${streamInfo[1]} 메시지`);
    } else {
      console.log('   Stream이 비어있거나 존재하지 않음');
    }
    
    await RedisService.disconnect();
    console.log('\n완료!');
    process.exit(0);
  } catch (error: any) {
    console.error('에러:', error.message);
    process.exit(1);
  }
}

checkSyncQueue();
