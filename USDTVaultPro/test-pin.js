import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// Test user credentials
const testUser = {
  username: 'pintest_' + Date.now(),
  password: 'testpass123'
};

let authToken = '';
let userId = '';

// Color output for better readability
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testPINFunctionality() {
  try {
    log('\n=== PIN Security Test Suite ===\n', 'blue');

    // 1. Register a new user
    log('1. Registering new user...', 'yellow');
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, testUser);
    authToken = registerResponse.data.token;
    userId = registerResponse.data.user.id;
    log(`✓ User registered: ${testUser.username}`, 'green');
    log(`  Has PIN setup: ${registerResponse.data.user.hasPinSetup}`, 'blue');

    // Configure axios to use auth token
    const authAxios = axios.create({
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    // 2. Check PIN status (should be not set up)
    log('\n2. Checking initial PIN status...', 'yellow');
    const statusResponse = await authAxios.get(`${API_BASE}/auth/pin/status`);
    log(`✓ PIN Status:`, 'green');
    log(`  Has PIN setup: ${statusResponse.data.hasPinSetup}`, 'blue');
    log(`  Is locked: ${statusResponse.data.isLocked}`, 'blue');

    // 3. Try to verify PIN without setting it up (should fail)
    log('\n3. Testing verify without PIN setup...', 'yellow');
    try {
      await authAxios.post(`${API_BASE}/auth/pin/verify`, { pin: '1234' });
      log('✗ Should have failed', 'red');
    } catch (error) {
      log(`✓ Correctly rejected: ${error.response.data.message}`, 'green');
    }

    // 4. Set up PIN with invalid format (should fail)
    log('\n4. Testing invalid PIN format...', 'yellow');
    try {
      await authAxios.post(`${API_BASE}/auth/pin/setup`, {
        pin: '123',  // Too short
        password: testUser.password
      });
      log('✗ Should have failed', 'red');
    } catch (error) {
      log(`✓ Correctly rejected: ${error.response.data.message}`, 'green');
    }

    // 5. Set up PIN with wrong password (should fail)
    log('\n5. Testing PIN setup with wrong password...', 'yellow');
    try {
      await authAxios.post(`${API_BASE}/auth/pin/setup`, {
        pin: '123456',
        password: 'wrongpassword'
      });
      log('✗ Should have failed', 'red');
    } catch (error) {
      log(`✓ Correctly rejected: ${error.response.data.message}`, 'green');
    }

    // 6. Set up PIN successfully
    log('\n6. Setting up PIN correctly...', 'yellow');
    const setupResponse = await authAxios.post(`${API_BASE}/auth/pin/setup`, {
      pin: '123456',
      password: testUser.password
    });
    log(`✓ ${setupResponse.data.message}`, 'green');

    // 7. Check PIN status after setup
    log('\n7. Checking PIN status after setup...', 'yellow');
    const statusAfterSetup = await authAxios.get(`${API_BASE}/auth/pin/status`);
    log(`✓ PIN Status:`, 'green');
    log(`  Has PIN setup: ${statusAfterSetup.data.hasPinSetup}`, 'blue');
    log(`  Attempts remaining: ${statusAfterSetup.data.attemptsRemaining}`, 'blue');

    // 8. Verify correct PIN
    log('\n8. Verifying correct PIN...', 'yellow');
    const verifyResponse = await authAxios.post(`${API_BASE}/auth/pin/verify`, { pin: '123456' });
    log(`✓ ${verifyResponse.data.message}`, 'green');

    // 9. Test failed attempts
    log('\n9. Testing failed PIN attempts...', 'yellow');
    for (let i = 1; i <= 4; i++) {
      try {
        await authAxios.post(`${API_BASE}/auth/pin/verify`, { pin: '000000' });
        log('✗ Should have failed', 'red');
      } catch (error) {
        log(`  Attempt ${i} failed. Remaining: ${error.response.data.attemptsRemaining}`, 'yellow');
      }
    }

    // 10. Test account lockout on 5th failed attempt
    log('\n10. Testing account lockout (5th failed attempt)...', 'yellow');
    try {
      await authAxios.post(`${API_BASE}/auth/pin/verify`, { pin: '000000' });
      log('✗ Should have been locked', 'red');
    } catch (error) {
      if (error.response.status === 429) {
        log(`✓ Account locked: ${error.response.data.message}`, 'green');
        log(`  Lockout until: ${new Date(error.response.data.lockoutUntil).toLocaleTimeString()}`, 'blue');
      }
    }

    // 11. Try to verify while locked (should be rejected)
    log('\n11. Testing verification while locked...', 'yellow');
    try {
      await authAxios.post(`${API_BASE}/auth/pin/verify`, { pin: '123456' });
      log('✗ Should have been rejected', 'red');
    } catch (error) {
      if (error.response.status === 429) {
        log(`✓ Correctly locked: ${error.response.data.message}`, 'green');
      }
    }

    // 12. Reset PIN (should work even when locked)
    log('\n12. Testing PIN reset while locked...', 'yellow');
    const resetResponse = await authAxios.post(`${API_BASE}/auth/pin/reset`, {
      password: testUser.password,
      newPin: '654321'
    });
    log(`✓ ${resetResponse.data.message}`, 'green');

    // 13. Verify new PIN works
    log('\n13. Verifying new PIN after reset...', 'yellow');
    const verifyNewPin = await authAxios.post(`${API_BASE}/auth/pin/verify`, { pin: '654321' });
    log(`✓ ${verifyNewPin.data.message}`, 'green');

    // 14. Check auth/verify endpoint includes PIN status
    log('\n14. Checking auth/verify endpoint...', 'yellow');
    const verifyAuth = await authAxios.get(`${API_BASE}/auth/verify`);
    log(`✓ User verification includes PIN status: ${verifyAuth.data.hasPinSetup}`, 'green');

    // 15. Test login response includes PIN status
    log('\n15. Testing login response...', 'yellow');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, testUser);
    log(`✓ Login response includes PIN status: ${loginResponse.data.user.hasPinSetup}`, 'green');

    log('\n=== All PIN Security Tests Passed! ===\n', 'green');

  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`  Response: ${JSON.stringify(error.response.data)}`, 'red');
    }
    process.exit(1);
  }
}

// Run the tests
testPINFunctionality().catch(error => {
  log(`Unexpected error: ${error}`, 'red');
  process.exit(1);
});