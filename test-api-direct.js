// Quick API test script

async function testAPI() {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🧪 Testing API Endpoints Directly');
  console.log('=====================================');
  
  try {
    // Test beings API
    console.log('\n1. Testing beings API...');
    const beingsResponse = await fetch(`${BASE_URL}/api/beings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        spaceId: '@test-space'
      })
    });
    
    console.log('Beings API Status:', beingsResponse.status);
    const beingsData = await beingsResponse.json();
    console.log('Beings API Response:', beingsData);
    
    // Test intentions API
    console.log('\n2. Testing intentions API...');
    const intentionsResponse = await fetch(`${BASE_URL}/api/intentions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        spaceId: '@test-space'
      })
    });
    
    console.log('Intentions API Status:', intentionsResponse.status);
    const intentionsData = await intentionsResponse.json();
    console.log('Intentions API Response:', intentionsData);
    
    // Test sync endpoint (just check headers)
    console.log('\n3. Testing sync endpoint...');
    const syncResponse = await fetch(`${BASE_URL}/api/sync?spaceId=@test-space&types=beings,intentions`);
    console.log('Sync API Status:', syncResponse.status);
    console.log('Sync API Headers:', Object.fromEntries(syncResponse.headers.entries()));
    
    if (syncResponse.ok) {
      console.log('✅ All API endpoints responding correctly');
    } else {
      console.log('❌ Some API endpoints have issues');
    }
    
  } catch (error) {
    console.error('❌ API Test Error:', error.message);
  }
}

// Only run if server is available
fetch('http://localhost:3000')
  .then(() => testAPI())
  .catch(() => console.log('⚠️  Server not running at localhost:3000. Start with: npm run dev'));