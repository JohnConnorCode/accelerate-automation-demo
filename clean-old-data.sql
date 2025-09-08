-- Clean old news data from content_queue and content_curated
DELETE FROM content_queue WHERE type = 'news' OR source LIKE '%hackernews%' OR source LIKE '%github%trending%';
DELETE FROM content_curated WHERE type = 'news' OR source LIKE '%hackernews%' OR source LIKE '%github%trending%';

-- Show counts after cleanup
SELECT 'content_queue' as table_name, COUNT(*) as count FROM content_queue
UNION ALL
SELECT 'content_curated', COUNT(*) FROM content_curated
UNION ALL  
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'funding_programs', COUNT(*) FROM funding_programs
UNION ALL
SELECT 'resources', COUNT(*) FROM resources;
