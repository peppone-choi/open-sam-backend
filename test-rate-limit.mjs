import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8080';

async function testRateLimit() {
  console.log('Testing rate limiting...\n');
  
  // Test 1: Global rate limiter (should allow 1000 requests in 15 min)
  console.log('Test 1: Testing global rate limiter (health endpoint)');
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    console.log(`Request ${i+1}: ${res.status} - ${JSON.stringify(data)}`);
  }
  
  console.log('\nTest 2: Testing auth rate limiter (login endpoint)');
  // Test 2: Auth rate limiter (should allow only 5 requests in 15 min)
  for (let i = 0; i < 7; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' })
      });
      const data = await res.json();
      console.log(`Request ${i+1}: ${res.status} - ${data.error || data.message}`);
      
      // Show rate limit headers
      if (res.headers.get('ratelimit-limit')) {
        console.log(`  Rate Limit: ${res.headers.get('ratelimit-remaining')}/${res.headers.get('ratelimit-limit')}`);
      }
    } catch (error) {
      console.log(`Request ${i+1}: Error - ${error.message}`);
    }
  }
}

testRateLimit().catch(console.error);
