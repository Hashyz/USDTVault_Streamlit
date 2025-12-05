import os
import re
import requests
from typing import Optional, List, Dict, Any
from decimal import Decimal
from web3 import Web3
from web3.exceptions import Web3Exception

BSC_RPC_URL = "https://bsc-dataseed.binance.org/"
BSCSCAN_API_URL = "https://api.bscscan.com/api"
USDT_CONTRACT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955"

USDT_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]

_web3: Optional[Web3] = None
_usdt_contract = None


def _get_web3() -> Optional[Web3]:
    """Get or create Web3 instance connected to BSC."""
    global _web3
    if _web3 is None:
        try:
            _web3 = Web3(Web3.HTTPProvider(BSC_RPC_URL))
            if not _web3.is_connected():
                _web3 = None
        except Exception:
            _web3 = None
    return _web3


def _get_usdt_contract():
    """Get or create USDT contract instance."""
    global _usdt_contract
    if _usdt_contract is None:
        web3 = _get_web3()
        if web3:
            try:
                checksum_address = Web3.to_checksum_address(USDT_CONTRACT_ADDRESS)
                _usdt_contract = web3.eth.contract(address=checksum_address, abi=USDT_ABI)
            except Exception:
                _usdt_contract = None
    return _usdt_contract


def validate_address(address: str) -> bool:
    """
    Validate if address is a valid BSC/Ethereum wallet address.
    Must be in 0x... format with exactly 42 characters.
    """
    if not address or not isinstance(address, str):
        return False
    
    if not re.match(r'^0x[a-fA-F0-9]{40}$', address):
        return False
    
    try:
        Web3.to_checksum_address(address)
        return True
    except Exception:
        return False


def get_bnb_balance(address: str) -> Optional[Decimal]:
    """
    Fetch BNB balance for a wallet address.
    Returns balance in BNB or None on failure.
    """
    if not validate_address(address):
        return None
    
    web3 = _get_web3()
    if not web3:
        return None
    
    try:
        checksum_address = Web3.to_checksum_address(address)
        balance_wei = web3.eth.get_balance(checksum_address)
        balance_bnb = Decimal(str(balance_wei)) / Decimal(10 ** 18)
        return balance_bnb
    except Exception:
        return None


def get_usdt_balance(address: str) -> Optional[Decimal]:
    """
    Fetch USDT (BEP20) balance for a wallet address.
    Returns balance in USDT or None on failure.
    """
    if not validate_address(address):
        return None
    
    contract = _get_usdt_contract()
    if not contract:
        return None
    
    try:
        checksum_address = Web3.to_checksum_address(address)
        balance_raw = contract.functions.balanceOf(checksum_address).call()
        decimals = contract.functions.decimals().call()
        balance_usdt = Decimal(str(balance_raw)) / Decimal(10 ** decimals)
        return balance_usdt
    except Exception:
        return None


def get_wallet_balance(address: str) -> Optional[Dict[str, str]]:
    """
    Fetch both BNB and USDT balance for a wallet address.
    Returns dict with 'bnb', 'usdt', and 'total_usd' keys or None on failure.
    """
    if not validate_address(address):
        return None
    
    bnb_balance = get_bnb_balance(address)
    usdt_balance = get_usdt_balance(address)
    
    if bnb_balance is None and usdt_balance is None:
        return None
    
    bnb = bnb_balance if bnb_balance is not None else Decimal("0")
    usdt = usdt_balance if usdt_balance is not None else Decimal("0")
    
    bnb_price_usd = Decimal("300")
    bnb_value_usd = bnb * bnb_price_usd
    total_usd = usdt + bnb_value_usd
    
    return {
        "bnb": str(bnb),
        "usdt": str(usdt),
        "total_usd": str(total_usd.quantize(Decimal("0.01")))
    }


def _get_bscscan_api_key() -> str:
    """Get BSCScan API key from environment if available."""
    return os.environ.get("BSCSCAN_API_KEY", "")


