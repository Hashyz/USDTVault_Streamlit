import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta
from decimal import Decimal
import pandas as pd
from utils.auth import init_session_state, require_auth, get_current_user, logout
from utils.database import get_user_transactions, get_user_savings_goals, get_user_investment_plans
from utils.blockchain import get_wallet_balance

st.set_page_config(
    page_title="Dashboard - USDT Vault Pro",
    page_icon="📊",
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
        min-height: 200px;
    }
    .metric-value {
        font-size: 2rem;
        font-weight: 700;
        color: #F0B90B;
        font-family: 'Roboto Mono', monospace;
    }
    .metric-label {
        font-size: 0.875rem;
        color: #848E9C;
        margin-bottom: 0.5rem;
    }
    .metric-change {
        font-size: 0.875rem;
        margin-top: 0.5rem;
    }
    .positive { color: #0ECB81; }
    .negative { color: #F6465D; }
    h1, h2, h3 { color: #EAECEF; }
    p { color: #848E9C; }
    div[data-testid="stSidebar"] { background-color: #1E2329; }
    .gold-text { color: #F0B90B; }
    .blockchain-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 2px solid #F0B90B;
        margin-bottom: 1rem;
        position: relative;
        min-height: 200px;
    }
    .blockchain-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #F0B90B, #0ECB81);
        border-radius: 12px 12px 0 0;
    }
    .live-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: #0ECB81;
        background: rgba(14, 203, 129, 0.1);
        padding: 4px 8px;
        border-radius: 4px;
        margin-bottom: 0.5rem;
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
    .wallet-address {
        font-family: 'Roboto Mono', monospace;
        font-size: 0.75rem;
        color: #848E9C;
        background: rgba(60, 68, 82, 0.5);
        padding: 4px 8px;
        border-radius: 4px;
        margin-top: 0.5rem;
    }
    .balance-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 0.5rem 0;
    }
    .balance-label {
        font-size: 0.875rem;
        color: #848E9C;
    }
    .balance-amount {
        font-family: 'Roboto Mono', monospace;
        font-weight: 600;
        color: #EAECEF;
    }
    .error-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid #F6465D;
        margin-bottom: 1rem;
    }
    .section-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #848E9C;
        margin-bottom: 0.25rem;
    }
</style>
""", unsafe_allow_html=True)

init_session_state()

if not st.session_state.get('authenticated'):
    st.switch_page("app.py")

user = get_current_user()
if not user:
    st.switch_page("app.py")

linked_addr = user.get('linked_wallet_address')
sidebar_balance_display = "Link wallet to view"
if linked_addr:
    sidebar_blockchain_balance = get_wallet_balance(linked_addr)
    if sidebar_blockchain_balance:
        sidebar_usdt = Decimal(sidebar_blockchain_balance.get('usdt', '0'))
        sidebar_balance_display = f"${sidebar_usdt:,.2f}"
    else:
        sidebar_balance_display = "Unable to fetch"

with st.sidebar:
    st.markdown(f"### 👤 {user['username'].title()}")
    st.markdown(f"**USDT Balance:** `{sidebar_balance_display}`")
    if linked_addr:
        st.markdown(f"**Wallet:** `{linked_addr[:6]}...{linked_addr[-4:]}`")
    else:
        st.markdown("**Wallet:** `Not linked`")
    st.markdown("---")
    
    if st.button("📊 Dashboard", use_container_width=True):
        pass
    if st.button("🎯 Savings Goals", use_container_width=True):
        st.switch_page("pages/2_Savings_Goals.py")
    if st.button("💸 Transactions", use_container_width=True):
        st.switch_page("pages/3_Transactions.py")
    if st.button("📈 Investment Plans", use_container_width=True):
        st.switch_page("pages/4_Investment_Plans.py")
    if st.button("⚙️ Settings", use_container_width=True):
        st.switch_page("pages/5_Settings.py")
    
    st.markdown("---")
    if st.button("🚪 Logout", use_container_width=True):
        logout()
        st.switch_page("app.py")

st.markdown("# 📊 Dashboard")
st.markdown(f"Welcome back, **{user['username'].title()}**!")

balance = Decimal(user.get('balance', '0'))
transactions = get_user_transactions(st.session_state.user_id)
savings_goals = get_user_savings_goals(st.session_state.user_id)
investment_plans = get_user_investment_plans(st.session_state.user_id)

total_received = sum(Decimal(tx['amount']) for tx in transactions if tx['type'] == 'receive')
total_sent = sum(Decimal(tx['amount']) for tx in transactions if tx['type'] == 'send')
total_savings = sum(Decimal(goal.get('current', '0')) for goal in savings_goals)

linked_wallet = user.get('linked_wallet_address')
blockchain_balances = None
blockchain_error = False

if linked_wallet:
    blockchain_balances = get_wallet_balance(linked_wallet)
    if blockchain_balances is None:
        blockchain_error = True

if linked_wallet:
    col1, col2, col3, col4, col5 = st.columns(5)
    col_received, col_sent, col_savings = col3, col4, col5
else:
    col1, col2, col3, col4 = st.columns(4)
    col_received, col_sent, col_savings = col2, col3, col4

with col1:
    if linked_wallet and blockchain_balances and not blockchain_error:
        main_usdt_balance = Decimal(blockchain_balances['usdt'])
        st.markdown(f"""
        <div class="metric-card">
            <div class="section-label">Wallet Balance</div>
            <div class="metric-label">💰 USDT Balance</div>
            <div class="metric-value">${main_usdt_balance:,.2f}</div>
            <div class="metric-change">USDT (BEP20)</div>
        </div>
        """, unsafe_allow_html=True)
    elif linked_wallet and blockchain_error:
        st.markdown(f"""
        <div class="error-card">
            <div class="section-label">Wallet Balance</div>
            <div class="metric-label">💰 USDT Balance</div>
            <div style="color: #F6465D; font-size: 1.25rem; margin: 0.5rem 0;">
                ⚠️ Unable to fetch
            </div>
            <div style="color: #848E9C; font-size: 0.75rem;">
                Network issue. Please refresh.
            </div>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown(f"""
        <div class="metric-card">
            <div class="section-label">Wallet Balance</div>
            <div class="metric-label">💰 USDT Balance</div>
            <div style="color: #848E9C; font-size: 1.25rem; margin: 0.5rem 0;">
                Link wallet to view
            </div>
            <div style="color: #848E9C; font-size: 0.75rem;">
                Go to Settings to link your BSC wallet
            </div>
        </div>
        """, unsafe_allow_html=True)

if linked_wallet:
    with col2:
        shortened_wallet = f"{linked_wallet[:6]}...{linked_wallet[-4:]}"
        if blockchain_balances and not blockchain_error:
            bnb_balance = Decimal(blockchain_balances['bnb'])
            usdt_balance = Decimal(blockchain_balances['usdt'])
            total_usd = Decimal(blockchain_balances['total_usd'])
            st.markdown(f"""
            <div class="blockchain-card">
                <div class="section-label">Blockchain Balance</div>
                <div class="live-indicator">
                    <span class="live-dot"></span>
                    Live from BSC
                </div>
                <div class="metric-label">🔗 Blockchain Wallet</div>
                <div class="metric-value">${total_usd:,.2f}</div>
                <div class="balance-row">
                    <span class="balance-label">BNB</span>
                    <span class="balance-amount">{bnb_balance:.4f}</span>
                </div>
                <div class="balance-row">
                    <span class="balance-label">USDT</span>
                    <span class="balance-amount">${usdt_balance:,.2f}</span>
                </div>
                <div class="wallet-address">{shortened_wallet}</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="error-card">
                <div class="section-label">Blockchain Balance</div>
                <div class="metric-label">🔗 Blockchain Wallet</div>
                <div style="color: #F6465D; font-size: 0.875rem; margin: 0.5rem 0;">
                    ⚠️ Unable to fetch balances
                </div>
                <div style="color: #848E9C; font-size: 0.75rem;">
                    Network issue. Please refresh to retry.
                </div>
                <div class="wallet-address">{shortened_wallet}</div>
            </div>
            """, unsafe_allow_html=True)

with col_received:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">📥 Total Received</div>
        <div class="metric-value positive">${total_received:,.2f}</div>
        <div class="metric-change positive">+{len([tx for tx in transactions if tx['type'] == 'receive'])} transactions</div>
    </div>
    """, unsafe_allow_html=True)

with col_sent:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">📤 Total Sent</div>
        <div class="metric-value negative">${total_sent:,.2f}</div>
        <div class="metric-change negative">-{len([tx for tx in transactions if tx['type'] == 'send'])} transactions</div>
    </div>
    """, unsafe_allow_html=True)

