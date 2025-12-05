import streamlit as st

COLORS = {
    'gold': '#F0B90B',
    'gold_dark': '#C99E00',
    'green': '#0ECB81',
    'red': '#F6465D',
    'bg_dark': '#0B0E11',
    'bg_card': '#1E2329',
    'bg_input': '#2B3139',
    'border': '#3C4452',
    'text_primary': '#EAECEF',
    'text_secondary': '#848E9C',
}

def inject_theme():
    st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap');
    
    .stApp { background-color: #0B0E11; }
    
    [data-testid="stSidebarNav"] { display: none !important; }
    
    div[data-testid="stSidebar"] { 
        background-color: #1E2329;
        padding-top: 1rem;
    }
    
    div[data-testid="stSidebar"] .stButton > button {
        background: transparent;
        color: #EAECEF;
        border: 1px solid transparent;
        text-align: left;
        justify-content: flex-start;
        font-weight: 500;
        padding: 0.75rem 1rem;
        margin-bottom: 0.25rem;
        border-radius: 8px;
        transition: all 0.2s ease;
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
        margin-bottom: 1rem;
        min-height: 140px;
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
        color: #848E9C;
    }
    
    .positive { color: #0ECB81 !important; }
    .negative { color: #F6465D !important; }
    .gold-text { color: #F0B90B !important; }
    
    .blockchain-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 2px solid #F0B90B;
        margin-bottom: 1rem;
        position: relative;
        min-height: 140px;
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
        padding: 4px 10px;
        border-radius: 20px;
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
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
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
    
    .section-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #848E9C;
        margin-bottom: 0.25rem;
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
    
    .progress-bar {
        background: #3C4452;
        border-radius: 6px;
        height: 8px;
        margin: 0.75rem 0;
        overflow: hidden;
    }
    
    .progress-fill {
        background: linear-gradient(90deg, #F0B90B, #0ECB81);
        height: 100%;
        border-radius: 6px;
        transition: width 0.3s ease;
    }
    
    h1, h2, h3 { color: #EAECEF !important; font-family: 'Inter', sans-serif; }
    p { color: #848E9C; }
    
    .stButton > button {
        background: linear-gradient(135deg, #F0B90B 0%, #C99E00 100%);
        color: #0B0E11;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        padding: 0.75rem 1.5rem;
        transition: all 0.3s ease;
    }
    
    .stButton > button:hover {
        background: linear-gradient(135deg, #FFD93D 0%, #F0B90B 100%);
        box-shadow: 0 4px 15px rgba(240, 185, 11, 0.3);
    }
    
    .stTextInput > div > div > input,
    .stNumberInput > div > div > input,
    .stSelectbox > div > div > div {
        background-color: #2B3139 !important;
        border: 1px solid #3C4452 !important;
        border-radius: 8px !important;
        color: #EAECEF !important;
    }
    
    .stTextInput > div > div > input:focus,
    .stNumberInput > div > div > input:focus {
        border-color: #F0B90B !important;
        box-shadow: 0 0 0 2px rgba(240, 185, 11, 0.2) !important;
    }
    
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: transparent;
    }
    
    .stTabs [data-baseweb="tab"] {
        background-color: #2B3139;
        border-radius: 8px;
        color: #848E9C;
        padding: 0.5rem 1rem;
        border: 1px solid #3C4452;
    }
    
    .stTabs [aria-selected="true"] {
        background-color: #F0B90B !important;
        color: #0B0E11 !important;
        border-color: #F0B90B !important;
    }
    
    .stForm {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid #3C4452;
    }
    
    .page-header {
        margin-bottom: 1.5rem;
    }
    
    .page-title {
        font-size: 2rem;
        font-weight: 700;
        color: #EAECEF;
        margin-bottom: 0.25rem;
    }
    
    .page-subtitle {
        color: #848E9C;
        font-size: 1rem;
    }
    
    .card-grid {
        display: grid;
        gap: 1rem;
    }
    
    .user-card {
        background: linear-gradient(135deg, #1E2329 0%, #2B3139 100%);
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid #3C4452;
        margin-bottom: 1rem;
    }
    
    .user-name {
        font-size: 1.1rem;
        font-weight: 600;
        color: #EAECEF;
        margin-bottom: 0.25rem;
    }
    
    .user-balance {
        font-family: 'Roboto Mono', monospace;
        font-size: 1rem;
        color: #F0B90B;
    }
    
    .user-wallet {
        font-family: 'Roboto Mono', monospace;
        font-size: 0.75rem;
        color: #848E9C;
    }
    
    hr {
        border-color: #3C4452 !important;
        margin: 1.5rem 0 !important;
    }
</style>
""", unsafe_allow_html=True)


def page_header(title, subtitle=""):
    st.markdown(f"""
    <div class="page-header">
        <div class="page-title">{title}</div>
        <div class="page-subtitle">{subtitle}</div>
    </div>
    """, unsafe_allow_html=True)


def metric_card(label, value, change="", icon="", card_class="metric-card"):
    change_class = ""
    if change:
        if change.startswith("+") or "increase" in change.lower():
            change_class = "positive"
        elif change.startswith("-") or "decrease" in change.lower():
            change_class = "negative"
    
    st.markdown(f"""
    <div class="{card_class}">
        <div class="metric-label">{icon} {label}</div>
        <div class="metric-value">{value}</div>
        <div class="metric-change {change_class}">{change}</div>
    </div>
    """, unsafe_allow_html=True)
