export interface Service {
    id: string;
    name: string;
    team: string;
    team_name?: string;
    project_id?: string;
    description: string;
    environment: 'Production' | 'Staging' | 'Experimental';
    language: string;
    tags: string[];
    repository: string;
    owner: string;
    grafana_url?: string;
    confluence_url?: string;
    argocd_app_name?: string;
    argocd_url?: string;
    loki_url?: string;
    loki_labels?: Record<string, string>;
    catalog_source?: string;
    auto_synced?: boolean;
    catalog_metadata?: any;
    created_at: string;
    updated_at: string;
    // Joined data
    links?: ServiceLink[];
    mapped_resources?: ServiceResourceMapping[];
}

export interface ServiceLink {
    id: string;
    service_id: string;
    label: string;
    url: string;
    icon?: string;
    created_at: string;
    updated_at: string;
}

export interface ServiceResourceMapping {
    id: string;
    service_id: string;
    discovered_resource_id: string;
    created_at: string;
    resource_name?: string;
    resource_type?: string;
    resource_arn?: string;
    region?: string;
}



// Projects
export interface Project {
    id: string;
    name: string;
    description: string;
    confluence_url?: string;
    avatar?: string;
    owner_team_id?: string;
    secret_id?: string; // AWS credential for this project
    team_ids?: string[];
    user_ids?: string[];
    catalog_file_path?: string;
    catalog_metadata?: any;
    last_synced_at?: string;
    sync_status?: string;
    sync_error?: string;
    auto_synced?: boolean;
    created_at: string;
    updated_at: string;
}


export interface Secret {
    id: string;
    name: string;
    provider: 'AWS' | 'Azure' | 'GCP';
    region: string;
    account_id?: string;
    access_type?: 'read' | 'write';
    project_id?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
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
export type Role = 'superadmin' | 'lead' | 'dev';

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

export interface Resource {
    id: string;
    project_id: string;
    name: string;
    type: string;
    status: 'provisioning' | 'active' | 'failed';
    config: any;
    created_at: string;
    updated_at: string;
}

export interface DiscoveredResource {
    arn: string;
    type: string;
    name: string;
    region: string;
    status?: string;
    metadata: Record<string, any>;
    discovered_at?: string;
}

export interface DiscoveredResourceDB {
    id: string;
    project_id: string;
    secret_id: string;
    arn: string;
    resource_type: string;
    name: string;
    region: string;
    status: 'active' | 'deleted' | 'unknown';
    metadata: Record<string, any>;
    last_synced_at: string | null;
    discovered_at: string;
    created_at: string;
    updated_at: string;
}

// Type alias for backward compatibility
export type AWSCredential = Secret;
