// Test script to verify login works correctly
const testLogin = async () => {
  const baseUrl = 'http://localhost:5000';
  
  console.log('Testing login endpoint...');
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'demo',
        password: 'demo123'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('Token received:', data.token);
      console.log('User data:', data.user);
      
      // Now test the verify endpoint with the token
      console.log('\nTesting token verification...');
      const verifyResponse = await fetch(`${baseUrl}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      
      const verifyData = await verifyResponse.json();
      
      if (verifyResponse.ok) {
        console.log('✅ Token verification successful!');
        console.log('Verified user:', verifyData);
      } else {
        console.log('❌ Token verification failed:', verifyData);
      }
    } else {
      console.log('❌ Login failed:', data);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
testLogin();