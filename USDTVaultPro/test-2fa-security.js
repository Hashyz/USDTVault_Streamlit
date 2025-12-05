#!/usr/bin/env node

/**
 * Test script for 2FA security implementation
 * Tests all critical security requirements
 */

const axios = require('axios');
const readline = require('readline');
const crypto = require('crypto');

const API_BASE = 'http://localhost:5000/api';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

// Test data
const testUser = {
  username: `test_${crypto.randomBytes(4).toString('hex')}`,
  password: 'SecurePassword123!'
};

let authToken = '';
let tempToken = '';
let backupCodes = [];

// Colors for output
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

function logTest(testName) {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  log(`TEST: ${testName}`, 'yellow');
  console.log(`${colors.blue}========================================${colors.reset}`);
}

async function makeRequest(method, url, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${url}`,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

async function testRegistration() {
  logTest('User Registration');
  
  const result = await makeRequest('POST', '/auth/register', testUser);
  
  if (result.success) {
    authToken = result.data.token;
    log('✓ User registered successfully', 'green');
    log(`  Username: ${testUser.username}`);
    log(`  Token received: ${authToken ? 'Yes' : 'No'}`);
    return true;
  } else {
    log(`✗ Registration failed: ${result.error}`, 'red');
    return false;
  }
}

async function test2FASetup() {
  logTest('2FA Setup');
  
  // Step 1: Initiate setup with password
  log('Step 1: Initiating 2FA setup with password...');
  const setupResult = await makeRequest('POST', '/auth/2fa/setup', {
    password: testUser.password
  }, authToken);
  
  if (!setupResult.success) {
    log(`✗ 2FA setup initiation failed: ${setupResult.error}`, 'red');
    return false;
  }
  
  log('✓ 2FA setup initiated', 'green');
  log(`  QR Code received: ${setupResult.data.qrCode ? 'Yes' : 'No'}`);
  log(`  Manual entry key received: ${setupResult.data.manualEntryKey ? 'Yes' : 'No'}`);
  
  // Step 2: Get TOTP code from user
  const totpCode = await question('\nEnter the 6-digit code from your authenticator app: ');
  
  // Step 3: Verify TOTP and complete setup
  log('\nStep 2: Verifying TOTP code and enabling 2FA...');
  const verifyResult = await makeRequest('POST', '/auth/2fa/verify', {
    code: totpCode
  }, authToken);
  
  if (!verifyResult.success) {
    log(`✗ 2FA verification failed: ${verifyResult.error}`, 'red');
    return false;
  }
  
  log('✓ 2FA enabled successfully', 'green');
  
  // Check if backup codes were returned (should be returned only during initial setup)
  if (verifyResult.data.backupCodes) {
    backupCodes = verifyResult.data.backupCodes;
    log(`  Backup codes received: ${backupCodes.length} codes`, 'green');
    log('\n  BACKUP CODES (Save these securely!):', 'yellow');
    backupCodes.forEach((code, i) => {
      log(`    ${i + 1}. ${code}`);
    });
  } else {
    log('✗ No backup codes received during setup!', 'red');
    return false;
  }
  
  return true;
}

async function testPasswordVerificationInDisable() {
  logTest('Password Verification in 2FA Disable');
  
  // Test 1: Try to disable with wrong password
  log('Test 1: Attempting to disable 2FA with incorrect password...');
  const wrongPasswordResult = await makeRequest('POST', '/auth/2fa/disable', {
    password: 'WrongPassword123!'
  }, authToken);
  
  if (wrongPasswordResult.success) {
    log('✗ SECURITY ISSUE: 2FA was disabled with wrong password!', 'red');
    return false;
  } else {
    log(`✓ Correctly rejected: ${wrongPasswordResult.error}`, 'green');
  }
  
  // Test 2: Try to disable without any password
  log('\nTest 2: Attempting to disable 2FA without password...');
  const noPasswordResult = await makeRequest('POST', '/auth/2fa/disable', {}, authToken);
  
  if (noPasswordResult.success) {
    log('✗ SECURITY ISSUE: 2FA was disabled without password!', 'red');
    return false;
  } else {
    log(`✓ Correctly rejected: ${noPasswordResult.error}`, 'green');
  }
  
  // Test 3: Get current TOTP code for valid disable
  const totpCode = await question('\nEnter current TOTP code to test valid disable: ');
  
  log('\nTest 3: Attempting to disable 2FA with correct password and code...');
  const correctResult = await makeRequest('POST', '/auth/2fa/disable', {
    password: testUser.password,
    code: totpCode
  }, authToken);
  
  if (!correctResult.success) {
    log(`✗ Failed to disable with correct credentials: ${correctResult.error}`, 'red');
    return false;
  }
  
  log('✓ 2FA disabled successfully with correct password', 'green');
  
  // Re-enable 2FA for further tests
  log('\nRe-enabling 2FA for further tests...');
  await makeRequest('POST', '/auth/2fa/setup', { password: testUser.password }, authToken);
  const reEnableCode = await question('Enter TOTP code to re-enable 2FA: ');
  const reEnableResult = await makeRequest('POST', '/auth/2fa/verify', { code: reEnableCode }, authToken);
  
  if (reEnableResult.success && reEnableResult.data.backupCodes) {
    backupCodes = reEnableResult.data.backupCodes;
    log('✓ 2FA re-enabled successfully', 'green');
  }
  
  return true;
}

async function testBackupCodeSecurity() {
  logTest('Backup Code Security');
  
  // Test 1: Check 2FA status endpoint doesn't return codes
  log('Test 1: Checking 2FA status endpoint...');
  const statusResult = await makeRequest('GET', '/auth/2fa/status', null, authToken);
  
  if (statusResult.success) {
    log('✓ Status endpoint response received', 'green');
    
    // Check if any sensitive data is exposed
    if (statusResult.data.backupCodes || statusResult.data.secret) {
      log('✗ SECURITY ISSUE: Status endpoint exposes sensitive data!', 'red');
      log(`  Data exposed: ${JSON.stringify(statusResult.data)}`, 'red');
      return false;
    } else {
      log('✓ No sensitive data exposed in status', 'green');
      log(`  Response: ${JSON.stringify(statusResult.data)}`);
    }
  }
  
  // Test 2: Try to verify TOTP again (should not return backup codes)
  log('\nTest 2: Verifying TOTP code again (should not return backup codes)...');
  const totpCode = await question('Enter current TOTP code: ');
  
  const verifyAgainResult = await makeRequest('POST', '/auth/2fa/verify', {
    code: totpCode
  }, authToken);
  
  if (verifyAgainResult.data && verifyAgainResult.data.backupCodes) {
    log('✗ SECURITY ISSUE: Backup codes returned on subsequent verify!', 'red');
    return false;
  } else {
    log('✓ No backup codes returned on subsequent verify', 'green');
  }
  
  return true;
}

async function testBackupCodeLogin() {
  logTest('Backup Code Login and Consumption');
  
  // First, logout to test login with 2FA
  log('Logging out to test 2FA login...');
  authToken = '';
  
  // Step 1: Login with username/password
  log('\nStep 1: Initial login...');
  const loginResult = await makeRequest('POST', '/auth/login', testUser);
  
  if (!loginResult.success) {
    log(`✗ Login failed: ${loginResult.error}`, 'red');
    return false;
  }
  
  if (!loginResult.data.requires2FA) {
    log('✗ 2FA not required for login!', 'red');
    return false;
  }
  
  tempToken = loginResult.data.tempToken;
  log('✓ Initial login successful, 2FA required', 'green');
  log(`  Temp token received: ${tempToken ? 'Yes' : 'No'}`);
  
  // Step 2: Login with backup code
  if (backupCodes.length === 0) {
    log('✗ No backup codes available for testing', 'red');
    return false;
  }
  
  const backupCodeToUse = backupCodes[0];
  log(`\nStep 2: Attempting login with backup code: ${backupCodeToUse}`);
  
  const backupLoginResult = await makeRequest('POST', '/auth/2fa/login-verify', {
    tempToken,
    code: backupCodeToUse
  });
  
  if (!backupLoginResult.success) {
    log(`✗ Backup code login failed: ${backupLoginResult.error}`, 'red');
    return false;
  }
  
  authToken = backupLoginResult.data.token;
  log('✓ Login successful with backup code', 'green');
  
  // Check that response doesn't contain sensitive data
  if (backupLoginResult.data.backupCodes || backupLoginResult.data.secret) {
    log('✗ SECURITY ISSUE: Login response contains sensitive data!', 'red');
    return false;
  }
  
  // Check if backupCodeUsed flag is exposed (it shouldn't be after our fix)
  if ('backupCodeUsed' in backupLoginResult.data) {
    log('✗ SECURITY ISSUE: backupCodeUsed flag exposed in response!', 'red');
    return false;
  } else {
    log('✓ No backupCodeUsed flag in response (secure)', 'green');
  }
  
  // Step 3: Try to use the same backup code again
  log('\nStep 3: Testing backup code consumption...');
  
  // Logout and login again
  authToken = '';
  const loginAgainResult = await makeRequest('POST', '/auth/login', testUser);
  tempToken = loginAgainResult.data.tempToken;
  
  log(`Attempting to reuse backup code: ${backupCodeToUse}`);
  const reuseResult = await makeRequest('POST', '/auth/2fa/login-verify', {
    tempToken,
    code: backupCodeToUse
  });
  
  if (reuseResult.success) {
    log('✗ SECURITY ISSUE: Backup code was reused!', 'red');
    return false;
  } else {
    log('✓ Backup code correctly rejected (already used)', 'green');
  }
  
  // Step 4: Try with a different backup code
  if (backupCodes.length > 1) {
    const secondBackupCode = backupCodes[1];
    log(`\nStep 4: Using a fresh backup code: ${secondBackupCode}`);
    
    const freshBackupResult = await makeRequest('POST', '/auth/2fa/login-verify', {
      tempToken,
      code: secondBackupCode
    });
    
    if (freshBackupResult.success) {
      authToken = freshBackupResult.data.token;
      log('✓ Fresh backup code worked correctly', 'green');
    } else {
      log(`✗ Fresh backup code failed: ${freshBackupResult.error}`, 'red');
      return false;
    }
  }
  
  return true;
}

async function testUIFunctionality() {
  logTest('UI Functionality Check');
  
  log('Testing that API endpoints work correctly after security fixes...\n');
  
  // Test various authenticated endpoints
  const endpoints = [
    { method: 'GET', path: '/auth/2fa/status', name: '2FA Status' },
    { method: 'GET', path: '/auth/verify', name: 'Auth Verify' },
    { method: 'GET', path: '/wallet/balance', name: 'Wallet Balance' }
  ];
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    const result = await makeRequest(endpoint.method, endpoint.path, null, authToken);
    
    if (result.success) {
      log(`✓ ${endpoint.name}: Working`, 'green');
      
      // Verify no sensitive data is exposed
      if (result.data && (result.data.backupCodes || result.data.secret || result.data.twoFactorSecret)) {
        log(`  ✗ WARNING: Sensitive data exposed!`, 'red');
        allPassed = false;
      }
    } else {
      log(`✗ ${endpoint.name}: Failed - ${result.error}`, 'red');
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function runAllTests() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     2FA SECURITY TEST SUITE            ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}\n`);
  
  const tests = [
    { name: 'User Registration', fn: testRegistration },
    { name: '2FA Setup', fn: test2FASetup },
    { name: 'Password Verification in Disable', fn: testPasswordVerificationInDisable },
    { name: 'Backup Code Security', fn: testBackupCodeSecurity },
    { name: 'Backup Code Login and Consumption', fn: testBackupCodeLogin },
    { name: 'UI Functionality', fn: testUIFunctionality }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
      
      if (!passed) {
        log(`\n⚠️  Stopping tests due to failure in: ${test.name}`, 'yellow');
        break;
      }
    } catch (error) {
      log(`\n✗ Test "${test.name}" threw an error: ${error.message}`, 'red');
      results.push({ name: test.name, passed: false });
      break;
    }
  }
  
  // Print summary
  console.log(`\n${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║           TEST SUMMARY                 ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}\n`);
  
  let passedCount = 0;
  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
    if (result.passed) passedCount++;
  });
  
  const totalTests = results.length;
  const allPassed = passedCount === tests.length;
  
  console.log(`\n${colors.blue}────────────────────────────────────────${colors.reset}`);
  log(`Passed: ${passedCount}/${totalTests} tests`, allPassed ? 'green' : 'yellow');
  
  if (allPassed) {
    log('\n🎉 All security tests passed!', 'green');
  } else {
    log('\n⚠️  Some tests did not complete or failed', 'yellow');
  }
  
  rl.close();
  process.exit(allPassed ? 0 : 1);
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE}/health`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('✗ Server is not running on port 5000', 'red');
      log('  Please start the server with: npm run dev', 'yellow');
      return false;
    }
    // Server is running but /health doesn't exist, that's OK
    return true;
  }
}

// Main execution
(async () => {
  log('Checking server availability...', 'blue');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    rl.close();
    process.exit(1);
  }
  
  log('✓ Server is running\n', 'green');
  
  // Run all tests
  await runAllTests();
})();