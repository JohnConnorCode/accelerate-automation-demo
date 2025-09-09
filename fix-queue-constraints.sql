-- ============================================================
-- FIX QUEUE TABLE CONSTRAINTS 
-- Remove blocking constraints from queue_* tables
-- ============================================================

-- 1. Fix queue_projects constraints
-- Remove description length check (50+ chars requirement)
ALTER TABLE queue_projects DROP CONSTRAINT IF EXISTS queue_projects_description_check;
-- Make description nullable to allow empty descriptions
ALTER TABLE queue_projects ALTER COLUMN description DROP NOT NULL;
-- Remove status enum constraint to allow flexible status values
ALTER TABLE queue_projects DROP CONSTRAINT IF EXISTS queue_projects_status_check;

-- 2. Fix queue_funding_programs constraints  
-- Remove description length check
ALTER TABLE queue_funding_programs DROP CONSTRAINT IF EXISTS queue_funding_programs_description_check;
-- Make description nullable
ALTER TABLE queue_funding_programs ALTER COLUMN description DROP NOT NULL;
-- Remove funding_type enum constraint
ALTER TABLE queue_funding_programs DROP CONSTRAINT IF EXISTS queue_funding_programs_funding_type_check;
-- Remove status enum constraint
ALTER TABLE queue_funding_programs DROP CONSTRAINT IF EXISTS queue_funding_programs_status_check;

-- 3. Fix queue_resources constraints
-- Remove description length check
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_description_check;
-- Make description nullable
ALTER TABLE queue_resources ALTER COLUMN description DROP NOT NULL;
-- Remove resource_type enum constraint
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_resource_type_check;
-- Remove price_type enum constraint
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_price_type_check;
-- Remove difficulty_level enum constraint
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_difficulty_level_check;
-- Remove status enum constraint
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_status_check;

-- 4. Test insertions to verify fixes work
INSERT INTO queue_projects (name, description, source, status)
VALUES ('Test Project', 'Test', 'constraint-fix-test', 'pending_review');

INSERT INTO queue_funding_programs (name, organization, description, source, status)
VALUES ('Test Grant', 'Test Org', 'Test', 'constraint-fix-test', 'pending_review');

INSERT INTO queue_resources (title, description, url, source, status)
VALUES ('Test Resource', 'Test', 'https://test-constraint-fix-' || extract(epoch from now()) || '.com', 'constraint-fix-test', 'pending_review');

-- 5. Verify it worked
SELECT 'queue_projects' as table_name, COUNT(*) as count FROM queue_projects
UNION ALL
SELECT 'queue_funding_programs', COUNT(*) FROM queue_funding_programs
UNION ALL
SELECT 'queue_resources', COUNT(*) FROM queue_resources;

-- 6. Clean up test data
DELETE FROM queue_projects WHERE source = 'constraint-fix-test';
DELETE FROM queue_funding_programs WHERE source = 'constraint-fix-test';
DELETE FROM queue_resources WHERE source = 'constraint-fix-test';

-- 7. Final confirmation
SELECT '✅ QUEUE TABLE CONSTRAINTS FIXED! Tables ready for data insertion.' as message;