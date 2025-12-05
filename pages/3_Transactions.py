import streamlit as st
from datetime import datetime
from decimal import Decimal
import pandas as pd
from utils.auth import init_session_state, get_current_user, logout
from utils.database import (
    get_user_transactions, create_transaction,
    get_user_by_id, update_user_balance,
    user_has_pin, verify_user_pin, get_pin_attempts
)
from utils.blockchain import get_all_transactions, format_transaction_for_display

st.set_page_config(
    page_title="Transactions - USDT Vault Pro",
    page_icon="💸",
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
    .tx-receive { border-left: 4px solid #0ECB81; }
    .tx-send { border-left: 4px solid #F6465D; }
    .amount-positive { color: #0ECB81; font-weight: 600; }
    .amount-negative { color: #F6465D; font-weight: 600; }
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
        pass
    if st.button("📈 Investment Plans", use_container_width=True):
        st.switch_page("pages/4_Investment_Plans.py")
    if st.button("⚙️ Settings", use_container_width=True):
        st.switch_page("pages/5_Settings.py")
    
    st.markdown("---")
    if st.button("🚪 Logout", use_container_width=True):
        logout()
        st.switch_page("app.py")

st.markdown("# 💸 Transactions")
st.markdown("Deposit, withdraw, and track your USDT transactions")

user_balance = Decimal(user.get('balance', '0'))
transactions = get_user_transactions(st.session_state.user_id)

linked_wallet_addr = user.get('linked_wallet_address')
wallet_display = f"{linked_wallet_addr[:6]}...{linked_wallet_addr[-4:]}" if linked_wallet_addr else "Not linked"

st.markdown(f"""
<div class="metric-card">
    <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
            <div style="color: #848E9C; font-size: 0.875rem;">Available Balance</div>
            <div style="color: #F0B90B; font-size: 2rem; font-weight: 700; font-family: 'Roboto Mono', monospace;">
                ${user_balance:,.2f} USDT
            </div>
        </div>
        <div style="color: #848E9C; font-size: 0.875rem;">
            Wallet: {wallet_display}
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

tab1, tab2, tab3, tab4 = st.tabs(["📥 Deposit", "📤 Withdraw", "📋 History", "🔗 Blockchain History"])

with tab1:
    st.markdown("### Deposit USDT")
    st.markdown("Add funds to your wallet")
    
    with st.form("deposit_form"):
        deposit_amount = st.number_input(
            "Amount (USDT)",
            min_value=0.01,
            value=100.0,
            step=10.0,
            help="Enter the amount you want to deposit"
        )
        
        source_address = st.text_input(
            "Source Address",
            placeholder="0x...",
            help="Enter the wallet address you're depositing from"
        )
        
        deposit_btn = st.form_submit_button("Deposit", use_container_width=True)
        
        if deposit_btn:
            if deposit_amount > 0 and source_address:
                if not source_address.startswith("0x") or len(source_address) != 42:
                    st.error("Please enter a valid wallet address (0x... format, 42 characters)")
                else:
                    new_balance = user_balance + Decimal(str(deposit_amount))
                    
                    create_transaction(
                        st.session_state.user_id,
                        "receive",
                        str(deposit_amount),
                        source_address,
                        "completed"
                    )
                    
                    update_user_balance(st.session_state.user_id, str(new_balance))
                    
                    st.success(f"Successfully deposited ${deposit_amount:,.2f} USDT!")
                    st.balloons()
                    st.rerun()
            else:
                st.warning("Please enter amount and source address")

with tab2:
    st.markdown("### Withdraw USDT")
    st.markdown("Send funds from your wallet")
    
    has_pin = user_has_pin(st.session_state.user_id)
    pin_attempts = get_pin_attempts(st.session_state.user_id)
    
    if pin_attempts >= 5:
        st.error("Account locked due to too many failed PIN attempts. Please contact support.")
    else:
        with st.form("withdraw_form"):
            withdraw_amount = st.number_input(
                "Amount (USDT)",
                min_value=0.01,
                max_value=float(user_balance),
                value=min(100.0, float(user_balance)) if user_balance > 0 else 0.01,
                step=10.0,
                help="Enter the amount you want to withdraw"
            )
            
            dest_address = st.text_input(
                "Destination Address",
                placeholder="0x...",
                help="Enter the wallet address to send to"
            )
            
            pin_input = ""
            if has_pin:
                pin_input = st.text_input(
                    "Enter PIN",
                    type="password",
                    max_chars=6,
                    help="Enter your 6-digit PIN to authorize this withdrawal"
                )
                st.caption("🔐 PIN required for withdrawals")
            
            st.caption(f"⚠️ Available: ${user_balance:,.2f} USDT")
            
            withdraw_btn = st.form_submit_button("Withdraw", use_container_width=True)
            
            if withdraw_btn:
                if withdraw_amount > 0 and dest_address:
                    if not dest_address.startswith("0x") or len(dest_address) != 42:
                        st.error("Please enter a valid wallet address (0x... format, 42 characters)")
                    elif Decimal(str(withdraw_amount)) > user_balance:
                        st.error("Insufficient balance")
                    elif has_pin and not verify_user_pin(st.session_state.user_id, pin_input):
                        remaining = 5 - get_pin_attempts(st.session_state.user_id)
                        st.error(f"Invalid PIN. {remaining} attempts remaining.")
                    else:
                        new_balance = user_balance - Decimal(str(withdraw_amount))
                        
                        create_transaction(
                            st.session_state.user_id,
                            "send",
                            str(withdraw_amount),
                            dest_address,
                            "completed"
                        )
                        
                        update_user_balance(st.session_state.user_id, str(new_balance))
                        
                        st.success(f"Successfully sent ${withdraw_amount:,.2f} USDT!")
                        st.rerun()
                else:
                    st.warning("Please enter amount and destination address")

with tab3:
    st.markdown("### Transaction History")
    
    if transactions:
        filter_type = st.selectbox("Filter by type", ["All", "Deposits", "Withdrawals"])
        
        filtered_txs = transactions
        if filter_type == "Deposits":
            filtered_txs = [tx for tx in transactions if tx['type'] == 'receive']
        elif filter_type == "Withdrawals":
            filtered_txs = [tx for tx in transactions if tx['type'] == 'send']
        
        for tx in filtered_txs:
            tx_type = tx['type']
            amount = Decimal(tx['amount'])
            is_receive = tx_type == 'receive'
            
            icon = "📥" if is_receive else "📤"
            color_class = "tx-receive" if is_receive else "tx-send"
            amount_class = "amount-positive" if is_receive else "amount-negative"
            sign = "+" if is_receive else "-"
            
            st.markdown(f"""
            <div class="metric-card {color_class}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 1.5rem;">{icon}</span>
                        <span style="color: #EAECEF; font-size: 1.125rem; margin-left: 0.5rem; font-weight: 600;">
                            {'Received' if is_receive else 'Sent'}
                        </span>
                        <span style="color: #0ECB81; font-size: 0.75rem; margin-left: 0.5rem; background: rgba(14, 203, 129, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">
                            {tx['status'].upper()}
                        </span>
                    </div>
                    <span class="{amount_class}" style="font-size: 1.25rem; font-family: 'Roboto Mono', monospace;">
                        {sign}${amount:,.2f} USDT
                    </span>
                </div>
                <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; color: #848E9C; font-size: 0.875rem;">
                    <span>{'From' if is_receive else 'To'}: {tx['address'][:16]}...{tx['address'][-8:]}</span>
                    <span>{tx['created_at'].strftime('%Y-%m-%d %H:%M:%S')}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        tx_data = []
        for tx in transactions:
            tx_data.append({
                'Date': tx['created_at'].strftime('%Y-%m-%d %H:%M'),
                'Type': tx['type'].title(),
                'Amount': f"${Decimal(tx['amount']):,.2f}",
                'Address': f"{tx['address'][:10]}...{tx['address'][-6:]}",
                'Status': tx['status'].title()
            })
        
        st.markdown("### Export Transactions")
        df = pd.DataFrame(tx_data)
        csv = df.to_csv(index=False)
        st.download_button(
            label="📥 Download CSV",
            data=csv,
            file_name=f"transactions_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
    else:
        st.info("No transactions yet. Make your first deposit to get started!")

with tab4:
    st.markdown("### Blockchain Transaction History")
    st.markdown("View real transactions from the BSC blockchain")
    
    linked_wallet = user.get('linked_wallet_address')
    
    if not linked_wallet:
        st.warning("⚠️ No wallet linked to your account")
        st.markdown("""
        <div class="metric-card">
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔗</div>
                <div style="color: #EAECEF; font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">
                    Link Your BSC Wallet
                </div>
                <div style="color: #848E9C; margin-bottom: 1.5rem;">
                    To view your real blockchain transaction history, please link your BSC wallet address in Settings.
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        if st.button("⚙️ Go to Settings", use_container_width=True, key="goto_settings"):
            st.switch_page("pages/5_Settings.py")
    else:
        st.markdown(f"""
        <div style="background: rgba(14, 203, 129, 0.1); border: 1px solid #0ECB81; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem;">
            <span style="color: #0ECB81;">🔗 Linked Wallet:</span>
            <span style="color: #EAECEF; font-family: 'Roboto Mono', monospace; margin-left: 0.5rem;">
                {linked_wallet[:10]}...{linked_wallet[-8:]}
            </span>
        </div>
        """, unsafe_allow_html=True)
        
        col1, col2 = st.columns([3, 1])
        with col2:
            refresh_clicked = st.button("🔄 Refresh", use_container_width=True, key="refresh_blockchain")
        
        if 'blockchain_txs' not in st.session_state or refresh_clicked:
            st.session_state.blockchain_fetch_error = None
            st.session_state.blockchain_txs = None
        
        if st.session_state.get('blockchain_txs') is None and st.session_state.get('blockchain_fetch_error') is None:
            with st.spinner("Fetching transactions from BSCScan..."):
                try:
                    raw_txs = get_all_transactions(linked_wallet, limit=50)
                    if raw_txs:
                        formatted_txs = [format_transaction_for_display(tx, linked_wallet) for tx in raw_txs]
                        st.session_state.blockchain_txs = formatted_txs
                    else:
                        st.session_state.blockchain_txs = []
                except Exception as e:
                    st.session_state.blockchain_fetch_error = str(e)
        
        if st.session_state.get('blockchain_fetch_error'):
            st.error(f"❌ Failed to fetch blockchain transactions: {st.session_state.blockchain_fetch_error}")
            st.markdown("""
            <div class="metric-card">
                <div style="text-align: center; padding: 1.5rem;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
                    <div style="color: #848E9C;">
                        Unable to connect to BSCScan. This may be due to network issues or API rate limits.
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("🔄 Retry", use_container_width=True, key="retry_blockchain"):
                st.session_state.blockchain_fetch_error = None
                st.session_state.blockchain_txs = None
                st.rerun()
        
        elif st.session_state.get('blockchain_txs') is not None:
            blockchain_txs = st.session_state.blockchain_txs
            
            if not blockchain_txs:
                st.info("No blockchain transactions found for this wallet address.")
            else:
                filter_type_blockchain = st.selectbox(
                    "Filter by type", 
                    ["All", "Received", "Sent"], 
                    key="blockchain_filter"
                )
                
                filtered_blockchain_txs = blockchain_txs
                if filter_type_blockchain == "Received":
                    filtered_blockchain_txs = [tx for tx in blockchain_txs if tx['type'] == 'receive']
                elif filter_type_blockchain == "Sent":
                    filtered_blockchain_txs = [tx for tx in blockchain_txs if tx['type'] == 'send']
                
                for tx in filtered_blockchain_txs:
                    is_receive = tx['type'] == 'receive'
                    amount = Decimal(tx['amount'])
                    currency = tx.get('currency', 'BNB')
                    
                    icon = "📥" if is_receive else "📤"
                    color_class = "tx-receive" if is_receive else "tx-send"
                    amount_class = "amount-positive" if is_receive else "amount-negative"
                    sign = "+" if is_receive else "-"
                    status_color = "#0ECB81" if tx['status'] == 'success' else "#F6465D"
                    status_bg = "rgba(14, 203, 129, 0.1)" if tx['status'] == 'success' else "rgba(246, 70, 93, 0.1)"
                    
                    tx_date = datetime.fromtimestamp(tx['timestamp']).strftime('%Y-%m-%d %H:%M:%S') if tx['timestamp'] else 'Unknown'
                    address = tx['from_address'] if is_receive else tx['to_address']
                    tx_hash = tx.get('transaction_hash', '')
                    tx_hash_short = f"{tx_hash[:10]}...{tx_hash[-8:]}" if tx_hash else 'N/A'
                    bscscan_link = f"https://bscscan.com/tx/{tx_hash}" if tx_hash else '#'
                    
                    st.markdown(f"""
                    <div class="metric-card {color_class}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-size: 1.5rem;">{icon}</span>
                                <span style="color: #EAECEF; font-size: 1.125rem; margin-left: 0.5rem; font-weight: 600;">
                                    {'Received' if is_receive else 'Sent'}
                                </span>
                                <span style="color: {status_color}; font-size: 0.75rem; margin-left: 0.5rem; background: {status_bg}; padding: 0.25rem 0.5rem; border-radius: 4px;">
                                    {tx['status'].upper()}
                                </span>
                                <span style="color: #F0B90B; font-size: 0.75rem; margin-left: 0.5rem; background: rgba(240, 185, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">
                                    {currency}
                                </span>
                            </div>
                            <span class="{amount_class}" style="font-size: 1.25rem; font-family: 'Roboto Mono', monospace;">
                                {sign}{amount:,.6f} {currency}
                            </span>
                        </div>
                        <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; color: #848E9C; font-size: 0.875rem; flex-wrap: wrap; gap: 0.5rem;">
                            <span>{'From' if is_receive else 'To'}: {address[:16]}...{address[-8:]}</span>
                            <span>{tx_date}</span>
                        </div>
                        <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                            <a href="{bscscan_link}" target="_blank" style="color: #F0B90B; text-decoration: none; font-size: 0.875rem;">
                                🔗 TX: {tx_hash_short}
                            </a>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                
                st.markdown("---")
                st.markdown("### Export Blockchain Transactions")
                
                blockchain_tx_data = []
                for tx in blockchain_txs:
                    tx_date = datetime.fromtimestamp(tx['timestamp']).strftime('%Y-%m-%d %H:%M') if tx['timestamp'] else 'Unknown'
                    is_receive = tx['type'] == 'receive'
                    address = tx['from_address'] if is_receive else tx['to_address']
                    
                    blockchain_tx_data.append({
                        'Date': tx_date,
                        'Type': 'Receive' if is_receive else 'Send',
                        'Amount': f"{Decimal(tx['amount']):,.6f}",
                        'Currency': tx.get('currency', 'BNB'),
                        'Address': f"{address[:10]}...{address[-6:]}",
                        'Status': tx['status'].title(),
                        'TX Hash': tx.get('transaction_hash', 'N/A')
                    })
                
                df_blockchain = pd.DataFrame(blockchain_tx_data)
                csv_blockchain = df_blockchain.to_csv(index=False)
                st.download_button(
                    label="📥 Download Blockchain Transactions CSV",
                    data=csv_blockchain,
                    file_name=f"blockchain_transactions_{datetime.now().strftime('%Y%m%d')}.csv",
                    mime="text/csv",
                    key="download_blockchain_csv"
                )
