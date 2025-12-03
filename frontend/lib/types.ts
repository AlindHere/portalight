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

// User Management Types
export type Role = 'admin' | 'dev';

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    team_ids: string[];
    avatar?: string;
    created_at: string;
}

export interface Team {
    id: string;
    name: string;
    description: string;
    member_ids: string[];
    service_ids: string[];
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
