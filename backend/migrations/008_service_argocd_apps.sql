-- Migration: Create service_argocd_apps table
-- This table stores the mapping between services and their ArgoCD applications
-- Each service can have multiple ArgoCD apps (one per environment like prod, staging, dev)

CREATE TABLE IF NOT EXISTS service_argocd_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    argocd_app_name VARCHAR(255) NOT NULL,
    environment_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, argocd_app_name),
    UNIQUE(service_id, environment_name)
);

CREATE INDEX IF NOT EXISTS idx_service_argocd_apps_service ON service_argocd_apps(service_id);

-- Add comment
COMMENT ON TABLE service_argocd_apps IS 'Maps services to their ArgoCD applications with environment names';
