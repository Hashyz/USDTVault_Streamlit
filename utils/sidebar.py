import streamlit as st
from decimal import Decimal
from utils.auth import logout, get_current_user
from utils.blockchain import get_wallet_balance


def render_sidebar(current_page=""):
    user = get_current_user()
    if not user:
        return
    
    linked_wallet = user.get('linked_wallet_address')
    balance_display = "Link wallet"
    wallet_display = "Not linked"
    
    if linked_wallet:
        wallet_display = f"{linked_wallet[:6]}...{linked_wallet[-4:]}"
        blockchain_balance = get_wallet_balance(linked_wallet)
        if blockchain_balance:
            usdt = Decimal(blockchain_balance.get('usdt', '0'))
            balance_display = f"${usdt:,.2f}"
        else:
            balance_display = "Error"
    
    with st.sidebar:
        st.markdown(f"""
        <div style="
            background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
            border-radius: 12px;
            padding: 1rem;
            border: 1px solid #3C4452;
            margin-bottom: 1rem;
        ">
            <div style="font-size: 1.1rem; font-weight: 600; color: #EAECEF; margin-bottom: 0.25rem;">
                {user['username'].title()}
            </div>
            <div style="font-family: 'Roboto Mono', monospace; font-size: 1rem; color: #F0B90B; margin-bottom: 0.25rem;">
                {balance_display}
            </div>
            <div style="font-family: 'Roboto Mono', monospace; font-size: 0.7rem; color: #848E9C;">
                {wallet_display}
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        pages = [
            ("📊", "Dashboard", "pages/1_Dashboard.py"),
            ("🎯", "Savings Goals", "pages/2_Savings_Goals.py"),
            ("💸", "Transactions", "pages/3_Transactions.py"),
            ("📈", "Investments", "pages/4_Investment_Plans.py"),
            ("⚙️", "Settings", "pages/5_Settings.py"),
        ]
        
        for icon, name, page_path in pages:
            page_name = name.lower().replace(" ", "_")
            is_current = current_page.lower() == page_name or current_page.lower() in page_path.lower()
            
            if is_current:
                st.markdown(f"""
                <div style="
                    background: rgba(240, 185, 11, 0.15);
                    border: 1px solid #F0B90B;
                    border-radius: 8px;
                    padding: 0.75rem 1rem;
                    margin-bottom: 0.25rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                ">
                    <span style="font-size: 1rem;">{icon}</span>
                    <span style="color: #F0B90B; font-weight: 600;">{name}</span>
                </div>
                """, unsafe_allow_html=True)
            else:
                st.page_link(page_path, label=f"{icon} {name}", use_container_width=True)
        
        st.markdown("---")
        
        col1, col2 = st.columns([3, 1])
        with col1:
            st.page_link("pages/6_Profile.py", label="👤 Public Profile", use_container_width=True)
        
        if st.button("🚪 Logout", key="nav_logout", use_container_width=True):
            logout()
            st.switch_page("app.py")


def check_auth():
    if not st.session_state.get('authenticated'):
        st.switch_page("app.py")
        return False
    
    user = get_current_user()
    if not user:
        st.switch_page("app.py")
        return False
    
    return True
