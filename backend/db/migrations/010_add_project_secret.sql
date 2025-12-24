-- Add secret_id to projects table for project-level AWS credential association
-- Migration: Add AWS Credential to Projects

-- Add secret_id column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_projects_secret ON projects(secret_id);
