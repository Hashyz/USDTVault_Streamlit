import streamlit as st
from decimal import Decimal
from utils.database import init_db, get_user_by_username
from utils.blockchain import get_wallet_balance
import qrcode
import io
import base64

def generate_qr_code(data):
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1E2329", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

st.set_page_config(
    page_title="Public Profile - USDT Vault Pro",
    page_icon="👤",
    layout="centered"
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap');
    
    .stApp { background-color: #0B0E11; }
    
    .hero-section {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 20px;
        padding: 2.5rem 2rem;
        border: 2px solid #F0B90B;
        text-align: center;
        margin-bottom: 1.5rem;
        position: relative;
        overflow: hidden;
    }
    
    .hero-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #F0B90B, #0ECB81, #F0B90B);
    }
    
    .username-badge {
        display: inline-block;
        background: rgba(240, 185, 11, 0.15);
        border: 1px solid #F0B90B;
        border-radius: 30px;
        padding: 0.5rem 1.5rem;
        margin-bottom: 1rem;
    }
    
    .username-text {
        font-size: 1.5rem;
        font-weight: 700;
        color: #F0B90B;
        font-family: 'Inter', sans-serif;
    }
    
    .live-indicator {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        color: #0ECB81;
        background: rgba(14, 203, 129, 0.1);
        padding: 6px 14px;
        border-radius: 20px;
        margin-bottom: 1rem;
    }
    
    .live-dot {
        width: 8px;
        height: 8px;
        background: #0ECB81;
        border-radius: 50%;
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
    }
    
    .total-balance {
        font-size: 3.5rem;
        font-weight: 700;
        color: #0ECB81;
        font-family: 'Roboto Mono', monospace;
        margin: 0.5rem 0;
        line-height: 1.2;
    }
    
    .balance-label {
        color: #848E9C;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
    }
    
    .balance-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .balance-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid #3C4452;
        text-align: center;
    }
    
    .balance-card-label {
        color: #848E9C;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .balance-card-value {
        font-size: 1.75rem;
        font-weight: 700;
        font-family: 'Roboto Mono', monospace;
        margin-bottom: 0.25rem;
    }
    
    .balance-card-unit {
        color: #848E9C;
        font-size: 0.75rem;
    }
    
    .bnb-value { color: #F0B90B; }
    .usdt-value { color: #0ECB81; }
    
    .qr-section {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 20px;
        padding: 2rem;
        border: 1px solid #3C4452;
        text-align: center;
        margin-bottom: 1.5rem;
    }
    
    .qr-title {
        color: #EAECEF;
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }
    
    .qr-subtitle {
        color: #848E9C;
        font-size: 0.85rem;
        margin-bottom: 1.5rem;
    }
    
    .qr-container {
        background: white;
        padding: 1rem;
        border-radius: 16px;
        display: inline-block;
        margin-bottom: 1.5rem;
    }
    
    .wallet-address-box {
        background: rgba(60, 68, 82, 0.3);
        border: 1px solid #3C4452;
        border-radius: 12px;
        padding: 1rem;
        margin-top: 1rem;
    }
    
    .wallet-label {
        color: #848E9C;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 0.5rem;
    }
    
    .wallet-address-text {
        font-family: 'Roboto Mono', monospace;
        font-size: 0.8rem;
        color: #F0B90B;
        word-break: break-all;
        line-height: 1.5;
    }
    
    .network-badge {
        display: inline-block;
        background: rgba(240, 185, 11, 0.1);
        border: 1px solid rgba(240, 185, 11, 0.3);
        color: #F0B90B;
        font-size: 0.7rem;
        padding: 4px 10px;
        border-radius: 12px;
        margin-top: 0.75rem;
    }
    
    .search-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 20px;
        padding: 3rem 2rem;
        border: 1px solid #3C4452;
        text-align: center;
    }
    
    .search-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
    }
    
    .search-title {
        color: #EAECEF;
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }
    
    .search-subtitle {
        color: #848E9C;
        font-size: 0.95rem;
    }
    
    .error-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 20px;
        padding: 3rem 2rem;
        border: 1px solid #F6465D;
        text-align: center;
    }
    
    .no-wallet-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 20px;
        padding: 2rem;
        border: 1px solid #3C4452;
        text-align: center;
    }
    
    h1, h2, h3 { color: #EAECEF; }
    p { color: #848E9C; }
    
    .stButton > button {
        background: linear-gradient(135deg, #F0B90B 0%, #C99E00 100%);
        color: #0B0E11;
        font-weight: 600;
        border: none;
        border-radius: 8px;
    }
    
    div[data-testid="stSidebar"] { background-color: #1E2329; }
    
    .footer {
        text-align: center;
        color: #848E9C;
        font-size: 0.8rem;
        padding: 2rem 0;
        border-top: 1px solid #3C4452;
        margin-top: 2rem;
    }
</style>
""", unsafe_allow_html=True)

init_db()

query_params = st.query_params
profile_username = query_params.get("user", None)

with st.sidebar:
    st.markdown("### 👤 Public Profile")
    st.markdown("View any user's wallet")
    st.markdown("---")
    
    search_username = st.text_input(
        "Username",
        placeholder="Enter username...",
        value=profile_username if profile_username else ""
    )
    
    if st.button("🔍 View Profile", use_container_width=True):
        if search_username:
            st.query_params["user"] = search_username.lower()
            st.rerun()
        else:
            st.warning("Enter a username")
    
    st.markdown("---")
    if st.button("🏠 Back to App", use_container_width=True):
        st.switch_page("app.py")

if profile_username:
    user = get_user_by_username(profile_username)
    
    if user:
        linked_wallet = user.get('linked_wallet_address')
        
        if linked_wallet:
            blockchain_balance = get_wallet_balance(linked_wallet)
            
            if blockchain_balance:
                usdt_balance = Decimal(blockchain_balance.get('usdt', '0'))
                bnb_balance = Decimal(blockchain_balance.get('bnb', '0'))
                total_usd = Decimal(blockchain_balance.get('total_usd', '0'))
            else:
                usdt_balance = Decimal('0')
                bnb_balance = Decimal('0')
                total_usd = Decimal('0')
            
            st.markdown(f"""
            <div class="hero-section">
                <div class="username-badge">
                    <span class="username-text">@{user['username']}</span>
                </div>
                <br>
                <div class="live-indicator">
                    <span class="live-dot"></span>
                    Live from BSC
                </div>
                <div class="balance-label">Total Portfolio Value</div>
                <div class="total-balance">${total_usd:,.2f}</div>
            </div>
            """, unsafe_allow_html=True)
            
            st.markdown(f"""
            <div class="balance-grid">
                <div class="balance-card">
                    <div class="balance-card-label">BNB Balance</div>
                    <div class="balance-card-value bnb-value">{bnb_balance:.4f}</div>
                    <div class="balance-card-unit">BNB</div>
                </div>
                <div class="balance-card">
                    <div class="balance-card-label">USDT Balance</div>
                    <div class="balance-card-value usdt-value">${usdt_balance:,.2f}</div>
                    <div class="balance-card-unit">USDT (BEP20)</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            qr_base64 = generate_qr_code(linked_wallet)
            
            st.markdown(f"""
            <div class="qr-section">
                <div class="qr-title">Send to this wallet</div>
                <div class="qr-subtitle">Scan QR code or copy address below</div>
                <div class="qr-container">
                    <img src="data:image/png;base64,{qr_base64}" width="180">
                </div>
                <div class="wallet-address-box">
                    <div class="wallet-label">Wallet Address</div>
                    <div class="wallet-address-text">{linked_wallet}</div>
                    <div class="network-badge">BSC Network (BEP20)</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            st.code(linked_wallet, language=None)
        
        else:
            st.markdown(f"""
            <div class="hero-section">
                <div class="username-badge">
                    <span class="username-text">@{user['username']}</span>
                </div>
            </div>
            
            <div class="no-wallet-card">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔗</div>
                <div style="color: #EAECEF; font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">
                    No Wallet Linked
                </div>
                <div style="color: #848E9C;">
                    This user hasn't linked their BSC wallet yet.
                </div>
            </div>
            """, unsafe_allow_html=True)
    
    else:
        st.markdown(f"""
        <div class="error-card">
            <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
            <div style="color: #F6465D; font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">
                User Not Found
            </div>
            <div style="color: #848E9C;">
                No user exists with username "@{profile_username}"
            </div>
        </div>
        """, unsafe_allow_html=True)

else:
    st.markdown("""
    <div class="search-card">
        <div class="search-icon">🔍</div>
        <div class="search-title">Search for a User</div>
        <div class="search-subtitle">
            Enter a username in the sidebar to view their public wallet profile
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("""
    <div style="text-align: center; margin-top: 2rem; color: #848E9C; font-size: 0.9rem;">
        <p><strong>Tip:</strong> You can also visit directly using</p>
        <code style="background: #2B3139; padding: 8px 16px; border-radius: 8px; color: #F0B90B; display: inline-block; margin-top: 0.5rem;">
            /?user=username
        </code>
    </div>
    """, unsafe_allow_html=True)

st.markdown("""
<div class="footer">
    💰 USDT Vault Pro<br>
    <span style="font-size: 0.75rem;">Built for BEP20 USDT on Binance Smart Chain</span>
</div>
""", unsafe_allow_html=True)
