import { Service, Secret, Stats } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function fetchServices(): Promise<Service[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services`);
    if (!response.ok) {
        throw new Error('Failed to fetch services');
    }
    return response.json();
}

export async function createService(service: Partial<Service>): Promise<Service> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(service),
    });
    if (!response.ok) {
        throw new Error('Failed to create service');
    }
    return response.json();
}

export async function fetchSecrets(): Promise<Secret[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/secrets`);
    if (!response.ok) {
        throw new Error('Failed to fetch secrets');
    }
    return response.json();
}

export async function provisionResource(request: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/provision`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
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
    const response = await fetch(`${API_BASE_URL}/api/v1/users/me`);
    if (!response.ok) throw new Error('Failed to fetch current user');
    return response.json();
}

export async function fetchUsers(): Promise<import('./types').User[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
}

export async function createUser(user: Partial<import('./types').User>): Promise<import('./types').User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
}

export async function updateUser(user: import('./types').User): Promise<import('./types').User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
}

export async function deleteUser(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users?id=${userId}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete user');
}

// Team Management API
export async function fetchTeams(): Promise<import('./types').Team[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/teams`);
    if (!response.ok) throw new Error('Failed to fetch teams');
    return response.json();
}

export async function createTeam(team: Partial<import('./types').Team>): Promise<import('./types').Team> {
    const response = await fetch(`${API_BASE_URL}/api/v1/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(team),
    });
    if (!response.ok) throw new Error('Failed to create team');
    return response.json();
}

export async function updateTeamMembers(teamId: string, memberIds: string[]): Promise<import('./types').Team> {
    const response = await fetch(`${API_BASE_URL}/api/v1/teams/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, member_ids: memberIds }),
    });
    if (!response.ok) throw new Error('Failed to update team members');
    return response.json();
}
