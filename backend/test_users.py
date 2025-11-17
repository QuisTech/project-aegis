import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app import app, db, User
    with app.app_context():
        users = User.query.all()
        print("=== Registered Users ===")
        for user in users:
            print(f"Username: {user.username}, Role: {user.role}")
        if not users:
            print("No users found in database")
except Exception as e:
    print(f"Error: {e}")
    print("Trying to find user configuration...")
    
    # Look for hardcoded users
    with open('app.py', 'r') as f:
        content = f.read()
        if 'admin' in content.lower():
            print("Found 'admin' reference in app.py")
        if 'user' in content.lower():
            print("Found 'user' reference in app.py")
