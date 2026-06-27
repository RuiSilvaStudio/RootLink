# Operational Scripts

Utility scripts for RootLink ops. Not part of the deployed app.

## reset_admin.py

Create or reset an admin user directly in the database. Run on the production
server (inside the backend container) or locally.

```bash
# List all users
python scripts/reset_admin.py --list

# Reset an existing user's password and promote to admin
python scripts/reset_admin.py --reset --email you@example.com --password 'newpass'

# Create a new admin user
python scripts/reset_admin.py --create --email admin@example.com --name "Admin" --password 'pass'
```

On the production server, run it inside the backend container so it uses the
production database (see DEPLOY.md):

```bash
docker compose -f docker-compose.prod.yml exec backend python -c "..."
```
