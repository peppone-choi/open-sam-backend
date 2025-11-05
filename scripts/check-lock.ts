import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
});

async function checkLock() {
  const sessionId = process.argv[2] || 'sangokushi_default';
  const lockKey = `execute_engine_lock:${sessionId}`;
  
  try {
    const exists = await redis.exists(lockKey);
    const ttl = await redis.ttl(lockKey);
    
    if (exists) {
      console.log(`🔒 Lock exists: ${lockKey}`);
      console.log(`   TTL: ${ttl} seconds (${ttl > 0 ? `expires in ${ttl}s` : 'expired but not deleted'})`);
      
      const value = await redis.get(lockKey);
      console.log(`   Value: ${value}`);
      
      if (process.argv[3] === '--delete') {
        await redis.del(lockKey);
        console.log(`✅ Lock deleted`);
      } else {
        console.log(`💡 To delete: node dist/scripts/check-lock.js ${sessionId} --delete`);
      }
    } else {
      console.log(`✅ No lock found: ${lockKey}`);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await redis.quit();
  }
}

checkLock();



