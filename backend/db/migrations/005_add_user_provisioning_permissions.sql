-- Migration: Add user provisioning permissions table
-- Allows leads/superadmins to grant dev users access to specific resource types

CREATE TABLE IF NOT EXISTS user_provisioning_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(20) NOT NULL, -- 's3', 'sqs', 'sns'
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, resource_type)
);

CREATE INDEX idx_user_provisioning_permissions_user_id ON user_provisioning_permissions(user_id);
