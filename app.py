import streamlit as st
import os
from utils.database import init_db, get_db
from utils.auth import init_session_state, login, register, logout

st.set_page_config(
    page_title="USDT Vault Pro",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap');
    
    :root {
        --gold: #F0B90B;
        --gold-dark: #C99E00;
        --green: #0ECB81;
        --red: #F6465D;
        --bg-dark: #0B0E11;
        --bg-card: #1E2329;
        --bg-input: #2B3139;
        --text-primary: #EAECEF;
        --text-secondary: #848E9C;
    }
    
    .stApp {
        background-color: #0B0E11;
    }
    
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        color: #F0B90B;
        text-align: center;
        margin-bottom: 0.5rem;
    }
    
    .sub-header {
        font-size: 1rem;
        color: #848E9C;
        text-align: center;
        margin-bottom: 2rem;
    }
    
    .stButton > button {
        background: linear-gradient(135deg, #F0B90B 0%, #C99E00 100%);
        color: #0B0E11;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        padding: 0.75rem 1.5rem;
        width: 100%;
        transition: all 0.3s ease;
    }
    
    .stButton > button:hover {
        background: linear-gradient(135deg, #FFD93D 0%, #F0B90B 100%);
        box-shadow: 0 4px 15px rgba(240, 185, 11, 0.3);
    }
    
    .stTextInput > div > div > input {
        background-color: #2B3139;
        border: 1px solid #3C4452;
        border-radius: 8px;
        color: #EAECEF;
        padding: 0.75rem;
    }
    
    .stTextInput > div > div > input:focus {
        border-color: #F0B90B;
        box-shadow: 0 0 0 2px rgba(240, 185, 11, 0.2);
    }
    
    div[data-testid="stSidebar"] {
        background-color: #1E2329;
    }
    
    div[data-testid="stSidebar"] .stButton > button {
        background: transparent;
        color: #EAECEF;
        border: 1px solid #3C4452;
        text-align: left;
        justify-content: flex-start;
    }
    
    div[data-testid="stSidebar"] .stButton > button:hover {
        background: rgba(240, 185, 11, 0.1);
        border-color: #F0B90B;
    }
    
    .metric-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid #3C4452;
    }
    
    .success-text { color: #0ECB81; }
    .error-text { color: #F6465D; }
    .gold-text { color: #F0B90B; }
    
    h1, h2, h3 { color: #EAECEF; }
    p { color: #848E9C; }
    
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: transparent;
    }
    
    .stTabs [data-baseweb="tab"] {
        background-color: #2B3139;
        border-radius: 8px;
        color: #848E9C;
        padding: 0.5rem 1rem;
    }
    
    .stTabs [aria-selected="true"] {
        background-color: #F0B90B;
        color: #0B0E11;
    }
</style>
""", unsafe_allow_html=True)

init_session_state()

db = init_db()
db_connected = db is not None

if st.session_state.authenticated:
    st.switch_page("pages/1_Dashboard.py")
else:
    st.markdown('<h1 class="main-header">💰 USDT Vault Pro</h1>', unsafe_allow_html=True)
    st.markdown('<p class="sub-header">Secure USDT Savings & Portfolio Management</p>', unsafe_allow_html=True)
    
    if not db_connected:
        st.warning("⚠️ MongoDB not connected. Please add your MONGODB_URI to Secrets to enable full functionality.")
    
    tab1, tab2 = st.tabs(["🔐 Login", "📝 Register"])
    
    with tab1:
        st.markdown("### Welcome Back")
        with st.form("login_form"):
            username = st.text_input("Username", placeholder="Enter your username")
            password = st.text_input("Password", type="password", placeholder="Enter your password")
            
            login_btn = st.form_submit_button("Login", use_container_width=True)
            
            if login_btn:
                if username and password:
                    success, message = login(username, password)
                    if success:
                        st.success(message)
                        st.rerun()
                    else:
                        st.error(message)
                else:
                    st.warning("Please enter username and password")
    
    with tab2:
        st.markdown("### Create Account")
        with st.form("register_form"):
            new_username = st.text_input("Username", placeholder="Choose a username (min 3 characters)")
            new_password = st.text_input("Password", type="password", placeholder="Choose a password (min 8 characters)")
            confirm_password = st.text_input("Confirm Password", type="password", placeholder="Confirm your password")
            
            register_btn = st.form_submit_button("Create Account", use_container_width=True)
            
            if register_btn:
                if new_password != confirm_password:
                    st.error("Passwords do not match")
                elif new_username and new_password:
                    if db_connected:
                        success, message = register(new_username, new_password)
                        if success:
                            st.success(message)
                            st.rerun()
                        else:
                            st.error(message)
                    else:
                        st.error("Registration requires database connection")
                else:
                    st.warning("Please fill in all fields")
    
    st.markdown("---")
    st.markdown("""
    <div style="text-align: center; color: #848E9C; font-size: 0.875rem;">
        <p>Built for BEP20 USDT on Binance Smart Chain</p>
    </div>
    """, unsafe_allow_html=True)
