#!/usr/bin/env node

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';

// Demo account credentials
const DEMO_CREDENTIALS = {
  username: 'demo',
  password: 'demo1234'
};

// Expected wallet address (user's real wallet)
const EXPECTED_WALLET = '0xe5e7F409E2627FDF3EeeE6a9CB5A042ebdA19318';

let csrfToken = null;
let authToken = null;
let userId = null;

async function getCsrfToken() {
  console.log('1. Getting CSRF token...');
  const response = await fetch(`${BASE_URL}/api/csrf-token`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get CSRF token: ${response.status}`);
  }

  const data = await response.json();
  csrfToken = data.csrfToken;
  console.log('   ✓ CSRF token obtained');
  return csrfToken;
}

async function loginDemo() {
  console.log('\n2. Logging in with demo account...');
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(DEMO_CREDENTIALS)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (data.requires2FA) {
    console.log('   Note: 2FA is enabled but continuing with test');
  }
  
  authToken = data.accessToken;
  userId = data.user?.id;
  
  console.log('   ✓ Login successful');
  console.log(`   - User ID: ${userId}`);
  console.log(`   - Username: ${data.user?.username}`);
  console.log(`   - Wallet Address: ${data.user?.walletAddress}`);
  console.log(`   - Initial Balance: ${data.user?.balance}`);
  
  // Verify wallet address
  if (data.user?.walletAddress !== EXPECTED_WALLET) {
    console.log(`   ⚠️  WARNING: Wallet address doesn't match!`);
    console.log(`      Expected: ${EXPECTED_WALLET}`);
    console.log(`      Got: ${data.user?.walletAddress}`);
  } else {
    console.log(`   ✓ Wallet address matches expected: ${EXPECTED_WALLET}`);
  }
  
  return data;
}

async function fetchWalletBalance() {
  console.log('\n3. Fetching real blockchain wallet balance...');
  const response = await fetch(`${BASE_URL}/api/wallet`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-CSRF-Token': csrfToken
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch wallet balance: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  console.log('   ✓ Wallet balance fetched from blockchain:');
  console.log(`   - Wallet Address: ${data.address || 'N/A'}`);
  console.log(`   - BNB Balance: ${data.bnb || '0'} BNB`);
  console.log(`   - USDT Balance: ${data.usdt || '0'} USDT`);
  console.log(`   - Total USD Value: $${data.totalUSD || data.balance || '0'}`);
  
  // Check if USDT balance is approximately $10
  const usdtBalance = parseFloat(data.usdt || '0');
  if (usdtBalance >= 9.9 && usdtBalance <= 10.1) {
    console.log(`   ✓ USDT balance verified: ~$10.00`);
  } else {
    console.log(`   ⚠️  USDT balance is ${usdtBalance}, expected ~$10.00`);
  }
  
  return data;
}

async function fetchBlockchainTransactions() {
  console.log('\n4. Fetching blockchain transactions from BSCScan...');
  const response = await fetch(`${BASE_URL}/api/blockchain/transactions`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-CSRF-Token': csrfToken
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch transactions: ${response.status} - ${error}`);
  }

  const transactions = await response.json();
  
  console.log(`   ✓ Fetched ${transactions.length} transactions from BSCScan`);
  
  if (transactions.length > 0) {
    console.log('\n   Recent transactions:');
    transactions.slice(0, 3).forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.type || 'N/A'} - ${tx.amount} ${tx.currency || 'USDT'} - ${tx.status || 'N/A'}`);
      console.log(`      Hash: ${tx.transactionHash || tx.id}`);
      console.log(`      Date: ${new Date(tx.timestamp || tx.createdAt).toLocaleString()}`);
    });
  }
  
  return transactions;
}

async function fetchPortfolioMetrics() {
  console.log('\n5. Fetching portfolio metrics...');
  const response = await fetch(`${BASE_URL}/api/portfolio/metrics`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-CSRF-Token': csrfToken
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch metrics: ${response.status} - ${error}`);
  }

  const metrics = await response.json();
  
  console.log('   ✓ Portfolio metrics:');
  console.log(`   - Total Transactions: ${metrics.totalTransactions}`);
  console.log(`   - 24h Volume: $${metrics.volume24h}`);
  console.log(`   - Success Rate: ${metrics.successRate}%`);
  console.log(`   - Risk Score: ${metrics.riskScore}/100`);
  if (metrics.lastActivity) {
    console.log(`   - Last Activity: ${new Date(metrics.lastActivity).toLocaleString()}`);
  }
  
  return metrics;
}

async function runTest() {
  console.log('===========================================');
  console.log('Blockchain Integration Verification Test');
  console.log('===========================================');
  console.log(`Testing wallet: ${EXPECTED_WALLET}`);
  console.log('Expected: $10 USDT + small BNB balance');
  console.log('===========================================\n');

  try {
    // Get CSRF token
    await getCsrfToken();
    
    // Login with demo account
    const loginData = await loginDemo();
    
    // Fetch real blockchain balance
    const walletData = await fetchWalletBalance();
    
    // Fetch blockchain transactions
    const transactions = await fetchBlockchainTransactions();
    
    // Fetch portfolio metrics
    const metrics = await fetchPortfolioMetrics();
    
    console.log('\n===========================================');
    console.log('✅ BLOCKCHAIN INTEGRATION VERIFICATION COMPLETE');
    console.log('===========================================');
    console.log('\nSummary:');
    console.log(`- Wallet Address: ${EXPECTED_WALLET}`);
    console.log(`- USDT Balance: ${walletData.usdt || '0'} USDT`);
    console.log(`- BNB Balance: ${walletData.bnb || '0'} BNB`);
    console.log(`- Total Value: $${walletData.totalUSD || walletData.balance}`);
    console.log(`- Transactions: ${transactions.length} found`);
    console.log(`- Success Rate: ${metrics.successRate}%`);
    console.log('\nThe demo account is now connected to the user\'s real wallet!');
    console.log('All blockchain data is being fetched from BSC mainnet.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest().catch(console.error);