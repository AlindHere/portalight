-- Add projects table and update services
-- Migration: Add Projects Support

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    confluence_url VARCHAR(500),
    owner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add project_id to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner_team ON projects(owner_team_id);
CREATE INDEX IF NOT EXISTS idx_services_project ON services(project_id);

-- Insert sample projects
INSERT INTO projects (id, name, description, confluence_url, owner_team_id) VALUES
    ('850e8400-e29b-41d4-a716-446655440001', 'Payments Platform', 'Core payment processing infrastructure and billing services', 'https://confluence.company.com/display/PAY/Payments-Platform', '650e8400-e29b-41d4-a716-446655440001'),
    ('850e8400-e29b-41d4-a716-446655440002', 'User Management', 'Authentication, authorization, and user profile services', 'https://confluence.company.com/display/AUTH/User-Management', '650e8400-e29b-41d4-a716-446655440002'),
    ('850e8400-e29b-41d4-a716-446655440003', 'Analytics Pipeline', 'Data analytics, reporting, and notification services', 'https://confluence.company.com/display/DATA/Analytics-Pipeline', '650e8400-e29b-41d4-a716-446655440002')
ON CONFLICT (id) DO NOTHING;

-- Update existing services with project assignments
UPDATE services SET project_id = '850e8400-e29b-41d4-a716-446655440001' 
WHERE name = 'payments-service-go';

UPDATE services SET project_id = '850e8400-e29b-41d4-a716-446655440002' 
WHERE name = 'user-auth-api';

UPDATE services SET project_id = '850e8400-e29b-41d4-a716-446655440003' 
WHERE name IN ('notification-worker', 'analytics-dashboard');
