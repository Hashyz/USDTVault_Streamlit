import streamlit as st
from utils.database import authenticate_user, create_user, get_user_by_id

def init_session_state():
    """Initialize session state variables"""
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    if 'user_id' not in st.session_state:
        st.session_state.user_id = None
    if 'username' not in st.session_state:
        st.session_state.username = None

def login(username: str, password: str) -> tuple[bool, str]:
    """Login user and set session state"""
    user = authenticate_user(username, password)
    if user:
        st.session_state.authenticated = True
        st.session_state.user_id = str(user["_id"])
        st.session_state.username = user["username"]
        return True, "Login successful!"
    return False, "Invalid username or password"

def register(username: str, password: str) -> tuple[bool, str]:
    """Register new user"""
    if len(username) < 3:
        return False, "Username must be at least 3 characters"
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    user = create_user(username, password)
    if user:
        st.session_state.authenticated = True
        st.session_state.user_id = str(user["_id"])
        st.session_state.username = user["username"]
        return True, "Registration successful!"
    return False, "Username already exists"

def logout():
    """Logout user and clear session state"""
    st.session_state.authenticated = False
    st.session_state.user_id = None
    st.session_state.username = None

def get_current_user():
    """Get current user data"""
    if not st.session_state.get('authenticated') or not st.session_state.get('user_id'):
        return None
    return get_user_by_id(st.session_state.user_id)

def require_auth():
    """Check if user is authenticated, redirect to login if not"""
    init_session_state()
    if not st.session_state.authenticated:
        st.switch_page("app.py")
        return False
    return True
