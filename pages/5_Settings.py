import streamlit as st
from decimal import Decimal
from utils.auth import init_session_state, get_current_user
from utils.database import update_user_pin, verify_user_pin, get_user_by_id, update_user_wallet_address
from utils.blockchain import validate_address, get_wallet_balance
from utils.theme import inject_theme
from utils.sidebar import render_sidebar, check_auth

st.set_page_config(
    page_title="Settings - USDT Vault Pro",
    page_icon="⚙️",
    layout="wide"
)

inject_theme()

init_session_state()

if not check_auth():
    st.stop()

user = get_current_user()

render_sidebar("settings")

st.markdown("# ⚙️ Settings")
st.markdown("Manage your account security and preferences")

col1, col2 = st.columns(2)

linked_wallet_address = user.get('linked_wallet_address')
linked_wallet_display = linked_wallet_address if linked_wallet_address else 'Not linked'

account_balance_display = "Link wallet to view balance"
if linked_wallet_address:
    account_blockchain_balance = get_wallet_balance(linked_wallet_address)
    if account_blockchain_balance:
        account_usdt = Decimal(account_blockchain_balance.get('usdt', '0'))
        account_balance_display = f"${account_usdt:,.2f} USDT"
    else:
        account_balance_display = "Unable to fetch balance"

with col1:
    st.markdown("### 👤 Account Information")
    st.markdown(f"""
    <div class="metric-card">
        <div style="margin-bottom: 1rem;">
            <div style="color: #848E9C; font-size: 0.875rem;">Username</div>
            <div style="color: #EAECEF; font-size: 1.125rem;">{user['username']}</div>
        </div>
        <div style="margin-bottom: 1rem;">
            <div style="color: #848E9C; font-size: 0.875rem;">Linked Wallet</div>
            <div style="color: {'#F0B90B' if linked_wallet_display != 'Not linked' else '#848E9C'}; font-size: 0.875rem; font-family: 'Roboto Mono', monospace; word-break: break-all;">
                {linked_wallet_display if linked_wallet_display else 'Not linked'}
            </div>
        </div>
        <div style="margin-bottom: 1rem;">
            <div style="color: #848E9C; font-size: 0.875rem;">Current Balance</div>
            <div style="color: #F0B90B; font-size: 1.5rem; font-weight: 700; font-family: 'Roboto Mono', monospace;">
                {account_balance_display}
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
    
    if linked_wallet_display and linked_wallet_display != 'Not linked':
        st.markdown("### 📋 Copy Wallet Address")
        st.code(linked_wallet_display, language=None)

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

st.markdown("### 🔗 Blockchain Wallet")
st.markdown("""
<div class="metric-card">
    <p style="color: #EAECEF; margin-bottom: 0.5rem;">
        <strong>Link your BSC wallet to view real-time balances</strong>
    </p>
    <p style="color: #848E9C; font-size: 0.875rem; margin: 0;">
        🔒 <strong>Read-only access</strong> - Only your public wallet address is needed. 
        No private key required. Your funds remain completely safe and under your control.
    </p>
</div>
""", unsafe_allow_html=True)

linked_wallet = user.get('linked_wallet_address')

if linked_wallet:
    st.markdown("#### Currently Linked Wallet")
    
    wallet_balance = get_wallet_balance(linked_wallet)
    
    col_wallet1, col_wallet2 = st.columns([2, 1])
    
    with col_wallet1:
        st.markdown(f"""
        <div class="metric-card">
            <div style="margin-bottom: 1rem;">
                <div style="color: #848E9C; font-size: 0.875rem;">Linked BSC Address</div>
                <div style="color: #F0B90B; font-size: 0.875rem; font-family: 'Roboto Mono', monospace; word-break: break-all;">
                    {linked_wallet}
                </div>
            </div>
        """, unsafe_allow_html=True)
        
        if wallet_balance:
            bnb_balance = Decimal(wallet_balance.get('bnb', '0'))
            usdt_balance = Decimal(wallet_balance.get('usdt', '0'))
            total_usd = Decimal(wallet_balance.get('total_usd', '0'))
            
            st.markdown(f"""
            <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                <div>
                    <div style="color: #848E9C; font-size: 0.75rem;">BNB Balance</div>
                    <div style="color: #F0B90B; font-size: 1.25rem; font-weight: 600; font-family: 'Roboto Mono', monospace;">
                        {bnb_balance:.6f} BNB
                    </div>
                </div>
                <div>
                    <div style="color: #848E9C; font-size: 0.75rem;">USDT Balance</div>
                    <div style="color: #0ECB81; font-size: 1.25rem; font-weight: 600; font-family: 'Roboto Mono', monospace;">
                        ${usdt_balance:,.2f} USDT
                    </div>
                </div>
                <div>
                    <div style="color: #848E9C; font-size: 0.75rem;">Total Value (USD)</div>
                    <div style="color: #EAECEF; font-size: 1.25rem; font-weight: 600; font-family: 'Roboto Mono', monospace;">
                        ${total_usd:,.2f}
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown("""
            <div style="color: #F6465D; font-size: 0.875rem;">
                ⚠️ Unable to fetch balance. Please check your connection or try again later.
            </div>
            """, unsafe_allow_html=True)
        
        st.markdown("</div>", unsafe_allow_html=True)
    
    with col_wallet2:
        st.markdown("<div style='padding-top: 1.5rem;'></div>", unsafe_allow_html=True)
        if st.button("🔓 Unlink Wallet", use_container_width=True, key="unlink_wallet"):
            if update_user_wallet_address(st.session_state.user_id, None):
                st.success("Wallet unlinked successfully!")
                st.rerun()
            else:
                st.error("Failed to unlink wallet. Please try again.")
        
        if st.button("🔄 Refresh Balance", use_container_width=True, key="refresh_balance"):
            st.rerun()

else:
    st.markdown("#### Link Your BSC Wallet")
    
    with st.form("link_wallet_form"):
        wallet_address = st.text_input(
            "BSC Wallet Address",
            placeholder="0x...",
            help="Enter your BSC (BEP20) wallet address. This is your public address that starts with '0x'."
        )
        
        st.markdown("""
        <p style="color: #848E9C; font-size: 0.8rem; margin-top: -0.5rem;">
            💡 You can find your wallet address in MetaMask, Trust Wallet, or any BSC-compatible wallet.
        </p>
        """, unsafe_allow_html=True)
        
        link_btn = st.form_submit_button("🔗 Link Wallet", use_container_width=True)
        
        if link_btn:
            if not wallet_address:
                st.error("Please enter a wallet address")
            elif not validate_address(wallet_address):
                st.error("Invalid wallet address format. Please enter a valid BSC address (0x followed by 40 hex characters)")
            else:
                if update_user_wallet_address(st.session_state.user_id, wallet_address):
                    st.success("Wallet linked successfully!")
                    st.rerun()
                else:
                    st.error("Failed to link wallet. Please try again.")

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