with col_savings:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">🎯 Total Savings</div>
        <div class="metric-value">${total_savings:,.2f}</div>
        <div class="metric-change">{len(savings_goals)} active goals</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

col_chart, col_goals = st.columns([2, 1])

with col_chart:
    st.markdown("### 📈 Balance History")
    
    if transactions:
        running_balance = balance
        balance_history = []
        
        sorted_txs = sorted(transactions, key=lambda x: x['created_at'], reverse=True)
        
        for tx in sorted_txs:
            balance_history.append({
                'date': tx['created_at'],
                'balance': float(running_balance)
            })
            if tx['type'] == 'receive':
                running_balance -= Decimal(tx['amount'])
            else:
                running_balance += Decimal(tx['amount'])
        
        balance_history.append({
            'date': datetime.now() - timedelta(days=30),
            'balance': float(running_balance)
        })
        
        balance_history.reverse()
        df = pd.DataFrame(balance_history)
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=df['date'],
            y=df['balance'],
            mode='lines+markers',
            line=dict(color='#F0B90B', width=3),
            marker=dict(size=8, color='#F0B90B'),
            fill='tozeroy',
            fillcolor='rgba(240, 185, 11, 0.1)'
        ))
        
        fig.update_layout(
            paper_bgcolor='#1E2329',
            plot_bgcolor='#1E2329',
            font=dict(color='#EAECEF'),
            xaxis=dict(
                gridcolor='#3C4452',
                linecolor='#3C4452'
            ),
            yaxis=dict(
                gridcolor='#3C4452',
                linecolor='#3C4452',
                tickprefix='$'
            ),
            margin=dict(l=0, r=0, t=30, b=0),
            height=350
        )
        
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No transaction history yet. Make your first deposit to see balance history!")

