-- Migration: Create discovered_resources table
-- Tracks AWS resources discovered via the discovery service

CREATE TABLE IF NOT EXISTS discovered_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,
    arn VARCHAR(500) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- s3, sqs, sns, rds, lambda
    name VARCHAR(255) NOT NULL,
    region VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, deleted, unknown
    metadata JSONB DEFAULT '{}',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, arn)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_discovered_resources_project ON discovered_resources(project_id);
CREATE INDEX IF NOT EXISTS idx_discovered_resources_type ON discovered_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_discovered_resources_status ON discovered_resources(status);
CREATE INDEX IF NOT EXISTS idx_discovered_resources_arn ON discovered_resources(arn);
