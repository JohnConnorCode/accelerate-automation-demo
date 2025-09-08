-- Clean out all old low-quality data
DELETE FROM content_curated WHERE score < 30 OR score IS NULL;

-- Show what's left
SELECT COUNT(*) as total, AVG(score) as avg_score FROM content_curated;
