-- BE HONEST: Delete ALL test garbage
DELETE FROM content_curated WHERE score < 40 OR score IS NULL;

-- Show what remains
SELECT COUNT(*) as remaining, AVG(score) as avg_score FROM content_curated;
