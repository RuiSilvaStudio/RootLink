#!/usr/bin/env python3
"""
Reset admin password or create new admin user.
Run this on the production server or locally.

Usage:
    python reset_admin.py --email admin@example.com --password newpassword
    python reset_admin.py --create --email newadmin@example.com --name "Admin Name" --password newpassword
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "rootlink" / "backend"))

from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User, UserRole


async def reset_password(email: str, new_password: str):
    """Reset password for existing user and make them admin."""
    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"❌ User with email '{email}' not found.")
            print("Available users:")
            all_users = await db.execute(select(User))
            for u in all_users.scalars().all():
                print(f"  - {u.email} (role: {u.role})")
            return False
        
        user.password_hash = hash_password(new_password)
        user.role = UserRole.admin
        await db.commit()
        print(f"✅ Password reset for {email}")
        print(f"✅ Role set to: admin")
        return True


async def create_admin(email: str, name: str, password: str):
    """Create a new admin user."""
    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"❌ User with email '{email}' already exists.")
            return False
        
        user = User(
            email=email,
            name=name,
            password_hash=hash_password(password),
            role=UserRole.admin,
            account_type="individual",
        )
        db.add(user)
        await db.commit()
        print(f"✅ Created admin user: {email}")
        print(f"   Name: {name}")
        print(f"   Role: admin")
        return True


async def list_users():
    """List all users in the database."""
    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        if not users:
            print("❌ No users found in database.")
            return
        
        print(f"Found {len(users)} user(s):")
        for u in users:
            print(f"  - {u.email} (role: {u.role}, name: {u.name})")


async def main():
    parser = argparse.ArgumentParser(description="Admin user management")
    parser.add_argument("--email", help="User email")
    parser.add_argument("--password", help="New password")
    parser.add_argument("--name", help="User name (for create)")
    parser.add_argument("--create", action="store_true", help="Create new admin user")
    parser.add_argument("--reset", action="store_true", help="Reset existing user password")
    parser.add_argument("--list", action="store_true", help="List all users")
    
    args = parser.parse_args()
    
    if args.list:
        await list_users()
    elif args.create:
        if not all([args.email, args.name, args.password]):
            print("❌ --create requires --email, --name, and --password")
            sys.exit(1)
        success = await create_admin(args.email, args.name, args.password)
        sys.exit(0 if success else 1)
    elif args.reset:
        if not all([args.email, args.password]):
            print("❌ --reset requires --email and --password")
            sys.exit(1)
        success = await reset_password(args.email, args.password)
        sys.exit(0 if success else 1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