def get_bnb_transactions(address: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch BNB transaction history from BSCScan API.
    Returns list of transactions or empty list on failure.
    """
    if not validate_address(address):
        return []
    
    try:
        params = {
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": "0",
            "endblock": "99999999",
            "sort": "desc",
            "page": "1",
            "offset": str(limit)
        }
        
        api_key = _get_bscscan_api_key()
        if api_key:
            params["apikey"] = api_key
        
        response = requests.get(BSCSCAN_API_URL, params=params, timeout=10)
        data = response.json()
        
        if data.get("status") == "1" and data.get("result"):
            return data["result"]
        return []
    except Exception:
        return []


def get_token_transactions(address: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch BEP20 token transaction history from BSCScan API.
    Filters for USDT transactions only.
    Returns list of transactions or empty list on failure.
    """
    if not validate_address(address):
        return []
    
    try:
        params = {
            "module": "account",
            "action": "tokentx",
            "address": address,
            "startblock": "0",
            "endblock": "99999999",
            "sort": "desc",
            "page": "1",
            "offset": str(limit)
        }
        
        api_key = _get_bscscan_api_key()
        if api_key:
            params["apikey"] = api_key
        
        response = requests.get(BSCSCAN_API_URL, params=params, timeout=10)
        data = response.json()
        
        if data.get("status") == "1" and data.get("result"):
            usdt_txs = [
                tx for tx in data["result"]
                if tx.get("contractAddress", "").lower() == USDT_CONTRACT_ADDRESS.lower()
            ]
            return usdt_txs
        return []
    except Exception:
        return []


def get_all_transactions(address: str, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch all transactions (BNB + USDT) for a wallet address.
    Returns list of transactions sorted by timestamp (newest first) or empty list on failure.
    """
    if not validate_address(address):
        return []
    
    try:
        bnb_txs = get_bnb_transactions(address, limit)
        token_txs = get_token_transactions(address, limit)
        
        all_txs = bnb_txs + token_txs
        
        all_txs.sort(key=lambda tx: int(tx.get("timeStamp", "0")), reverse=True)
        
        return all_txs[:limit]
    except Exception:
        return []


def format_transaction_for_display(tx: Dict[str, Any], user_address: str) -> Dict[str, Any]:
    """
    Format a BSCScan transaction for frontend display.
    """
    is_token = bool(tx.get("tokenSymbol"))
    is_sent = tx.get("from", "").lower() == user_address.lower()
    
    if is_token:
        decimals = int(tx.get("tokenDecimal", "18"))
        value = Decimal(tx.get("value", "0")) / Decimal(10 ** decimals)
        currency = tx.get("tokenSymbol", "Token")
    else:
        value = Decimal(tx.get("value", "0")) / Decimal(10 ** 18)
        currency = "BNB"
    
    timestamp = int(tx.get("timeStamp", "0"))
    
    return {
        "id": tx.get("hash", ""),
        "transaction_hash": tx.get("hash", ""),
        "type": "send" if is_sent else "receive",
        "amount": str(value),
        "currency": currency,
        "from_address": tx.get("from", ""),
        "to_address": tx.get("to", ""),
        "destination_address": tx.get("to") if is_sent else None,
        "source_address": tx.get("from") if not is_sent else None,
        "status": "success" if tx.get("isError") == "0" else "failed",
        "block_number": tx.get("blockNumber", ""),
        "gas_used": tx.get("gasUsed", ""),
        "gas_price": tx.get("gasPrice", ""),
        "timestamp": timestamp
    }


def is_connected() -> bool:
    """Check if connected to BSC network."""
    web3 = _get_web3()
    return web3 is not None and web3.is_connected()


def get_current_block() -> Optional[int]:
    """Get current block number. Returns None on failure."""
    web3 = _get_web3()
    if not web3:
        return None
    try:
        return web3.eth.block_number
    except Exception:
        return None
