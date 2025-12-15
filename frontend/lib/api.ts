import { Service, Secret, Stats } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Helper function to get headers with auth token
function getHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {
        ...additionalHeaders,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

export async function fetchServices(): Promise<Service[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services`, {
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch services');
    }
    return response.json();
}

export async function createService(service: Partial<Service>): Promise<Service> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(service),
    });
    if (!response.ok) {
        throw new Error('Failed to create service');
    }
    return response.json();
}

export async function fetchSecrets(): Promise<Secret[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/secrets`, {
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch secrets');
    }
    return response.json();
}

export async function provisionResource(request: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/provision`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        throw new Error('Failed to provision resource');
    }
    return response.json();
}

export function calculateStats(services: Service[]): Stats {
    return {
        totalServices: services.length,
        productionServices: services.filter(s => s.environment === 'Production').length,
        avgUptime: '99.8%', // This would come from monitoring system
        totalOwners: new Set(services.map(s => s.owner)).size,
    };
}

// User Management API
export async function fetchCurrentUser(): Promise<import('./types').CurrentUserResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/current`, {
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch current user');
    return response.json();
}

export async function fetchUsers(): Promise<import('./types').User[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
}

export async function createUser(user: Partial<import('./types').User>): Promise<import('./types').User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
}

export async function updateUser(user: import('./types').User): Promise<import('./types').User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
}

export async function deleteUser(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users?id=${userId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete user');
}

// Team Management API
export async function fetchTeams(): Promise<import('./types').Team[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/teams`, {
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch teams');
    return response.json();
}

export async function createTeam(name: string, description: string): Promise<import('./types').Team> {
    const response = await fetch(`${API_BASE_URL}/api/v1/teams`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, description }),
    });
    if (!response.ok) throw new Error('Failed to create team');
    return response.json();
}

export async function deleteTeam(teamId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/teams?id=${teamId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete team');
}

export async function updateTeamMembers(teamId: string, memberIds: string[]): Promise<import('./types').Team> {
    const response = await fetch(`${API_BASE_URL}/api/v1/teams/members`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ team_id: teamId, member_ids: memberIds }),
    });
    if (!response.ok) throw new Error('Failed to update team members');
    return response.json();
}

// Project Management API
export async function fetchProjects(): Promise<import('./types').Project[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
}

export async function fetchProjectById(id: string): Promise<import('./types').ProjectWithServices> {
    const response = await fetch(`${API_BASE_URL}/api/v1/projects/${id}`, {
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch project');
    return response.json();
}
export async function updateProjectAccess(projectId: string, teamIds: string[], userIds: string[]): Promise<import('./types').Project> {
    const response = await fetch(`${API_BASE_URL}/api/v1/projects/access`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ project_id: projectId, team_ids: teamIds, user_ids: userIds }),
    });
    if (!response.ok) throw new Error('Failed to update project access');
    return response.json();
}
export async function updateProject(id: string, data: Partial<import('./types').Project>): Promise<import('./types').Project> {
    const response = await fetch(`${API_BASE_URL}/api/v1/projects/${id}`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update project');
    return response.json();
}

// Audit Logs API
export async function fetchAuditLogs(params?: import('./types').AuditLogQueryParams): Promise<import('./types').AuditLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.user_email) queryParams.append('user_email', params.user_email);
    if (params?.action) queryParams.append('action', params.action);

    const url = `${API_BASE_URL}/api/v1/audit-logs${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url, {
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch audit logs');
    return response.json();
}

export async function createAuditLog(log: Partial<import('./types').AuditLog>): Promise<import('./types').AuditLog> {
    const response = await fetch(`${API_BASE_URL}/api/v1/audit-logs`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(log),
    });
    if (!response.ok) throw new Error('Failed to create audit log');
    return response.json();
}
