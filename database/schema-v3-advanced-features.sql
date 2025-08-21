-- Advanced Features Database Schema V3
-- Adds support for Web3 crawling, smart contracts, project tracking, and funding

-- Smart contract events table
CREATE TABLE IF NOT EXISTS smart_contract_events (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(255) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  network VARCHAR(50) NOT NULL,
  args JSONB,
  decoded_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contract_events_address (contract_address),
  INDEX idx_contract_events_network (network),
  INDEX idx_contract_events_timestamp (timestamp DESC)
);

-- Contract insights table
CREATE TABLE IF NOT EXISTS contract_insights (
  id SERIAL PRIMARY KEY,
  insight_type VARCHAR(100),
  network VARCHAR(50),
  metrics JSONB,
  severity VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project metrics table
CREATE TABLE IF NOT EXISTS project_metrics (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  owner VARCHAR(255) NOT NULL,
  repo VARCHAR(255) NOT NULL,
  url TEXT,
  metrics JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_project (platform, owner, repo),
  INDEX idx_project_platform (platform),
  INDEX idx_project_updated (updated_at DESC)
);

-- Developer profiles table
CREATE TABLE IF NOT EXISTS developer_profiles (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  profile_data JSONB NOT NULL,
  activity_level VARCHAR(20),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_developer (platform, username),
  INDEX idx_developer_activity (activity_level),
  INDEX idx_developer_updated (updated_at DESC)
);

-- Funding rounds table
CREATE TABLE IF NOT EXISTS funding_rounds (
  id SERIAL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  round VARCHAR(50) NOT NULL,
  amount DECIMAL(15, 2),
  currency VARCHAR(10),
  date DATE,
  investors JSONB,
  valuation DECIMAL(15, 2),
  category TEXT[],
  blockchain TEXT[],
  source VARCHAR(255),
  verified BOOLEAN DEFAULT false,
  tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_funding_company (company),
  INDEX idx_funding_round (round),
  INDEX idx_funding_date (date DESC),
  INDEX idx_funding_amount (amount DESC)
);

-- Funding matches table
CREATE TABLE IF NOT EXISTS funding_matches (
  id SERIAL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  opportunity_id VARCHAR(255) NOT NULL,
  opportunity_type VARCHAR(50),
  match_score INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_matches_company (company),
  INDEX idx_matches_opportunity (opportunity_id),
  INDEX idx_matches_score (match_score DESC)
);

-- Web3 builder data table
CREATE TABLE IF NOT EXISTS web3_builders (
  id SERIAL PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  project_category VARCHAR(50),
  blockchain TEXT[],
  github_repo TEXT,
  founders JSONB,
  funding_rounds JSONB,
  github_stats JSONB,
  social_metrics JSONB,
  on_chain_metrics JSONB,
  community_metrics JSONB,
  builder_score DECIMAL(5, 2),
  innovation_score DECIMAL(5, 2),
  execution_score DECIMAL(5, 2),
  community_score DECIMAL(5, 2),
  overall_score DECIMAL(5, 2),
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_project_name (project_name),
  INDEX idx_builders_category (project_category),
  INDEX idx_builders_score (overall_score DESC),
  INDEX idx_builders_activity (last_activity DESC)
);

-- Accelerate builder profiles table
CREATE TABLE IF NOT EXISTS accelerate_builder_profiles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  builder_type VARCHAR(50),
  experience_level VARCHAR(50),
  skills TEXT[],
  interests TEXT[],
  blockchain_experience TEXT[],
  portfolio_projects JSONB,
  social_profiles JSONB,
  achievements JSONB,
  accelerate_score DECIMAL(5, 2),
  match_score DECIMAL(5, 2),
  readiness_level VARCHAR(50),
  funding_needs JSONB,
  resource_needs JSONB,
  verification_status VARCHAR(50) DEFAULT 'unverified',
  last_active TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_accelerate_type (builder_type),
  INDEX idx_accelerate_level (experience_level),
  INDEX idx_accelerate_score (accelerate_score DESC),
  INDEX idx_accelerate_readiness (readiness_level)
);

-- Funding opportunities table
CREATE TABLE IF NOT EXISTS funding_opportunities (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  opportunity_type VARCHAR(50),
  stage_focus TEXT[],
  amount_min DECIMAL(15, 2),
  amount_max DECIMAL(15, 2),
  currency VARCHAR(10),
  sectors TEXT[],
  blockchain_focus TEXT[],
  geographic_focus TEXT[],
  application_deadline DATE,
  requirements JSONB,
  application_url TEXT,
  success_rate DECIMAL(5, 2),
  average_decision_time INTEGER,
  portfolio_companies JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opportunities_type (opportunity_type),
  INDEX idx_opportunities_deadline (application_deadline),
  INDEX idx_opportunities_active (is_active)
);

