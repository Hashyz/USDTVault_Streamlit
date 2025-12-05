import streamlit as st
from decimal import Decimal
from utils.auth import init_session_state, get_current_user, logout
from utils.database import update_user_pin, verify_user_pin, get_user_by_id

st.set_page_config(
    page_title="Settings - USDT Vault Pro",
    page_icon="⚙️",
    layout="wide"
)

st.markdown("""
<style>
    .stApp { background-color: #0B0E11; }
    .metric-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid #3C4452;
        margin-bottom: 1rem;
    }
    h1, h2, h3 { color: #EAECEF; }
    p { color: #848E9C; }
    div[data-testid="stSidebar"] { background-color: #1E2329; }
    .stButton > button {
        background: linear-gradient(135deg, #F0B90B 0%, #C99E00 100%);
        color: #0B0E11;
        font-weight: 600;
        border: none;
        border-radius: 8px;
    }
    .danger-btn > button {
        background: #F6465D;
        color: white;
    }
</style>
""", unsafe_allow_html=True)

init_session_state()

if not st.session_state.get('authenticated'):
    st.switch_page("app.py")

user = get_current_user()
if not user:
    st.switch_page("app.py")

with st.sidebar:
    st.markdown(f"### 👤 {user['username'].title()}")
    st.markdown(f"**Balance:** `${Decimal(user.get('balance', '0')):,.2f}`")
    st.markdown("---")
    
    if st.button("📊 Dashboard", use_container_width=True):
        st.switch_page("pages/1_Dashboard.py")
    if st.button("🎯 Savings Goals", use_container_width=True):
        st.switch_page("pages/2_Savings_Goals.py")
    if st.button("💸 Transactions", use_container_width=True):
        st.switch_page("pages/3_Transactions.py")
    if st.button("📈 Investment Plans", use_container_width=True):
        st.switch_page("pages/4_Investment_Plans.py")
    if st.button("⚙️ Settings", use_container_width=True):
        pass
    
    st.markdown("---")
    if st.button("🚪 Logout", use_container_width=True):
        logout()
        st.switch_page("app.py")

st.markdown("# ⚙️ Settings")
st.markdown("Manage your account security and preferences")

col1, col2 = st.columns(2)

