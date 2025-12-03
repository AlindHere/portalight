-- Portalight Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'dev')),
    avatar VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team members (many-to-many)
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id)
);

-- Repositories table
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(500) NOT NULL UNIQUE,
    branch VARCHAR(100) DEFAULT 'main',
    pat_encrypted TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Services table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    environment VARCHAR(50) CHECK (environment IN ('Production', 'Staging', 'Experimental')),
    language VARCHAR(100),
    tags TEXT[],
    github_repo VARCHAR(500),
    owner VARCHAR(255),
    grafana_url VARCHAR(500),
    confluence_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (repository_id, name)
);

-- Cloud credentials/secrets table
CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('AWS', 'Azure', 'GCP')),
    region VARCHAR(100),
    credentials_encrypted TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Provision requests table
CREATE TABLE provision_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    resource_type VARCHAR(100) NOT NULL,
    resource_name VARCHAR(255),
    parameters JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_services_team ON services(team_id);
CREATE INDEX idx_services_environment ON services(environment);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_provision_requests_user ON provision_requests(user_id);
CREATE INDEX idx_provision_requests_status ON provision_requests(status);

-- Seed data
-- Insert users
INSERT INTO users (id, name, email, role, avatar) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'John Doe', 'john.doe@company.com', 'admin', 'JD'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Jane Smith', 'jane.smith@company.com', 'dev', 'JS'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Bob Johnson', 'bob.johnson@company.com', 'dev', 'BJ');

-- Insert teams
INSERT INTO teams (id, name, description) VALUES
    ('650e8400-e29b-41d4-a716-446655440001', 'Platform Team', 'Core platform infrastructure and services'),
    ('650e8400-e29b-41d4-a716-446655440002', 'Product Team', 'Product features and user-facing applications');

-- Insert team members
INSERT INTO team_members (team_id, user_id) VALUES
    ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'),
    ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'),
    ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001'),
    ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003');

-- Insert sample services
INSERT INTO services (id, team_id, name, description, environment, language, tags, github_repo, owner, grafana_url, confluence_url) VALUES
    ('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'payments-service-go', 'Payment processing microservice', 'Production', 'Go', ARRAY['payments', 'golang', 'microservice'], 'https://github.com/company/payments-service-go', 'john.doe@company.com', 'https://grafana.company.com/d/payments', 'https://confluence.company.com/payments'),
    ('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'user-auth-api', 'User authentication and authorization API', 'Production', 'Node.js', ARRAY['auth', 'nodejs', 'api'], 'https://github.com/company/user-auth-api', 'jane.smith@company.com', 'https://grafana.company.com/d/auth', 'https://confluence.company.com/auth'),
    ('750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440002', 'notification-worker', 'Background worker for sending notifications', 'Production', 'Python', ARRAY['notifications', 'python', 'worker'], 'https://github.com/company/notification-worker', 'bob.johnson@company.com', NULL, NULL),
    ('750e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440002', 'analytics-dashboard', 'Real-time analytics dashboard', 'Staging', 'React', ARRAY['analytics', 'react', 'frontend'], 'https://github.com/company/analytics-dashboard', 'john.doe@company.com', NULL, NULL);

-- Insert sample secrets
INSERT INTO secrets (id, name, provider, region, created_by) VALUES
    ('850e8400-e29b-41d4-a716-446655440001', 'AWS Production', 'AWS', 'us-east-1', '550e8400-e29b-41d4-a716-446655440001'),
    ('850e8400-e29b-41d4-a716-446655440002', 'AWS Staging', 'AWS', 'us-west-2', '550e8400-e29b-41d4-a716-446655440001'),
    ('850e8400-e29b-41d4-a716-446655440003', 'Azure Production', 'Azure', 'eastus', '550e8400-e29b-41d4-a716-446655440001');
