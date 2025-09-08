-- WARNING: This will delete all data from content_curated table
-- Only do this in development!

DELETE FROM content_curated;

SELECT COUNT(*) as remaining FROM content_curated;
