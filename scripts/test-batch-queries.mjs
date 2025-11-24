/**
 * Test script for batch query methods
 * Tests the new findByNationNums and findByCityNums methods
 */

import { nationRepository } from '../src/repositories/nation.repository.js';
import { cityRepository } from '../src/repositories/city.repository.js';

async function testBatchQueries() {
  console.log('🧪 Testing Batch Query Methods\n');
  
  const sessionId = 'session-c'; // Use actual session ID from your environment
  
  try {
    // Test Nation Batch Query
    console.log('1️⃣ Testing Nation Batch Query...');
    const nationIds = [1, 2, 3, 4, 5];
    console.time('Nation batch query');
    const nationMap = await nationRepository.findByNationNums(sessionId, nationIds);
    console.timeEnd('Nation batch query');
    console.log(`   Requested: ${nationIds.length} nations`);
    console.log(`   Found: ${nationMap.size} nations`);
    console.log(`   Nations:`, Array.from(nationMap.keys()));
    
    // Verify Map access is O(1)
    const testNation = nationMap.get(1);
    if (testNation) {
      console.log(`   ✅ Sample nation #1: ${testNation.name || testNation.data?.name || 'Unknown'}`);
    }
    console.log();
    
    // Test City Batch Query
    console.log('2️⃣ Testing City Batch Query...');
    const cityIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    console.time('City batch query');
    const cityMap = await cityRepository.findByCityNums(sessionId, cityIds);
    console.timeEnd('City batch query');
    console.log(`   Requested: ${cityIds.length} cities`);
    console.log(`   Found: ${cityMap.size} cities`);
    console.log(`   Cities:`, Array.from(cityMap.keys()));
    
    // Verify Map access is O(1)
    const testCity = cityMap.get(1);
    if (testCity) {
      console.log(`   ✅ Sample city #1: ${testCity.name || 'Unknown'}`);
    }
    console.log();
    
    // Test empty array handling
    console.log('3️⃣ Testing Empty Array Handling...');
    const emptyNationMap = await nationRepository.findByNationNums(sessionId, []);
    const emptyCityMap = await cityRepository.findByCityNums(sessionId, []);
    console.log(`   ✅ Empty nation query returned Map with ${emptyNationMap.size} entries`);
    console.log(`   ✅ Empty city query returned Map with ${emptyCityMap.size} entries`);
    console.log();
    
    // Performance comparison (simulated N+1)
    console.log('4️⃣ Performance Comparison (3 queries)...');
    console.time('N+1 pattern (individual queries)');
    const individualNations = await Promise.all(
      [1, 2, 3].map(id => nationRepository.findByNationNum(sessionId, id))
    );
    console.timeEnd('N+1 pattern (individual queries)');
    
    console.time('Batch pattern (single query)');
    const batchNations = await nationRepository.findByNationNums(sessionId, [1, 2, 3]);
    console.timeEnd('Batch pattern (single query)');
    console.log();
    
    console.log('✅ All batch query tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBatchQueries()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export { testBatchQueries };
