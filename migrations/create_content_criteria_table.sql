-- Create admin-editable content criteria table
CREATE TABLE IF NOT EXISTS content_criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('project', 'funding', 'resource')),
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN DEFAULT true,
  
  -- JSON fields for dynamic configuration
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  scoring_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  enrichment_priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  
  -- Ensure only one active version per type
  CONSTRAINT unique_active_type UNIQUE (type, active) WHERE active = true
);

-- Create index for fast lookups
CREATE INDEX idx_criteria_type_active ON content_criteria(type, active, version DESC);

-- Create audit log for criteria changes
CREATE TABLE IF NOT EXISTS content_criteria_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criteria_id UUID REFERENCES content_criteria(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'deactivate')),
  changes JSONB,
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default criteria
INSERT INTO content_criteria (type, name, description, required_fields, scoring_weights, validation_rules, enrichment_priorities)
VALUES 
-- Projects
('project', 
 'Early-Stage Startups',
 'Web3 startups launched 2024+, <$500k funding, ≤10 team members',
 '["title", "description", "url", "team_size", "launch_date"]'::jsonb,
 '{"recency": 0.30, "team_size": 0.20, "funding_stage": 0.15, "validation": 0.15, "traction": 0.10, "needs": 0.10}'::jsonb,
 '{"min_team_size": 1, "max_team_size": 10, "max_funding": 500000, "min_launch_year": 2024, "min_description_length": 500, "max_age_days": 30, "exclude_corporate": true}'::jsonb,
 '["github_data", "team_linkedin", "funding_history", "social_metrics", "product_metrics"]'::jsonb
),
-- Funding
('funding',
 'Active Funding Programs',
 'Grants, incubators, accelerators with 2025 activity',
 '["program_name", "description", "funding_amount", "application_url", "eligibility"]'::jsonb,
 '{"deadline_urgency": 0.30, "accessibility": 0.20, "amount_fit": 0.15, "recent_activity": 0.20, "benefits": 0.15}'::jsonb,
 '{"min_funding_amount": 1000, "max_funding_amount": 10000000, "min_description_length": 500, "must_be_active": true, "requires_2025_activity": true}'::jsonb,
 '["funder_profile", "portfolio_companies", "success_stories", "application_tips", "contact_info"]'::jsonb
),
-- Resources
('resource',
 'Founder Resources',
 'Tools, education, communities for early-stage teams',
 '["title", "description", "url", "category", "resource_type"]'::jsonb,
 '{"price_accessibility": 0.20, "recency": 0.15, "credibility": 0.10, "relevance": 0.10, "usefulness": 0.30, "quality": 0.15}'::jsonb,
 '{"min_description_length": 500, "valid_categories": ["infrastructure", "educational", "tools", "communities"], "max_age_months": 6, "must_help_early_stage": true}'::jsonb,
 '["documentation_quality", "user_reviews", "github_stats", "pricing_info", "alternatives"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Add RLS policies
ALTER TABLE content_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_criteria_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can modify criteria
CREATE POLICY "Admins can manage criteria" ON content_criteria
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Anyone can read active criteria
CREATE POLICY "Anyone can read active criteria" ON content_criteria
  FOR SELECT 
  USING (active = true);

-- Audit log is admin-only
CREATE POLICY "Admins can view audit log" ON content_criteria_audit
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Function to log criteria changes
CREATE OR REPLACE FUNCTION log_criteria_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO content_criteria_audit (
    criteria_id,
    action,
    changes,
    performed_by
  ) VALUES (
    NEW.id,
    CASE 
      WHEN OLD IS NULL THEN 'create'
      WHEN NEW.active = false AND OLD.active = true THEN 'deactivate'
      ELSE 'update'
    END,
    jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    ),
    NEW.updated_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER criteria_audit_trigger
  AFTER INSERT OR UPDATE ON content_criteria
  FOR EACH ROW
  EXECUTE FUNCTION log_criteria_change();