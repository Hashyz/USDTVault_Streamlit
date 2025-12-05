import streamlit as st
from datetime import datetime, timedelta
from decimal import Decimal
from utils.auth import init_session_state, get_current_user, logout
from utils.database import (
    get_user_investment_plans, create_investment_plan,
    update_investment_plan, delete_investment_plan
)

st.set_page_config(
    page_title="Investment Plans - USDT Vault Pro",
    page_icon="📈",
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
    .plan-active { border-left: 4px solid #0ECB81; }
    .plan-paused { border-left: 4px solid #848E9C; }
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
        st.switch_page("pages/3_Transactions.py")
    if st.button("📈 Investment Plans", use_container_width=True):
        pass
    if st.button("⚙️ Settings", use_container_width=True):
        st.switch_page("pages/5_Settings.py")
    
    st.markdown("---")
    if st.button("🚪 Logout", use_container_width=True):
        logout()
        st.switch_page("app.py")

st.markdown("# 📈 Investment Plans")
st.markdown("Set up recurring investment schedules for dollar-cost averaging")

plans = get_user_investment_plans(st.session_state.user_id)

col_main, col_form = st.columns([2, 1])

with col_form:
    st.markdown("### ➕ Create New Plan")
    
    with st.form("create_plan_form"):
        name = st.text_input("Plan Name", placeholder="e.g., Weekly DCA")
        amount = st.number_input("Investment Amount (USDT)", min_value=1.0, value=100.0, step=10.0)
        frequency = st.selectbox("Frequency", ["daily", "weekly", "monthly"])
        
        if frequency == "daily":
            next_date = datetime.now() + timedelta(days=1)
        elif frequency == "weekly":
            next_date = datetime.now() + timedelta(weeks=1)
        else:
            next_date = datetime.now() + timedelta(days=30)
        
        start_date = st.date_input("First Contribution", value=next_date, min_value=datetime.now())
        auto_invest = st.checkbox("Enable Auto-Invest", value=True)
        
        submit = st.form_submit_button("Create Plan", use_container_width=True)
        
        if submit and name:
            new_plan = create_investment_plan(
                st.session_state.user_id,
                name,
                str(amount),
                frequency,
                datetime.combine(start_date, datetime.min.time())
            )
            if new_plan:
                if auto_invest:
                    update_investment_plan(str(new_plan['_id']), {'auto_invest': True})
                st.success(f"Plan '{name}' created!")
                st.rerun()
            else:
                st.error("Failed to create plan")
    
    st.markdown("---")
    st.markdown("""
    ### 💡 DCA Strategy Tips
    
    **Dollar-Cost Averaging** helps reduce the impact of volatility:
    
    - **Daily**: Higher frequency, smoother average
    - **Weekly**: Good balance of frequency and convenience
    - **Monthly**: Lower frequency, simpler to manage
    
    Auto-invest automatically contributes on schedule.
    """)

with col_main:
    if plans:
        total_monthly = Decimal('0')
        for plan in plans:
            amount = Decimal(plan['amount'])
            freq = plan['frequency']
            if freq == 'daily':
                total_monthly += amount * 30
            elif freq == 'weekly':
                total_monthly += amount * 4
            else:
                total_monthly += amount
        
        st.markdown(f"""
        <div class="metric-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="color: #848E9C; font-size: 0.875rem;">Estimated Monthly Investment</div>
                    <div style="color: #F0B90B; font-size: 2rem; font-weight: 700; font-family: 'Roboto Mono', monospace;">
                        ${total_monthly:,.2f} USDT
                    </div>
                </div>
                <div style="color: #848E9C;">
                    {len(plans)} Active Plan{'s' if len(plans) > 1 else ''}
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        for plan in plans:
            plan_id = str(plan['_id'])
            amount = Decimal(plan['amount'])
            frequency = plan['frequency'].title()
            next_contribution = plan.get('next_contribution', datetime.now())
            is_active = plan.get('auto_invest', False)
            
            status_class = "plan-active" if is_active else "plan-paused"
            status_text = "🟢 Active" if is_active else "⚪ Paused"
            days_until = (next_contribution - datetime.now()).days
            
            st.markdown(f"""
            <div class="metric-card {status_class}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: #EAECEF; font-size: 1.25rem; font-weight: 600;">{plan['name']}</span>
                        <span style="font-size: 0.75rem; margin-left: 0.5rem;">{status_text}</span>
                    </div>
                    <span style="color: #F0B90B; font-size: 1.5rem; font-weight: 700; font-family: 'Roboto Mono', monospace;">
                        ${amount:,.2f}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 1rem; color: #848E9C; font-size: 0.875rem;">
                    <span>📅 {frequency}</span>
                    <span>Next: {next_contribution.strftime('%Y-%m-%d')} ({max(0, days_until)} days)</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns([1, 1, 1])
            
            with col1:
                if is_active:
                    if st.button("⏸️ Pause", key=f"pause_{plan_id}", use_container_width=True):
                        update_investment_plan(plan_id, {'auto_invest': False})
                        st.success("Plan paused")
                        st.rerun()
                else:
                    if st.button("▶️ Resume", key=f"resume_{plan_id}", use_container_width=True):
                        update_investment_plan(plan_id, {'auto_invest': True})
                        st.success("Plan resumed")
                        st.rerun()
            
            with col2:
                new_amount = st.number_input(
                    "Edit Amount",
                    min_value=1.0,
                    value=float(amount),
                    step=10.0,
                    key=f"amount_{plan_id}",
                    label_visibility="collapsed"
                )
                if new_amount != float(amount):
                    if st.button("💾 Save", key=f"save_{plan_id}"):
                        update_investment_plan(plan_id, {'amount': str(new_amount)})
                        st.success("Amount updated")
                        st.rerun()
            
            with col3:
                if st.button("🗑️ Delete", key=f"del_{plan_id}", use_container_width=True):
                    delete_investment_plan(plan_id)
                    st.success("Plan deleted")
                    st.rerun()
            
            st.markdown("---")
    else:
        st.info("No investment plans yet. Create your first plan to start dollar-cost averaging!")
        
        st.markdown("""
        ### 📊 Why Use Investment Plans?
        
        1. **Consistency**: Regular contributions build wealth over time
        2. **Discipline**: Automated investing removes emotional decisions
        3. **Flexibility**: Pause, adjust, or delete plans anytime
        4. **Dollar-Cost Averaging**: Buy more when prices are low, less when high
        """)