with col1:
    st.markdown("### 👤 Account Information")
    st.markdown(f"""
    <div class="metric-card">
        <div style="margin-bottom: 1rem;">
            <div style="color: #848E9C; font-size: 0.875rem;">Username</div>
            <div style="color: #EAECEF; font-size: 1.125rem;">{user['username']}</div>
        </div>
        <div style="margin-bottom: 1rem;">
            <div style="color: #848E9C; font-size: 0.875rem;">Wallet Address</div>
            <div style="color: #EAECEF; font-size: 0.875rem; font-family: 'Roboto Mono', monospace; word-break: break-all;">
                {user['wallet_address']}
            </div>
        </div>
        <div style="margin-bottom: 1rem;">
            <div style="color: #848E9C; font-size: 0.875rem;">Current Balance</div>
            <div style="color: #F0B90B; font-size: 1.5rem; font-weight: 700; font-family: 'Roboto Mono', monospace;">
                ${Decimal(user.get('balance', '0')):,.2f} USDT
            </div>
        </div>
        <div>
            <div style="color: #848E9C; font-size: 0.875rem;">Member Since</div>
            <div style="color: #EAECEF; font-size: 1rem;">
                {user.get('created_at', 'N/A').strftime('%B %d, %Y') if user.get('created_at') else 'N/A'}
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("### 📋 Copy Wallet Address")
    st.code(user['wallet_address'], language=None)

with col2:
    st.markdown("### 🔐 Security Settings")
    
    has_pin = user.get('pin') is not None
    
    st.markdown(f"""
    <div class="metric-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="color: #EAECEF; font-weight: 600;">PIN Protection</div>
                <div style="color: #848E9C; font-size: 0.875rem;">6-digit PIN for sensitive operations</div>
            </div>
            <span style="color: {'#0ECB81' if has_pin else '#F6465D'};">
                {'✓ Enabled' if has_pin else '✗ Disabled'}
            </span>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    if has_pin:
        st.markdown("#### Change PIN")
        with st.form("change_pin_form"):
            current_pin = st.text_input("Current PIN", type="password", max_chars=6)
            new_pin = st.text_input("New PIN (6 digits)", type="password", max_chars=6)
            confirm_pin = st.text_input("Confirm New PIN", type="password", max_chars=6)
            
            change_btn = st.form_submit_button("Update PIN", use_container_width=True)
            
            if change_btn:
                if not current_pin or not new_pin or not confirm_pin:
                    st.error("Please fill in all fields")
                elif not verify_user_pin(st.session_state.user_id, current_pin):
                    st.error("Current PIN is incorrect")
                elif len(new_pin) != 6 or not new_pin.isdigit():
                    st.error("PIN must be exactly 6 digits")
                elif new_pin != confirm_pin:
                    st.error("New PINs do not match")
                else:
                    update_user_pin(st.session_state.user_id, new_pin)
                    st.success("PIN updated successfully!")
    else:
        st.markdown("#### Set Up PIN")
        with st.form("setup_pin_form"):
            new_pin = st.text_input("New PIN (6 digits)", type="password", max_chars=6)
            confirm_pin = st.text_input("Confirm PIN", type="password", max_chars=6)
            
            setup_btn = st.form_submit_button("Set PIN", use_container_width=True)
            
            if setup_btn:
                if not new_pin or not confirm_pin:
                    st.error("Please fill in all fields")
                elif len(new_pin) != 6 or not new_pin.isdigit():
                    st.error("PIN must be exactly 6 digits")
                elif new_pin != confirm_pin:
                    st.error("PINs do not match")
                else:
                    update_user_pin(st.session_state.user_id, new_pin)
                    st.success("PIN set successfully!")
                    st.rerun()

st.markdown("---")

st.markdown("### 📊 Account Statistics")

from utils.database import get_user_transactions, get_user_savings_goals, get_user_investment_plans

transactions = get_user_transactions(st.session_state.user_id)
savings_goals = get_user_savings_goals(st.session_state.user_id)
investment_plans = get_user_investment_plans(st.session_state.user_id)

col_stats1, col_stats2, col_stats3, col_stats4 = st.columns(4)

with col_stats1:
    st.markdown(f"""
    <div class="metric-card" style="text-align: center;">
        <div style="color: #F0B90B; font-size: 2rem; font-weight: 700;">{len(transactions)}</div>
        <div style="color: #848E9C;">Total Transactions</div>
    </div>
    """, unsafe_allow_html=True)

with col_stats2:
    st.markdown(f"""
    <div class="metric-card" style="text-align: center;">
        <div style="color: #0ECB81; font-size: 2rem; font-weight: 700;">{len(savings_goals)}</div>
        <div style="color: #848E9C;">Savings Goals</div>
    </div>
    """, unsafe_allow_html=True)

with col_stats3:
    st.markdown(f"""
    <div class="metric-card" style="text-align: center;">
        <div style="color: #3B82F6; font-size: 2rem; font-weight: 700;">{len(investment_plans)}</div>
        <div style="color: #848E9C;">Investment Plans</div>
    </div>
    """, unsafe_allow_html=True)

with col_stats4:
    total_savings = sum(Decimal(goal.get('current', '0')) for goal in savings_goals)
    st.markdown(f"""
    <div class="metric-card" style="text-align: center;">
        <div style="color: #F0B90B; font-size: 1.5rem; font-weight: 700;">${total_savings:,.2f}</div>
        <div style="color: #848E9C;">Total Saved</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

st.markdown("### ℹ️ About USDT Vault Pro")
st.markdown("""
<div class="metric-card">
    <p style="color: #EAECEF;">
        <strong>USDT Vault Pro</strong> is a secure cryptocurrency savings and portfolio management platform 
        focused on BEP20 USDT on the Binance Smart Chain.
    </p>
    <br>
    <p style="color: #848E9C;">
        <strong>Features:</strong>
    </p>
    <ul style="color: #848E9C;">
        <li>Secure wallet management</li>
        <li>Savings goals with progress tracking</li>
        <li>Transaction history and reporting</li>
        <li>Investment plans with dollar-cost averaging</li>
        <li>PIN protection for sensitive operations</li>
    </ul>
    <br>
    <p style="color: #848E9C; font-size: 0.875rem;">
        Built with Python & Streamlit | Database: MongoDB
    </p>
</div>
""", unsafe_allow_html=True)
