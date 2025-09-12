# URGENT: Database Schema Mismatch

## THE PROBLEM
The code expects tables (`queue_projects`, `queue_investors`, `queue_news`) that either:
1. Don't exist in your Supabase database, OR
2. Exist but with different column names

## THE SOLUTION

### Option 1: If Tables DON'T Exist
Execute this SQL in Supabase dashboard (https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor):

```sql
-- Copy everything from: database/create-queue-tables.sql
```

### Option 2: If Tables DO Exist (but with wrong columns)
The error "Could not find the 'score' column" suggests tables exist but are missing columns.

Check what columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'queue_projects';
```

Then add missing columns:
```sql
-- Add missing columns to existing tables
ALTER TABLE queue_projects ADD COLUMN IF NOT EXISTS score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE queue_investors ADD COLUMN IF NOT EXISTS score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE queue_news ADD COLUMN IF NOT EXISTS score DECIMAL(3,2) DEFAULT 0;
```

## HOW TO EXECUTE

Since MCP/API access is blocked without proper credentials:

1. **Go to Supabase SQL Editor**:
   https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor

2. **First, check if tables exist**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'queue_%';
   ```

3. **If NO tables returned**: 
   - Copy ALL content from `database/create-queue-tables.sql`
   - Paste and Run

4. **If tables exist but columns are wrong**:
   - Run the ALTER TABLE commands above

## VERIFICATION

After fixing, verify with:
```sql
-- Should return 3 rows
SELECT table_name, COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('queue_projects', 'queue_investors', 'queue_news')
GROUP BY table_name;
```

## WHY THIS HAPPENED

The codebase was updated to use separate queue tables, but the database schema wasn't migrated. This is a classic schema drift issue.

## CRITICAL COLUMNS NEEDED

Each queue table MUST have:
- `id` (UUID)
- `url` (TEXT, UNIQUE)
- `title` (TEXT)
- `description` (TEXT)
- `source` (TEXT)
- `score` (DECIMAL) ← Missing!
- `status` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

Without these, the staging service CANNOT work.