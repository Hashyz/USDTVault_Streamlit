import streamlit as st
import os
from qrcode import QRCode
from qrcode.constants import ERROR_CORRECT_L
from io import BytesIO
import base64
from web3 import Web3

st.set_page_config(
    page_title="Wallet Dashboard",
    page_icon="",
    layout="centered",
    initial_sidebar_state="collapsed"
)

WALLET_ADDRESS = os.environ.get("WALLET_ADDRESS", "")
WALLET_USERNAME = os.environ.get("WALLET_USERNAME", "@hashyz")

BSC_RPC_URL = "https://bsc-dataseed.binance.org/"
USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"

USDT_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap');
    
    [data-testid="stSidebarNav"] { display: none !important; }
    [data-testid="stSidebar"] { display: none !important; }
    header[data-testid="stHeader"] { display: none !important; }
    #MainMenu { display: none !important; }
    footer { display: none !important; }
    
    .stApp {
        background-color: #0B0E11;
    }
    
    .main-container {
        max-width: 420px;
        margin: 0 auto;
        padding: 20px;
    }
    
    .portfolio-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border: 2px solid #F0B90B;
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        margin-bottom: 20px;
    }
    
    .username-badge {
        background: #F0B90B;
        color: #0B0E11;
        padding: 8px 20px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 16px;
        display: inline-block;
        margin-bottom: 12px;
    }
    
    .live-indicator {
        color: #0ECB81;
        font-size: 14px;
        margin-bottom: 8px;
    }
    
    .live-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        background: #0ECB81;
        border-radius: 50%;
        margin-right: 6px;
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    .portfolio-label {
        color: #848E9C;
        font-size: 14px;
        margin-bottom: 4px;
    }
    
    .portfolio-value {
        color: #0ECB81;
        font-size: 48px;
        font-weight: 700;
        font-family: 'Roboto Mono', monospace;
    }
    
    .balance-row {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .balance-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border: 1px solid #3C4452;
        border-radius: 12px;
        padding: 20px;
        flex: 1;
        text-align: center;
    }
    
    .balance-label {
        color: #848E9C;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 8px;
        letter-spacing: 0.5px;
    }
    
    .balance-amount {
        color: #0ECB81;
        font-size: 24px;
        font-weight: 600;
        font-family: 'Roboto Mono', monospace;
    }
    
    .balance-token {
        color: #848E9C;
        font-size: 12px;
        margin-top: 4px;
    }
    
    .qr-section {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border: 1px solid #3C4452;
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        margin-bottom: 20px;
    }
    
    .qr-title {
        color: #EAECEF;
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 4px;
    }
    
    .qr-subtitle {
        color: #848E9C;
        font-size: 14px;
        margin-bottom: 20px;
    }
    
    .qr-container {
        background: white;
        padding: 16px;
        border-radius: 12px;
        display: inline-block;
        margin-bottom: 20px;
    }
    
    .address-section {
        background: linear-gradient(135deg, #2B3139 0%, #1E2329 100%);
        border: 1px solid #F0B90B;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
    }
    
    .address-label {
        color: #848E9C;
        font-size: 11px;
        letter-spacing: 1px;
        margin-bottom: 8px;
    }
    
    .address-text {
        color: #F0B90B;
        font-size: 13px;
        font-family: 'Roboto Mono', monospace;
        word-break: break-all;
        line-height: 1.4;
    }
    
    .network-badge {
        background: #F0B90B;
        color: #0B0E11;
        padding: 6px 16px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
        display: inline-block;
    }
    
    .footer-address {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border: 1px solid #3C4452;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
    }
    
    .footer-address-text {
        color: #848E9C;
        font-size: 12px;
        font-family: 'Roboto Mono', monospace;
        word-break: break-all;
    }
    
    .branding {
        text-align: center;
        margin-top: 30px;
        padding: 20px;
    }
    
    .branding img {
        width: 40px;
        height: 40px;
        margin-bottom: 8px;
    }
    
    .branding-text {
        color: #F0B90B;
        font-size: 14px;
        font-weight: 600;
    }
    
    .branding-subtext {
        color: #848E9C;
        font-size: 11px;
    }
    
    .error-message {
        background: rgba(246, 70, 93, 0.1);
        border: 1px solid #F6465D;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        color: #F6465D;
    }
    
    div[data-testid="stVerticalBlock"] > div {
        padding: 0 !important;
    }
</style>
""", unsafe_allow_html=True)

@st.cache_data(ttl=30)
def get_wallet_balances(address):
    try:
        w3 = Web3(Web3.HTTPProvider(BSC_RPC_URL))
        
        if not w3.is_address(address):
            return None, None, None
        
        checksum_address = w3.to_checksum_address(address)
        
        bnb_balance_wei = w3.eth.get_balance(checksum_address)
        bnb_balance = float(w3.from_wei(bnb_balance_wei, 'ether'))
        
        usdt_contract = w3.eth.contract(
            address=w3.to_checksum_address(USDT_CONTRACT_ADDRESS),
            abi=USDT_ABI
        )
        usdt_balance_raw = usdt_contract.functions.balanceOf(checksum_address).call()
        usdt_balance = float(usdt_balance_raw) / (10 ** 18)
        
        bnb_price = 300
        total_usd = usdt_balance + (bnb_balance * bnb_price)
        
        return bnb_balance, usdt_balance, total_usd
    except Exception as e:
        st.error(f"Error fetching balances: {str(e)}")
        return 0, 0, 0

def generate_qr_code(data):
    qr = QRCode(
        version=1,
        error_correction=ERROR_CORRECT_L,
        box_size=8,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return img_str

if not WALLET_ADDRESS:
    st.markdown("""
    <div class="main-container">
        <div class="error-message">
            <h3 style="margin-bottom: 12px;">Wallet Not Configured</h3>
            <p style="margin-bottom: 16px;">Please add your wallet address to the environment variables.</p>
            <p style="font-size: 12px; color: #848E9C;">Set <code>WALLET_ADDRESS</code> in your Secrets</p>
        </div>
    </div>
    """, unsafe_allow_html=True)
else:
    bnb_balance, usdt_balance, total_usd = get_wallet_balances(WALLET_ADDRESS)
    
    if bnb_balance is None or usdt_balance is None or total_usd is None:
        st.markdown(f"""
        <div class="main-container">
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">Invalid Wallet Address</h3>
                <p style="margin-bottom: 16px;">The wallet address provided is not valid.</p>
                <p style="font-size: 12px; color: #848E9C;">Address: <code>{WALLET_ADDRESS}</code></p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        st.stop()
    
    qr_code_base64 = generate_qr_code(WALLET_ADDRESS)
    
    st.markdown(f"""
    <div class="main-container">
        <!-- Portfolio Card -->
        <div class="portfolio-card">
            <div class="username-badge">{WALLET_USERNAME}</div>
            <div class="live-indicator">
                <span class="live-dot"></span>Live from BSC
            </div>
            <div class="portfolio-label">Total Portfolio Value</div>
            <div class="portfolio-value">${total_usd:.2f}</div>
        </div>
        
        <!-- Balance Cards Row -->
        <div class="balance-row">
            <div class="balance-card">
                <div class="balance-label">BNB BALANCE</div>
                <div class="balance-amount">{bnb_balance:.4f}</div>
                <div class="balance-token">BNB</div>
            </div>
            <div class="balance-card">
                <div class="balance-label">USDT BALANCE</div>
                <div class="balance-amount">${usdt_balance:.2f}</div>
                <div class="balance-token">USDT (BEP20)</div>
            </div>
        </div>
        
        <!-- QR Code Section -->
        <div class="qr-section">
            <div class="qr-title">Send to this wallet</div>
            <div class="qr-subtitle">Scan QR code or copy address below</div>
            <div class="qr-container">
                <img src="data:image/png;base64,{qr_code_base64}" width="180" height="180" alt="QR Code">
            </div>
            
            <div class="address-section">
                <div class="address-label">WALLET ADDRESS</div>
                <div class="address-text">{WALLET_ADDRESS}</div>
            </div>
            
            <div class="network-badge">BSC Network<br><span style="font-weight: 400; font-size: 10px;">(BEP20)</span></div>
        </div>
        
        <!-- Footer Address Display -->
        <div class="footer-address">
            <div class="footer-address-text">{WALLET_ADDRESS}</div>
        </div>
        
        <!-- Branding -->
        <div class="branding">
            <div class="branding-text">Powered by BSC</div>
            <div class="branding-subtext">Binance Smart Chain Network</div>
        </div>
    </div>
    """, unsafe_allow_html=True)
