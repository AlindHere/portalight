export interface Service {
    id: string;
    name: string;
    team: string;
    description: string;
    environment: 'Production' | 'Staging' | 'Experimental';
    language: string;
    tags: string[];
    repository: string;
    owner: string;
    grafana_url?: string;
    confluence_url?: string;
    created_at: string;
    updated_at: string;
}

export interface Secret {
    id: string;
    name: string;
    aws_account?: string;  // AWS account identifier
    provider: 'AWS' | 'Azure' | 'GCP';
    region: string;
}

export interface ProvisionRequest {
    secret_id: string;
    resource_type: string;
    parameters: Record<string, any>;
}

export interface Stats {
    totalServices: number;
    productionServices: number;
    avgUptime: string;
    totalOwners: number;
}

// User and Team Management
export interface User {
    id: string;
    name: string;
    email: string;
    role: 'superadmin' | 'lead' | 'dev';
    team_ids: string[];
    avatar?: string;
    created_at: string;
}

export interface Team {
    id: string;
    name: string;
    description: string;
    member_ids: string[];
    service_ids?: string[];
    created_at: string;
}

export interface Permission {
    resource: string;
    action: string;
    allowed: boolean;
}

export interface CurrentUserResponse {
    user: User;
    permissions: Permission[];
}

// Projects
export interface Project {
    id: string;
    name: string;
    description: string;
    confluence_url?: string;
    avatar?: string;
    owner_team_id?: string;
    team_ids?: string[];
    user_ids?: string[];
    created_at: string;
    updated_at: string;
}

export interface ProjectWithServices extends Project {
    services: Service[];
    team_name?: string;
}

// Audit Logs
export interface AuditLog {
    id: string;
    user_email: string;
    user_name?: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    resource_name?: string;
    details: string;
    ip_address?: string;
    timestamp: string;
    status: 'success' | 'failure';
}

export interface AuditLogQueryParams {
    user_email?: string;
    action?: string;
    limit?: number;
    offset?: number;
}
