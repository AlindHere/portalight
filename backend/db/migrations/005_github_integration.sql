-- 1. GitHub Configuration Table
CREATE TABLE IF NOT EXISTS github_metadata_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Repository Details
    repo_owner VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    branch VARCHAR(100) DEFAULT 'main' NOT NULL,
    projects_path VARCHAR(255) DEFAULT 'projects' NOT NULL,
    
    -- Authentication (store one or both)
    auth_type VARCHAR(50) NOT NULL,  -- 'github_app' | 'pat' | 'both'
    
    -- GitHub App settings
    github_app_id BIGINT,
    github_app_installation_id BIGINT,
    github_app_private_key_encrypted TEXT,
    
    -- PAT settings
    personal_access_token_encrypted TEXT,
    
    -- Status
    enabled BOOLEAN DEFAULT true,
    last_scan_at TIMESTAMP,
    last_scan_status VARCHAR(50),     -- 'success' | 'failed'
    last_scan_error TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Enforce singleton pattern (only one config allowed)
    CONSTRAINT single_config_row CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Ensure only one configuration exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_config_singleton ON github_metadata_config ((id));

-- 2. Update Projects Table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS catalog_file_path VARCHAR(500);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS catalog_metadata JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'never_synced';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sync_error TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_synced BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_projects_catalog_path ON projects(catalog_file_path);
CREATE INDEX IF NOT EXISTS idx_projects_sync_status ON projects(sync_status);

-- 3. Update Services Table
ALTER TABLE services ADD COLUMN IF NOT EXISTS catalog_source VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS auto_synced BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS orphaned BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMP;
ALTER TABLE services ADD COLUMN IF NOT EXISTS catalog_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_services_auto_synced ON services(auto_synced);
CREATE INDEX IF NOT EXISTS idx_services_orphaned ON services(orphaned);
CREATE INDEX IF NOT EXISTS idx_services_catalog_source ON services(catalog_source);

-- 4. Sync History Table
CREATE TABLE IF NOT EXISTS catalog_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Sync Context
    sync_type VARCHAR(50) NOT NULL,   -- 'manual' | 'scheduled' | 'webhook'
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_name VARCHAR(255),         -- In case project deleted
    catalog_file_path VARCHAR(500),
    
    -- Results
    status VARCHAR(50) NOT NULL,       -- 'success' | 'partial' | 'failed'
    projects_created INT DEFAULT 0,
    projects_updated INT DEFAULT 0,
    services_created INT DEFAULT 0,
    services_updated INT DEFAULT 0,
    services_orphaned INT DEFAULT 0,
    
    -- Error Details
    error_message TEXT,
    validation_errors JSONB,           -- Detailed validation errors
    
    -- Duration
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INT,
    
    -- User Context
    synced_by UUID REFERENCES users(id),
    synced_by_name VARCHAR(255),
    
    CONSTRAINT duration_check CHECK (duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sync_history_project ON catalog_sync_history(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON catalog_sync_history(status);
CREATE INDEX IF NOT EXISTS idx_sync_history_started ON catalog_sync_history(started_at DESC);
