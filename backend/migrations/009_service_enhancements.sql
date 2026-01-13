-- Migration: Service Catalog Enhancements
-- Adds custom links, AWS resource mappings, and integration fields

-- Custom links table (key-value pairs like Sentry, PagerDuty, etc.)
CREATE TABLE IF NOT EXISTS service_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, label)
);

-- Service to AWS resource mapping
CREATE TABLE IF NOT EXISTS service_resource_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    discovered_resource_id UUID NOT NULL REFERENCES discovered_resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, discovered_resource_id)
);

-- Add ArgoCD and Loki fields to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS argocd_app_name VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS argocd_url VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS loki_url VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS loki_labels JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_links_service ON service_links(service_id);
CREATE INDEX IF NOT EXISTS idx_service_resource_mappings_service ON service_resource_mappings(service_id);
CREATE INDEX IF NOT EXISTS idx_service_resource_mappings_resource ON service_resource_mappings(discovered_resource_id);
