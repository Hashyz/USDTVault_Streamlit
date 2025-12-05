# USDT Vault Pro - Python Streamlit Edition

## Overview

A secure USDT savings and portfolio management platform built with Python and Streamlit. This application enables users to manage their USDT holdings, track transactions, set savings goals, create investment plans, and monitor their financial progress through an intuitive dashboard.

The platform is designed with a Binance-inspired dark theme featuring gold accent colors (#F0B90B) for a professional cryptocurrency experience.

## Tech Stack

- **Frontend/Backend**: Python 3.11 with Streamlit
- **Database**: MongoDB (via PyMongo)
- **Authentication**: bcrypt for password hashing
- **Charts**: Plotly for interactive visualizations
- **Data Processing**: Pandas for transaction analysis

## Project Structure

```
├── app.py                    # Main entry point with login/register
├── pages/
│   ├── 1_Dashboard.py        # Main dashboard with stats and charts
│   ├── 2_Savings_Goals.py    # Savings goals management
│   ├── 3_Transactions.py     # Transaction history and receive funds
│   ├── 4_Investment_Plans.py # DCA investment plans
│   ├── 5_Settings.py         # Account settings and security
│   └── 6_Profile.py          # Public profile viewer
├── utils/
│   ├── __init__.py
│   ├── database.py           # MongoDB connection and models
│   ├── auth.py               # Authentication helpers
│   ├── blockchain.py         # BSC blockchain read-only service
│   ├── theme.py              # Shared CSS and styling (unified design system)
│   └── sidebar.py            # Shared sidebar navigation component
└── .streamlit/
    └── config.toml           # Streamlit configuration
```

## UI/UX Architecture

- **Unified Theme System**: All pages use `utils/theme.py` for consistent styling
- **Shared Sidebar**: Navigation component in `utils/sidebar.py` with user info display
- **No Duplicate Navigation**: Default Streamlit navigation hidden via CSS
- **Consistent Components**: Metric cards, progress bars, and buttons styled uniformly

## Features

### Completed Features
- User authentication (login/register) with session state
- Dashboard with blockchain balance display and stats cards
- Savings goals with progress tracking
- Transaction history with receive functionality and QR code
- Investment plans with DCA scheduling
- Settings page with PIN protection and wallet linking
- Binance-inspired dark theme with gold accents
- **Blockchain Integration (Read-Only)**:
  - Link your real BSC wallet address to view live balances
  - Dashboard shows real-time BNB and USDT balances from BSC
  - Transaction history tab shows real blockchain transactions from BSCScan
  - No private key required - safe, read-only access
- **Public Profile Feature**:
  - View any user's public wallet at `/?user=username`
  - Shows linked wallet address, QR code, and live blockchain balances
  - Shareable profile URLs (e.g., for username "hashyz" use `/?user=hashyz`)

### Data Models

**User**
- username, password (hashed)
- balance, pin (hashed), linked_wallet_address
- created_at timestamp

**Transaction**
- user_id, type (send/receive), amount
- address, status, created_at

**Savings Goal**
- user_id, title, current, target
- deadline, auto_save settings
- saving_streak

**Investment Plan**
- user_id, name, amount, frequency
- next_contribution, auto_invest flag

## Setup Instructions

1. Add your MongoDB connection string as a secret:
   - Key: `MONGODB_URI`
   - Value: Your MongoDB connection string

2. The app will automatically start on port 5000

## Getting Started

1. Register a new account with username and password
2. Link your real BSC wallet address in Settings to view blockchain balances
3. Set up a PIN for added security on withdrawals

## Color Palette

- **Primary Gold**: #F0B90B
- **Background Dark**: #0B0E11
- **Card Background**: #1E2329
- **Input Background**: #2B3139
- **Success Green**: #0ECB81
- **Error Red**: #F6465D
- **Text Primary**: #EAECEF
- **Text Secondary**: #848E9C
