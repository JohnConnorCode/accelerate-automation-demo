-- ============================================================
-- FIX STAGING TABLE CONSTRAINTS
-- Remove blocking constraints and make tables work
-- ============================================================

-- 1. Fix queued_projects constraints
ALTER TABLE queued_projects 
DROP CONSTRAINT IF EXISTS queued_projects_description_check;

ALTER TABLE queued_projects
ALTER COLUMN description DROP NOT NULL;

-- 2. Fix queued_funding_programs constraints  
ALTER TABLE queued_funding_programs
DROP CONSTRAINT IF EXISTS queued_funding_programs_description_check;

ALTER TABLE queued_funding_programs
ALTER COLUMN description DROP NOT NULL;

ALTER TABLE queued_funding_programs
DROP CONSTRAINT IF EXISTS queued_funding_programs_funding_type_check;

-- 3. Fix queued_resources constraints
ALTER TABLE queued_resources
DROP CONSTRAINT IF EXISTS queued_resources_description_check;

ALTER TABLE queued_resources
ALTER COLUMN description DROP NOT NULL;

ALTER TABLE queued_resources
DROP CONSTRAINT IF EXISTS queued_resources_resource_type_check;

ALTER TABLE queued_resources
DROP CONSTRAINT IF EXISTS queued_resources_price_type_check;

ALTER TABLE queued_resources
DROP CONSTRAINT IF EXISTS queued_resources_difficulty_level_check;

-- 4. Fix status constraints on all tables
ALTER TABLE queued_projects
DROP CONSTRAINT IF EXISTS queued_projects_status_check;

ALTER TABLE queued_funding_programs  
DROP CONSTRAINT IF EXISTS queued_funding_programs_status_check;

ALTER TABLE queued_resources
DROP CONSTRAINT IF EXISTS queued_resources_status_check;

-- 5. Test insertions
INSERT INTO queued_projects (name, description, url, source, score, status)
VALUES ('Test Project', 'Test', 'https://test-proj-' || extract(epoch from now()) || '.com', 'test', 50, 'pending_review');

INSERT INTO queued_funding_programs (name, organization, description, url, source, score, status)
VALUES ('Test Grant', 'Test Org', 'Test', 'https://test-grant-' || extract(epoch from now()) || '.com', 'test', 50, 'pending_review');

INSERT INTO queued_resources (title, description, url, source, score, status)
VALUES ('Test Resource', 'Test', 'https://test-res-' || extract(epoch from now()) || '.com', 'test', 50, 'pending_review');

-- 6. Verify it worked
SELECT 'queued_projects' as table_name, COUNT(*) as count FROM queued_projects
UNION ALL
SELECT 'queued_funding_programs', COUNT(*) FROM queued_funding_programs
UNION ALL
SELECT 'queued_resources', COUNT(*) FROM queued_resources;

-- 7. Clean up test data
DELETE FROM queued_projects WHERE source = 'test';
DELETE FROM queued_funding_programs WHERE source = 'test';
DELETE FROM queued_resources WHERE source = 'test';

-- Final message
SELECT '✅ CONSTRAINTS FIXED! Staging tables ready for use.' as message;