with col_goals:
    st.markdown("### 🎯 Savings Goals")
    
    if savings_goals:
        for goal in savings_goals[:3]:
            current = Decimal(goal.get('current', '0'))
            target = Decimal(goal.get('target', '1'))
            progress = min(float(current / target * 100), 100)
            
            st.markdown(f"""
            <div class="metric-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #EAECEF; font-weight: 600;">{goal['title']}</span>
                    <span class="gold-text">{progress:.0f}%</span>
                </div>
                <div style="background: #3C4452; border-radius: 4px; height: 8px; margin: 0.5rem 0;">
                    <div style="background: linear-gradient(90deg, #F0B90B, #0ECB81); width: {progress}%; height: 100%; border-radius: 4px;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #848E9C;">
                    <span>${current:,.2f}</span>
                    <span>${target:,.2f}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("No savings goals yet. Create one to start tracking your progress!")

st.markdown("---")

col_tx, col_plans = st.columns(2)

with col_tx:
    st.markdown("### 📋 Recent Transactions")
    
    if transactions:
        for tx in transactions[:5]:
            tx_type = tx['type']
            amount = Decimal(tx['amount'])
            icon = "📥" if tx_type == 'receive' else "📤"
            color = "#0ECB81" if tx_type == 'receive' else "#F6465D"
            sign = "+" if tx_type == 'receive' else "-"
            
            st.markdown(f"""
            <div class="metric-card" style="padding: 1rem; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 1.25rem;">{icon}</span>
                        <span style="color: #EAECEF; margin-left: 0.5rem;">{tx_type.title()}</span>
                    </div>
                    <span style="color: {color}; font-weight: 600; font-family: 'Roboto Mono', monospace;">
                        {sign}${amount:,.2f}
                    </span>
                </div>
                <div style="font-size: 0.75rem; color: #848E9C; margin-top: 0.25rem;">
                    {tx['created_at'].strftime('%Y-%m-%d %H:%M')} | {tx['address'][:10]}...
                </div>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("No transactions yet.")

with col_plans:
    st.markdown("### 📈 Investment Plans")
    
    if investment_plans:
        for plan in investment_plans[:3]:
            amount = Decimal(plan['amount'])
            frequency = plan['frequency'].title()
            auto = "🟢 Active" if plan.get('auto_invest') else "⚪ Paused"
            
            st.markdown(f"""
            <div class="metric-card" style="padding: 1rem; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #EAECEF; font-weight: 600;">{plan['name']}</span>
                    <span style="font-size: 0.75rem;">{auto}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                    <span style="color: #F0B90B; font-family: 'Roboto Mono', monospace;">${amount:,.2f}</span>
                    <span style="color: #848E9C;">{frequency}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("No investment plans yet.")
