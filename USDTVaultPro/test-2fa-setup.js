import axios from 'axios';

// Test 2FA setup flow
async function test2FASetup() {
  const baseURL = 'http://localhost:5000';
  
  try {
    // Step 1: Login first
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'demo',
      password: 'demo123'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful, got token:', token ? 'Yes' : 'No');
    
    // Step 2: Setup 2FA
    console.log('\nStep 2: Setting up 2FA...');
    const setupResponse = await axios.post(
      `${baseURL}/api/auth/2fa/setup`,
      { password: 'demo123' },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('\n2FA Setup Response:');
    console.log('- Has qrCode:', !!setupResponse.data.qrCode);
    console.log('- qrCode starts with:', setupResponse.data.qrCode ? setupResponse.data.qrCode.substring(0, 50) + '...' : 'N/A');
    console.log('- Has manualEntryKey:', !!setupResponse.data.manualEntryKey);
    console.log('- App Name:', setupResponse.data.appName);
    
    // Check if it's an OTP auth URL (should start with otpauth://)
    if (setupResponse.data.qrCode) {
      const isOTPAuthURL = setupResponse.data.qrCode.startsWith('otpauth://');
      const isDataURL = setupResponse.data.qrCode.startsWith('data:image');
      
      console.log('\nQR Code Format Check:');
      console.log('- Is OTP Auth URL (expected):', isOTPAuthURL ? '✓ YES' : '✗ NO');
      console.log('- Is Data URL (not expected):', isDataURL ? '✗ YES' : '✓ NO');
      
      if (isOTPAuthURL) {
        console.log('\n✓ SUCCESS: Backend is now sending the correct OTP auth URL format!');
        console.log('The QRCodeSVG component in the frontend should now work correctly.');
      } else if (isDataURL) {
        console.log('\n✗ ERROR: Backend is still sending a data URL instead of OTP auth URL!');
        console.log('This will cause "Data too long" error in QRCodeSVG component.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

test2FASetup();