-- Builder resources table
CREATE TABLE IF NOT EXISTS builder_resources (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50),
  category VARCHAR(100),
  description TEXT,
  url TEXT,
  provider VARCHAR(255),
  target_audience TEXT[],
  skill_level VARCHAR(50),
  duration VARCHAR(50),
  cost DECIMAL(10, 2),
  currency VARCHAR(10),
  rating DECIMAL(3, 2),
  reviews_count INTEGER,
  tags TEXT[],
  prerequisites TEXT[],
  outcomes TEXT[],
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resources_type (resource_type),
  INDEX idx_resources_category (category),
  INDEX idx_resources_level (skill_level),
  INDEX idx_resources_rating (rating DESC)
);

-- Ecosystem events table (hackathons, conferences, etc.)
CREATE TABLE IF NOT EXISTS ecosystem_events (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  event_type VARCHAR(50),
  organizer VARCHAR(255),
  start_date DATE,
  end_date DATE,
  location VARCHAR(255),
  is_virtual BOOLEAN DEFAULT false,
  prize_pool DECIMAL(15, 2),
  currency VARCHAR(10),
  categories TEXT[],
  blockchain_focus TEXT[],
  registration_url TEXT,
  registration_deadline DATE,
  expected_participants INTEGER,
  past_winners JSONB,
  sponsors JSONB,
  judges JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_type (event_type),
  INDEX idx_events_date (start_date),
  INDEX idx_events_deadline (registration_deadline)
);

-- Community metrics table
CREATE TABLE IF NOT EXISTS community_metrics (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  community_id VARCHAR(255) NOT NULL,
  community_name VARCHAR(255),
  member_count INTEGER,
  active_members INTEGER,
  messages_per_day DECIMAL(10, 2),
  engagement_rate DECIMAL(5, 2),
  sentiment_score DECIMAL(3, 2),
  top_topics TEXT[],
  top_contributors JSONB,
  growth_rate DECIMAL(5, 2),
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_community (platform, community_id, measured_at),
  INDEX idx_community_platform (platform),
  INDEX idx_community_engagement (engagement_rate DESC)
);

-- Partnership tracker table
CREATE TABLE IF NOT EXISTS partnerships (
  id SERIAL PRIMARY KEY,
  partner1 VARCHAR(255) NOT NULL,
  partner2 VARCHAR(255) NOT NULL,
  partnership_type VARCHAR(50),
  announcement_date DATE,
  description TEXT,
  objectives TEXT[],
  blockchain TEXT[],
  status VARCHAR(50) DEFAULT 'active',
  impact_metrics JSONB,
  source_url TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partnerships_partners (partner1, partner2),
  INDEX idx_partnerships_type (partnership_type),
  INDEX idx_partnerships_date (announcement_date DESC)
);

-- Grant recipients table
CREATE TABLE IF NOT EXISTS grant_recipients (
  id SERIAL PRIMARY KEY,
  grant_program VARCHAR(255) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2),
  currency VARCHAR(10),
  award_date DATE,
  category VARCHAR(100),
  project_description TEXT,
  milestones JSONB,
  completion_status VARCHAR(50),
  impact_metrics JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipients_program (grant_program),
  INDEX idx_recipients_recipient (recipient),
  INDEX idx_recipients_date (award_date DESC)
);

-- Create materialized views for analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS builder_rankings AS
SELECT 
  bp.id,
  bp.name,
  bp.builder_type,
  bp.experience_level,
  bp.accelerate_score,
  wb.overall_score as web3_score,
  COUNT(DISTINCT fr.id) as funding_rounds_count,
  SUM(fr.amount) as total_funding_raised,
  COUNT(DISTINCT gr.id) as grants_received,
  AVG(cm.engagement_rate) as avg_community_engagement
FROM accelerate_builder_profiles bp
LEFT JOIN web3_builders wb ON bp.name = wb.project_name
LEFT JOIN funding_rounds fr ON bp.name = fr.company
LEFT JOIN grant_recipients gr ON bp.name = gr.recipient
LEFT JOIN community_metrics cm ON bp.name = cm.community_name
GROUP BY bp.id, bp.name, bp.builder_type, bp.experience_level, bp.accelerate_score, wb.overall_score
ORDER BY bp.accelerate_score DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS funding_trends AS
SELECT 
  DATE_TRUNC('month', date) as month,
  round,
  COUNT(*) as deal_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  array_agg(DISTINCT blockchain) as blockchains,
  array_agg(DISTINCT category) as categories
FROM funding_rounds
WHERE date >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', date), round
ORDER BY month DESC, deal_count DESC;

-- Create indexes for materialized views
CREATE INDEX idx_builder_rankings_score ON builder_rankings(accelerate_score DESC);
CREATE INDEX idx_funding_trends_month ON funding_trends(month DESC);

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY builder_rankings;
  REFRESH MATERIALIZED VIEW CONCURRENTLY funding_trends;
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-views', '0 */6 * * *', 'SELECT refresh_materialized_views();');

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;