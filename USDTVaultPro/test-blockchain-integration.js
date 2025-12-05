const { ethers } = require('ethers');

// Configuration
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
const WALLET_ADDRESS = '0xe5e7F409E2627FDF3EeeE6a9CB5A042ebdA19318';
const USDT_CONTRACT = '0x55d398326f99059ff775485246999027b3197955';

// USDT ABI (minimal)
const USDT_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

async function testBlockchainIntegration() {
  console.log('=== Testing Blockchain Integration ===\n');
  console.log(`Testing wallet address: ${WALLET_ADDRESS}`);
  console.log(`BSC RPC: ${BSC_RPC_URL}`);
  console.log(`USDT Contract: ${USDT_CONTRACT}\n`);

  try {
    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    console.log('✅ Connected to BSC network');

    // Check BNB balance
    const bnbBalance = await provider.getBalance(WALLET_ADDRESS);
    const bnbFormatted = ethers.formatEther(bnbBalance);
    console.log(`\n📊 BNB Balance: ${bnbFormatted} BNB`);

    // Check USDT balance
    const usdtContract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, provider);
    const usdtBalance = await usdtContract.balanceOf(WALLET_ADDRESS);
    const decimals = await usdtContract.decimals();
    const usdtFormatted = ethers.formatUnits(usdtBalance, decimals);
    console.log(`💰 USDT Balance: ${usdtFormatted} USDT`);

    // Calculate total USD value (assuming BNB = $300)
    const bnbPrice = 300;
    const bnbValueUSD = parseFloat(bnbFormatted) * bnbPrice;
    const totalUSD = parseFloat(usdtFormatted) + bnbValueUSD;
    console.log(`\n💵 Total USD Value: $${totalUSD.toFixed(2)}`);
    console.log(`  - BNB Value: $${bnbValueUSD.toFixed(2)}`);
    console.log(`  - USDT Value: $${parseFloat(usdtFormatted).toFixed(2)}`);

    // Test BSCScan API
    console.log('\n📜 Fetching transaction history from BSCScan...');
    const bscscanUrl = `https://api.bscscan.com/api?module=account&action=tokentx&address=${WALLET_ADDRESS}&sort=desc`;
    const response = await fetch(bscscanUrl);
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      const usdtTxs = data.result.filter(tx => 
        tx.contractAddress?.toLowerCase() === USDT_CONTRACT.toLowerCase()
      );
      console.log(`  - Found ${data.result.length} total token transactions`);
      console.log(`  - Found ${usdtTxs.length} USDT transactions`);
      
      if (usdtTxs.length > 0) {
        console.log('\n  Recent USDT transactions:');
        usdtTxs.slice(0, 3).forEach(tx => {
          const amount = ethers.formatUnits(tx.value, tx.tokenDecimal || 18);
          const date = new Date(parseInt(tx.timeStamp) * 1000).toLocaleString();
          const type = tx.to.toLowerCase() === WALLET_ADDRESS.toLowerCase() ? 'Received' : 'Sent';
          console.log(`    - ${type} ${amount} USDT on ${date}`);
        });
      }
    }

    console.log('\n✅ Blockchain integration test completed successfully!');
    
    if (parseFloat(usdtFormatted) > 0 || parseFloat(bnbFormatted) > 0) {
      console.log('\n🎉 The wallet has funds! Integration is working correctly.');
    } else {
      console.log('\n⚠️  The wallet appears to be empty. The user mentioned adding $10.');
      console.log('   Please verify the correct wallet address is being used.');
    }

  } catch (error) {
    console.error('❌ Error testing blockchain integration:', error.message);
  }
}

// Run the test
testBlockchainIntegration();