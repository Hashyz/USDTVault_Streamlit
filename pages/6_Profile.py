import streamlit as st
from decimal import Decimal
from utils.database import init_db, get_user_by_username
from utils.blockchain import get_wallet_balance
import qrcode
import io
import base64

def generate_qr_code(data):
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

st.set_page_config(
    page_title="Public Profile - USDT Vault Pro",
    page_icon="👤",
    layout="wide"
)

st.markdown("""
<style>
    .stApp { background-color: #0B0E11; }
    .profile-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 16px;
        padding: 2rem;
        border: 2px solid #F0B90B;
        margin-bottom: 1rem;
        text-align: center;
    }
    .metric-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid #3C4452;
        margin-bottom: 1rem;
    }
    .username-display {
        font-size: 2.5rem;
        font-weight: 700;
        color: #F0B90B;
        margin-bottom: 0.5rem;
    }
    .balance-display {
        font-size: 3rem;
        font-weight: 700;
        color: #0ECB81;
        font-family: 'Roboto Mono', monospace;
    }
    .wallet-address {
        font-family: 'Roboto Mono', monospace;
        font-size: 0.875rem;
        color: #848E9C;
        background: rgba(60, 68, 82, 0.5);
        padding: 8px 16px;
        border-radius: 8px;
        word-break: break-all;
        display: inline-block;
        margin: 1rem 0;
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
    .live-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: #0ECB81;
        background: rgba(14, 203, 129, 0.1);
        padding: 6px 12px;
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
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
</style>
""", unsafe_allow_html=True)

init_db()

query_params = st.query_params
profile_username = query_params.get("user", None)

with st.sidebar:
    st.markdown("### 👤 Public Profile")
    st.markdown("View any user's public wallet")
    st.markdown("---")
    
    search_username = st.text_input(
        "Search Username",
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

st.markdown('<h1 style="text-align: center;">💰 USDT Vault Pro</h1>', unsafe_allow_html=True)
st.markdown('<p style="text-align: center;">Public Wallet Profile</p>', unsafe_allow_html=True)

if profile_username:
    user = get_user_by_username(profile_username)
    
    if user:
        linked_wallet = user.get('linked_wallet_address')
        
        st.markdown(f"""
        <div class="profile-card">
            <div class="username-display">@{user['username']}</div>
        """, unsafe_allow_html=True)
        
        if linked_wallet:
            blockchain_balance = get_wallet_balance(linked_wallet)
            
            if blockchain_balance:
                usdt_balance = Decimal(blockchain_balance.get('usdt', '0'))
                bnb_balance = Decimal(blockchain_balance.get('bnb', '0'))
                total_usd = Decimal(blockchain_balance.get('total_usd', '0'))
                
                st.markdown(f"""
                <div class="live-badge">
                    <span class="live-dot"></span>
                    Live from BSC Blockchain
                </div>
                <div class="balance-display">${total_usd:,.2f}</div>
                <p style="color: #848E9C; margin-top: 0.5rem;">Total Portfolio Value (USD)</p>
                """, unsafe_allow_html=True)
            else:
                st.markdown("""
                <div style="color: #F6465D; margin: 1rem 0;">
                    ⚠️ Unable to fetch balance
                </div>
                """, unsafe_allow_html=True)
            
            st.markdown(f"""
            <div class="wallet-address">{linked_wallet}</div>
            </div>
            """, unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns([1, 2, 1])
            
            with col2:
                st.markdown("### 📊 Wallet Details")
                
                if blockchain_balance:
                    col_bnb, col_usdt = st.columns(2)
                    
                    with col_bnb:
                        st.markdown(f"""
                        <div class="metric-card" style="text-align: center;">
                            <div style="color: #848E9C; font-size: 0.875rem; margin-bottom: 0.5rem;">BNB Balance</div>
                            <div style="color: #F0B90B; font-size: 1.5rem; font-weight: 700; font-family: 'Roboto Mono', monospace;">
                                {bnb_balance:.6f}
                            </div>
                            <div style="color: #848E9C; font-size: 0.75rem;">BNB</div>
                        </div>
                        """, unsafe_allow_html=True)
                    
                    with col_usdt:
                        st.markdown(f"""
                        <div class="metric-card" style="text-align: center;">
                            <div style="color: #848E9C; font-size: 0.875rem; margin-bottom: 0.5rem;">USDT Balance</div>
                            <div style="color: #0ECB81; font-size: 1.5rem; font-weight: 700; font-family: 'Roboto Mono', monospace;">
                                ${usdt_balance:,.2f}
                            </div>
                            <div style="color: #848E9C; font-size: 0.75rem;">USDT (BEP20)</div>
                        </div>
                        """, unsafe_allow_html=True)
                
                st.markdown("### 📱 Send to this wallet")
                st.markdown("""
                <p style="color: #848E9C; text-align: center; margin-bottom: 1rem;">
                    Scan QR code to send USDT (BEP20) to this wallet
                </p>
                """, unsafe_allow_html=True)
                
                qr_base64 = generate_qr_code(linked_wallet)
                st.markdown(f"""
                <div style="text-align: center; background: white; padding: 1rem; border-radius: 12px; display: inline-block; margin: 0 auto;">
                    <img src="data:image/png;base64,{qr_base64}" width="200">
                </div>
                """, unsafe_allow_html=True)
                
                st.markdown("---")
                st.markdown("### 📋 Copy Address")
                st.code(linked_wallet, language=None)
        
        else:
            st.markdown("""
            <div style="color: #848E9C; margin: 1rem 0;">
                🔗 No wallet linked yet
            </div>
            </div>
            """, unsafe_allow_html=True)
            
            st.info("This user hasn't linked their BSC wallet yet.")
    
    else:
        st.markdown("""
        <div class="profile-card">
            <div style="font-size: 3rem; margin-bottom: 1rem;">❓</div>
            <div style="color: #F6465D; font-size: 1.5rem; font-weight: 600;">User Not Found</div>
            <p style="color: #848E9C; margin-top: 0.5rem;">
                No user exists with username "@{}"
            </p>
        </div>
        """.format(profile_username), unsafe_allow_html=True)

else:
    st.markdown("""
    <div class="profile-card">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
        <div style="color: #EAECEF; font-size: 1.5rem; font-weight: 600;">Search for a User</div>
        <p style="color: #848E9C; margin-top: 0.5rem;">
            Enter a username in the sidebar to view their public wallet profile
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("""
    <div style="text-align: center; margin-top: 2rem;">
        <p style="color: #848E9C;">
            <strong>How to use:</strong><br>
            Enter a username in the sidebar or visit<br>
            <code style="background: #2B3139; padding: 4px 8px; border-radius: 4px; color: #F0B90B;">
                /?profile=username
            </code>
        </p>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #848E9C; font-size: 0.875rem;">
    <p>💰 USDT Vault Pro | Public Profile Viewer</p>
    <p>Built for BEP20 USDT on Binance Smart Chain</p>
</div>
""", unsafe_allow_html=True)
