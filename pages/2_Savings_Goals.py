import streamlit as st
from datetime import datetime, timedelta
from decimal import Decimal
from utils.auth import init_session_state, get_current_user
from utils.database import (
    get_user_savings_goals, create_savings_goal, 
    update_savings_goal, delete_savings_goal, 
    get_user_by_id, update_user_balance
)
from utils.theme import inject_theme
from utils.sidebar import render_sidebar, check_auth

st.set_page_config(
    page_title="Savings Goals - USDT Vault Pro",
    page_icon="🎯",
    layout="wide"
)

inject_theme()

init_session_state()

if not check_auth():
    st.stop()

user = get_current_user()

render_sidebar("savings_goals")

st.markdown("# 🎯 Savings Goals")
st.markdown("Set and track your USDT savings targets")

goals = get_user_savings_goals(st.session_state.user_id)
user_balance = Decimal(user.get('balance', '0'))

col_main, col_form = st.columns([2, 1])

with col_form:
    st.markdown("### ➕ Create New Goal")
    
    with st.form("create_goal_form"):
        title = st.text_input("Goal Name", placeholder="e.g., Emergency Fund")
        target = st.number_input("Target Amount (USDT)", min_value=1.0, value=1000.0, step=100.0)
        deadline = st.date_input("Target Date", value=datetime.now() + timedelta(days=90), min_value=datetime.now())
        
        auto_save = st.checkbox("Enable Auto-Save")
        
        auto_amount = 100.0
        auto_frequency = "monthly"
        if auto_save:
            auto_amount = st.number_input("Auto-Save Amount", min_value=1.0, value=100.0, step=10.0)
            auto_frequency = st.selectbox("Frequency", ["daily", "weekly", "monthly"])
        
        submit = st.form_submit_button("Create Goal", use_container_width=True)
        
        if submit and title:
            new_goal = create_savings_goal(
                st.session_state.user_id,
                title,
                str(target),
                datetime.combine(deadline, datetime.min.time())
            )
            if new_goal:
                if auto_save:
                    update_savings_goal(str(new_goal['_id']), {
                        'auto_save_enabled': True,
                        'auto_save_amount': str(auto_amount),
                        'auto_save_frequency': str(auto_frequency)
                    })
                st.success(f"Goal '{title}' created!")
                st.rerun()
            else:
                st.error("Failed to create goal")

with col_main:
    if goals:
        for goal in goals:
            goal_id = str(goal['_id'])
            current = Decimal(goal.get('current', '0'))
            target = Decimal(goal.get('target', '1'))
            progress = min(float(current / target * 100), 100)
            deadline = goal.get('deadline', datetime.now())
            days_left = (deadline - datetime.now()).days
            
            st.markdown(f"""
            <div class="metric-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="goal-title">{goal['title']}</span>
                    <span style="color: {'#0ECB81' if progress >= 100 else '#F0B90B'}; font-weight: 600;">
                        {progress:.1f}% Complete
                    </span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {progress}%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; color: #848E9C;">
                    <span class="goal-amount">${current:,.2f} / ${target:,.2f}</span>
                    <span>{'✅ Complete!' if days_left < 0 and progress >= 100 else f'{max(0, days_left)} days left'}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
            
            with col1:
                deposit_amount = st.number_input(
                    "Deposit", 
                    min_value=0.0, 
                    max_value=float(user_balance),
                    value=0.0, 
                    step=10.0,
                    key=f"deposit_{goal_id}"
                )
            
            with col2:
                if st.button("💰 Deposit", key=f"dep_btn_{goal_id}", use_container_width=True):
                    if deposit_amount > 0:
                        new_current = current + Decimal(str(deposit_amount))
                        new_balance = user_balance - Decimal(str(deposit_amount))
                        
                        if new_balance >= 0:
                            update_savings_goal(goal_id, {'current': str(new_current)})
                            update_user_balance(st.session_state.user_id, str(new_balance))
                            st.success(f"Deposited ${deposit_amount:.2f}")
                            st.rerun()
                        else:
                            st.error("Insufficient balance")
            
            with col3:
                withdraw_amount = st.number_input(
                    "Withdraw",
                    min_value=0.0,
                    max_value=float(current),
                    value=0.0,
                    step=10.0,
                    key=f"withdraw_{goal_id}"
                )
            
            with col4:
                if st.button("📤 Withdraw", key=f"wit_btn_{goal_id}", use_container_width=True):
                    if withdraw_amount > 0:
                        new_current = current - Decimal(str(withdraw_amount))
                        new_balance = user_balance + Decimal(str(withdraw_amount))
                        
                        update_savings_goal(goal_id, {'current': str(new_current)})
                        update_user_balance(st.session_state.user_id, str(new_balance))
                        st.success(f"Withdrew ${withdraw_amount:.2f}")
                        st.rerun()
            
            col_info, col_del = st.columns([3, 1])
            
            with col_info:
                if goal.get('auto_save_enabled'):
                    st.caption(f"🔄 Auto-Save: ${goal.get('auto_save_amount', '0')} {goal.get('auto_save_frequency', 'monthly')}")
            
            with col_del:
                if st.button("🗑️ Delete", key=f"del_{goal_id}", use_container_width=True):
                    if current > 0:
                        new_balance = user_balance + current
                        update_user_balance(st.session_state.user_id, str(new_balance))
                    delete_savings_goal(goal_id)
                    st.success("Goal deleted")
                    st.rerun()
            
            st.markdown("---")
    else:
        st.info("No savings goals yet. Create your first goal to start saving!")
        
        st.markdown("""
        ### 💡 Tips for Savings Goals
        
        - **Emergency Fund**: Aim for 3-6 months of expenses
        - **Short-term Goals**: Vacations, gadgets, or special purchases
        - **Long-term Goals**: Major purchases, investments
        - **Auto-Save**: Set it and forget it - automatic contributions help you save consistently
        """)
