import fetch from 'node-fetch';

async function testTransaction() {
  try {
    // Login first to get token
    console.log('Logging in...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testingacc',
        password: 'testing'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', loginData);
    
    if (!loginData.token) {
      throw new Error('No token received');
    }
    
    // Create a test transaction
    console.log('\nCreating test transaction...');
    const txRes = await fetch('http://localhost:5000/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      },
      body: JSON.stringify({
        type: 'send',
        amount: '100',
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
        currency: 'USDT',
        status: 'completed'
      })
    });
    
    const txData = await txRes.json();
    console.log('Transaction response:', txData);
    
    // Fetch transactions to verify
    console.log('\nFetching transactions...');
    const getRes = await fetch('http://localhost:5000/api/transactions', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });
    
    const transactions = await getRes.json();
    console.log('Retrieved transactions:', transactions);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTransaction();