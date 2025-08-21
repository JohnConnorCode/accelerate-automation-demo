-- Create system settings table for storing configuration
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create function to handle settings table creation
CREATE OR REPLACE FUNCTION create_settings_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
END;
$$ LANGUAGE plpgsql;

-- Add status columns to existing tables if they don't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP; 
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

ALTER TABLE resources ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;