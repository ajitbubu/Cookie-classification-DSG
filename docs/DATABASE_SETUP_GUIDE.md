# Database Setup Guide

Complete guide for setting up PostgreSQL and loading vendor patterns for the DCS cookie classification system.

## Current Status

🔴 **PostgreSQL is not currently running on your system**

```
✅ Database credentials configured (.env file)
✅ Vendor patterns ready (data/vendor_patterns.json)
✅ SQL migrations ready (backend/db/migrations/)
❌ PostgreSQL not installed/running
```

---

## Option 1: Install PostgreSQL (Recommended)

### macOS Installation

#### Using Homebrew (Recommended)

```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Or start manually
pg_ctl -D /usr/local/var/postgresql@14 start

# Verify it's running
pg_isready
```

#### Using Postgres.app (Alternative - GUI)

1. Download from: https://postgresapp.com/
2. Move to Applications folder
3. Launch Postgres.app
4. Click "Initialize" to create a new server
5. PostgreSQL will run whenever Postgres.app is open

### Linux Installation

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows Installation

1. Download installer from: https://www.postgresql.org/download/windows/
2. Run installer and follow wizard
3. Set password for postgres user
4. PostgreSQL will start as a Windows service

---

## Option 2: Use Docker (Quick Setup)

```bash
# Run PostgreSQL in Docker
docker run --name cookie-scanner-db \
  -e POSTGRES_USER=scanner \
  -e POSTGRES_PASSWORD=scanner_password \
  -e POSTGRES_DB=cookie_scanner \
  -p 5432:5432 \
  -d postgres:14

# Verify it's running
docker ps | grep cookie-scanner-db

# Stop
docker stop cookie-scanner-db

# Start again
docker start cookie-scanner-db
```

---

## Step-by-Step Database Setup

### Step 1: Create Database and User

After PostgreSQL is running:

```bash
# Access PostgreSQL
psql postgres

# Create user
CREATE USER scanner WITH PASSWORD 'scanner_password';

# Create database
CREATE DATABASE cookie_scanner OWNER scanner;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE cookie_scanner TO scanner;

# Exit
\q
```

**Or using Docker:**
```bash
# The Docker command above already creates the database and user
# Skip this step if using Docker
```

### Step 2: Test Connection

```bash
# Test with Python script
python3 scripts/test_db_connection.py
```

Expected output:
```
======================================================================
Database Connection Test
======================================================================

Connection Details:
  Host: localhost
  Port: 5432
  Database: cookie_scanner
  User: scanner

Testing connection...
✅ Connection successful!

Checking vendor_database table...
⚠️  vendor_database table does not exist
   You need to run the schema migration first
```

### Step 3: Run Schema Migration

```bash
# Run the ML classification schema migration
psql -U scanner -d cookie_scanner -f backend/db/migrations/001_ml_classification_schema.sql
```

**Or using Python:**
```python
import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='cookie_scanner',
    user='scanner',
    password='scanner_password'
)

with open('backend/db/migrations/001_ml_classification_schema.sql', 'r') as f:
    cursor = conn.cursor()
    cursor.execute(f.read())
    conn.commit()
    cursor.close()

conn.close()
print("✅ Schema migration complete!")
```

### Step 4: Load Vendor Patterns

#### Option A: From JSON file (Recommended)

```bash
# Load all 20 vendor patterns
python3 scripts/load_vendor_patterns.py

# Dry run (preview only)
python3 scripts/load_vendor_patterns.py --dry-run
```

#### Option B: From SQL migration

```bash
psql -U scanner -d cookie_scanner -f backend/db/migrations/002_add_vendor_patterns.sql
```

#### Option C: Using Python script interactively

```bash
python3 scripts/add_vendor_patterns.py
# Choose option 5 to bulk add common vendors
```

### Step 5: Verify Vendor Patterns

```bash
# Test connection and list vendors
python3 scripts/test_db_connection.py
```

Expected output:
```
✅ Connection successful!

✅ vendor_database table exists
   Current vendors: 20

Existing Vendors:
  - Adobe Analytics: Analytics (0.93)
  - Amazon Web Services: Functional (0.90)
  - Cloudflare: Strictly Necessary (0.96)
  - Facebook: Marketing (0.95)
  - Google Ads: Marketing (0.95)
  - Google LLC: Analytics (0.95)
  - Hotjar: Analytics (0.95)
  - HubSpot: Marketing (0.95)
  - IAB TCF: Strictly Necessary (0.98)
  - Intercom: Functional (0.94)
  - LinkedIn Corporation: Analytics (0.93)
  - Microsoft Corporation: Analytics (0.92)
  - PayPal: Strictly Necessary (0.92)
  - Salesforce Pardot: Marketing (0.92)
  - Segment: Analytics (0.90)
  - Shopify: Functional (0.93)
  - Stripe: Strictly Necessary (0.95)
  - Twitter: Marketing (0.93)
  - Vimeo: Functional (0.91)
  - YouTube: Functional (0.94)

======================================================================
✅ Database is ready for vendor patterns!
======================================================================
```

