import os
from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
import bcrypt

client = None
db = None

def init_db():
    """Initialize MongoDB connection"""
    global client, db
    
    mongo_uri = os.environ.get('MONGODB_URI')
    if not mongo_uri:
        return None
    
    try:
        client = MongoClient(mongo_uri)
        db = client.usdt_vault
        client.admin.command('ping')
        print("Connected to MongoDB successfully!")
        return db
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return None

def get_db():
    """Get database instance"""
    global db
    if db is None:
        init_db()
    return db

def create_user(username: str, password: str):
    """Create a new user"""
    db = get_db()
    if db is None:
        return None
    
    existing = db.users.find_one({"username": username.lower()})
    if existing:
        return None
    
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    user = {
        "username": username.lower(),
        "password": hashed_password,
        "balance": "0",
        "pin": None,
        "pin_attempts": 0,
        "linked_wallet_address": None,
        "created_at": datetime.utcnow()
    }
    
    result = db.users.insert_one(user)
    user["_id"] = result.inserted_id
    return user

def authenticate_user(username: str, password: str):
    """Authenticate a user"""
    db = get_db()
    if db is None:
        return None
    
    user = db.users.find_one({"username": username.lower()})
    if not user:
        return None
    
    if bcrypt.checkpw(password.encode('utf-8'), user["password"]):
        return user
    return None

def get_user_by_id(user_id: str):
    """Get user by ID"""
    db = get_db()
    if db is None:
        return None
    return db.users.find_one({"_id": ObjectId(user_id)})

def get_user_by_username(username: str):
    """Get user by username (public info only)"""
    db = get_db()
    if db is None:
        return None
    user = db.users.find_one({"username": username.lower()})
    if user:
        return {
            "username": user["username"],
            "linked_wallet_address": user.get("linked_wallet_address"),
            "created_at": user.get("created_at")
        }
    return None

def update_user_balance(user_id: str, new_balance: str):
    """Update user balance"""
    db = get_db()
    if db is None:
        return False
    
    result = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"balance": new_balance}}
    )
    return result.modified_count > 0

def update_user_pin(user_id: str, pin: str):
    """Update user PIN"""
    db = get_db()
    if db is None:
        return False
    
    hashed_pin = bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt())
    result = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"pin": hashed_pin}}
    )
    return result.modified_count > 0

def verify_user_pin(user_id: str, pin: str):
    """Verify user PIN with attempt throttling"""
    db = get_db()
    if db is None:
        return False
    
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("pin"):
        return False
    
    pin_attempts = user.get("pin_attempts", 0)
    if pin_attempts >= 5:
        return False
    
    if bcrypt.checkpw(pin.encode('utf-8'), user["pin"]):
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"pin_attempts": 0}}
        )
        return True
    else:
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"pin_attempts": 1}}
        )
        return False

def reset_pin_attempts(user_id: str):
    """Reset PIN attempt counter"""
    db = get_db()
    if db is None:
        return False
    
    result = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"pin_attempts": 0}}
    )
    return result.modified_count > 0

def get_pin_attempts(user_id: str):
    """Get current PIN attempt count"""
    db = get_db()
    if db is None:
        return 0
    
    user = db.users.find_one({"_id": ObjectId(user_id)})
    return user.get("pin_attempts", 0) if user else 0

def user_has_pin(user_id: str):
    """Check if user has a PIN set"""
    db = get_db()
    if db is None:
        return False
    
    user = db.users.find_one({"_id": ObjectId(user_id)})
    return user is not None and user.get("pin") is not None

def create_transaction(user_id: str, tx_type: str, amount: str, address: str, status: str = "completed"):
    """Create a new transaction"""
    db = get_db()
    if db is None:
        return None
    
    transaction = {
        "user_id": user_id,
        "type": tx_type,
        "amount": amount,
        "address": address,
        "status": status,
        "created_at": datetime.utcnow()
    }
    
    result = db.transactions.insert_one(transaction)
    transaction["_id"] = result.inserted_id
    return transaction

def get_user_transactions(user_id: str, limit: int = 50):
    """Get user transactions"""
    db = get_db()
    if db is None:
        return []
    
    return list(db.transactions.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit))

def create_savings_goal(user_id: str, title: str, target: str, deadline: datetime):
    """Create a new savings goal"""
    db = get_db()
    if db is None:
        return None
    
    goal = {
        "user_id": user_id,
        "title": title,
        "current": "0",
        "target": target,
        "deadline": deadline,
        "auto_save_enabled": False,
        "auto_save_amount": None,
        "auto_save_frequency": None,
        "saving_streak": "0",
        "created_at": datetime.utcnow()
    }
    
    result = db.savings_goals.insert_one(goal)
    goal["_id"] = result.inserted_id
    return goal

def get_user_savings_goals(user_id: str):
    """Get user savings goals"""
    db = get_db()
    if db is None:
        return []
    
    return list(db.savings_goals.find({"user_id": user_id}).sort("created_at", -1))

def update_savings_goal(goal_id: str, updates: dict):
    """Update a savings goal"""
    db = get_db()
    if db is None:
        return False
    
    result = db.savings_goals.update_one(
        {"_id": ObjectId(goal_id)},
        {"$set": updates}
    )
    return result.modified_count > 0

def delete_savings_goal(goal_id: str):
    """Delete a savings goal"""
    db = get_db()
    if db is None:
        return False
    
    result = db.savings_goals.delete_one({"_id": ObjectId(goal_id)})
    return result.deleted_count > 0

def create_investment_plan(user_id: str, name: str, amount: str, frequency: str, next_contribution: datetime):
    """Create a new investment plan"""
    db = get_db()
    if db is None:
        return None
    
    plan = {
        "user_id": user_id,
        "name": name,
        "amount": amount,
        "frequency": frequency,
        "next_contribution": next_contribution,
        "auto_invest": False,
        "created_at": datetime.utcnow()
    }
    
    result = db.investment_plans.insert_one(plan)
    plan["_id"] = result.inserted_id
    return plan

def get_user_investment_plans(user_id: str):
    """Get user investment plans"""
    db = get_db()
    if db is None:
        return []
    
    return list(db.investment_plans.find({"user_id": user_id}).sort("created_at", -1))

def update_investment_plan(plan_id: str, updates: dict):
    """Update an investment plan"""
    db = get_db()
    if db is None:
        return False
    
    result = db.investment_plans.update_one(
        {"_id": ObjectId(plan_id)},
        {"$set": updates}
    )
    return result.modified_count > 0

def delete_investment_plan(plan_id: str):
    """Delete an investment plan"""
    db = get_db()
    if db is None:
        return False
    
    result = db.investment_plans.delete_one({"_id": ObjectId(plan_id)})
    return result.deleted_count > 0

def update_user_wallet_address(user_id: str, wallet_address: str | None):
    """Update user's linked BSC wallet address (public address for balance viewing)"""
    db = get_db()
    if db is None:
        return False
    
    result = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"linked_wallet_address": wallet_address if wallet_address else None}}
    )
    return result.modified_count > 0 or result.matched_count > 0

