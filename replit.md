# BSC Wallet Dashboard

## Overview

A simple, single-page wallet dashboard that displays live BSC (Binance Smart Chain) wallet balances. The app reads a wallet address from environment variables and shows real-time BNB and USDT balances with a QR code for receiving payments.

## Tech Stack

- **Frontend/Backend**: Python 3.11 with Streamlit
- **Blockchain**: Web3.py for BSC balance fetching
- **QR Code**: qrcode library for generating wallet QR codes

## Project Structure

```
├── app.py                    # Single-page wallet dashboard
├── replit.md                 # Project documentation
└── pyproject.toml            # Python dependencies
```

## Features

- Live BNB balance from BSC blockchain
- Live USDT (BEP20) balance from smart contract
- Total portfolio value calculation
- QR code for receiving payments
- Dark theme with gold accents (Binance-inspired)
- No database required - reads wallet from environment variable

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WALLET_ADDRESS` | Your BSC wallet address (0x...) | Yes |
| `WALLET_USERNAME` | Display name (e.g., @hashyz) | Optional |

## Setup Instructions

1. Add your wallet address as a secret:
   - Key: `WALLET_ADDRESS`
   - Value: Your BSC wallet address (e.g., `0xea151ac124637202bc59e7a5a9390782457b037d`)

2. Optionally add a display username:
   - Key: `WALLET_USERNAME`
   - Value: Your display name (e.g., `@hashyz`)

3. The app will automatically start on port 5000

## Color Palette

- **Primary Gold**: #F0B90B
- **Background Dark**: #0B0E11
- **Card Background**: #1E2329
- **Success Green**: #0ECB81
- **Error Red**: #F6465D
- **Text Primary**: #EAECEF
- **Text Secondary**: #848E9C