---

## Troubleshooting

### "Connection refused" Error

**Problem:**
```
connection to server at "localhost", port 5432 failed: Connection refused
```

**Solutions:**

1. **Check if PostgreSQL is running:**
   ```bash
   # macOS with Homebrew
   brew services list | grep postgresql

   # Linux
   sudo systemctl status postgresql

   # Docker
   docker ps | grep postgres
   ```

2. **Start PostgreSQL:**
   ```bash
   # macOS with Homebrew
   brew services start postgresql@14

   # Linux
   sudo systemctl start postgresql

   # Docker
   docker start cookie-scanner-db
   ```

3. **Check port availability:**
   ```bash
   lsof -i :5432
   # If another service is using port 5432, change DB_PORT in .env
   ```

### "Database does not exist" Error

**Problem:**
```
FATAL: database "cookie_scanner" does not exist
```

**Solution:**
```bash
# Create the database
createdb -U scanner cookie_scanner

# Or with psql
psql -U postgres -c "CREATE DATABASE cookie_scanner OWNER scanner;"
```

### "Password authentication failed" Error

**Problem:**
```
FATAL: password authentication failed for user "scanner"
```

**Solutions:**

1. **Update .env file** with correct credentials
2. **Reset user password:**
   ```sql
   psql postgres
   ALTER USER scanner WITH PASSWORD 'scanner_password';
   \q
   ```
3. **Check pg_hba.conf** (PostgreSQL authentication config):
   ```bash
   # Location varies by OS
   # macOS: /usr/local/var/postgresql@14/pg_hba.conf
   # Linux: /etc/postgresql/14/main/pg_hba.conf

   # Change method from 'peer' to 'md5' for local connections
   local   all             all                                     md5
   ```

### "Table vendor_database does not exist" Error

**Problem:**
```
relation "vendor_database" does not exist
```

**Solution:**
```bash
# Run the schema migration
psql -U scanner -d cookie_scanner -f backend/db/migrations/001_ml_classification_schema.sql
```

---

## Alternative: Using Existing Database

If you already have a PostgreSQL database running elsewhere (e.g., AWS RDS, Heroku, Supabase):

### Step 1: Update .env

```env
DB_HOST=your-database-host.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# For SSL connections (common with cloud databases)
DB_SSLMODE=require
```

### Step 2: Test Connection

```bash
python3 scripts/test_db_connection.py
```

### Step 3: Run Migrations

```bash
# If you have psql CLI access
psql -h your-host.com -U your_user -d your_db -f backend/db/migrations/001_ml_classification_schema.sql

# Or use the Python script
python3 scripts/load_vendor_patterns.py
```

---

## What's Next?

After database is set up:

1. ✅ **Verify vendor patterns loaded:**
   ```bash
   python3 scripts/test_db_connection.py
   ```

2. ✅ **Test vendor matching:**
   ```python
   from scripts.add_vendor_patterns import VendorManager
   manager = VendorManager()
   matches = manager.search_vendor('_ga', 'google-analytics.com')
   print(matches)
   ```

3. ✅ **Train ML model with vendor features:**
   ```bash
   python3 -m backend.api.ml_classifier.training.train_model
   ```

4. ✅ **Start using classification API:**
   ```bash
   # Start backend server
   python3 backend/api/app.py

   # Test classification with vendor detection
   curl -X POST http://localhost:8000/api/v1/ml/classify \
     -H "Content-Type: application/json" \
     -d '{"cookies": [{"name": "_ga", "domain": ".google.com"}]}'
   ```

---

## Quick Reference

### Start PostgreSQL
```bash
# Homebrew
brew services start postgresql@14

# Linux
sudo systemctl start postgresql

# Docker
docker start cookie-scanner-db
```

### Stop PostgreSQL
```bash
# Homebrew
brew services stop postgresql@14

# Linux
sudo systemctl stop postgresql

# Docker
docker stop cookie-scanner-db
```

### Access Database
```bash
# CLI
psql -U scanner -d cookie_scanner

# List tables
\dt

# Describe vendor_database table
\d vendor_database

# Query vendors
SELECT vendor_name, typical_category FROM vendor_database ORDER BY vendor_name;

# Exit
\q
```

### Backup & Restore
```bash
# Backup
pg_dump -U scanner cookie_scanner > backup.sql

# Restore
psql -U scanner -d cookie_scanner < backup.sql
```

---

## Resources

- **PostgreSQL Official Docs:** https://www.postgresql.org/docs/
- **Homebrew PostgreSQL:** https://formulae.brew.sh/formula/postgresql@14
- **Postgres.app:** https://postgresapp.com/
- **Docker PostgreSQL:** https://hub.docker.com/_/postgres
- **psycopg2 Docs:** https://www.psycopg.org/docs/

---

**Last Updated:** 2025-11-26
