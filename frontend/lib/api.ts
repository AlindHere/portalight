import { Service, ServiceLink, ServiceResourceMapping, Secret, Stats, Resource, DiscoveredResource, DiscoveredResourceDB } from './types';

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

async function handleResponse(response: Response, errorMessage: string = 'Request failed') {
    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        throw new Error(errorMessage);
    }
    return response.json();
}

export async function fetchServices(): Promise<Service[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch services');
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

// Fetch a single service with links and mapped resources
export async function fetchServiceById(serviceId: string): Promise<Service> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch service');
}

// Update a service (owner, etc.)
export async function updateService(serviceId: string, updates: { owner?: string }): Promise<Service> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}`, {
        method: 'PATCH',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updates),
    });
    return handleResponse(response, 'Failed to update service');
}

// Service Links
export async function fetchServiceLinks(serviceId: string): Promise<ServiceLink[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}/links`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch service links');
}

export async function addServiceLink(serviceId: string, label: string, url: string, icon?: string): Promise<ServiceLink> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}/links`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ label, url, icon }),
    });
    return handleResponse(response, 'Failed to add link');
}

export async function updateServiceLink(serviceId: string, linkId: string, label: string, url: string, icon?: string): Promise<ServiceLink> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}/links/${linkId}`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ label, url, icon }),
    });
    return handleResponse(response, 'Failed to update link');
}

export async function deleteServiceLink(serviceId: string, linkId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}/links/${linkId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to delete link');
}

// Service Resource Mappings
export async function fetchServiceResources(serviceId: string): Promise<ServiceResourceMapping[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}/resources`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch service resources');
}

export async function mapResourcesToService(serviceId: string, resourceIds: string[]): Promise<{ success: boolean; mapped: number }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}/resources`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ resource_ids: resourceIds }),
    });
    return handleResponse(response, 'Failed to map resources');
}

export async function unmapResourceFromService(serviceId: string, resourceId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/${serviceId}/resources/${resourceId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to unmap resource');
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

// AWS Credentials Management
export async function fetchAWSCredentials(): Promise<Secret[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/credentials`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch AWS credentials');
}

export async function createAWSCredential(
    name: string,
    accountId: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    accessType: 'read' | 'write' = 'write'
): Promise<Secret> {
    const response = await fetch(`${API_BASE_URL}/api/v1/credentials`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            name,
            provider: 'AWS',
            account_id: accountId,
            region,
            access_type: accessType,
            access_key_id: accessKeyId,
            secret_access_key: secretAccessKey,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create AWS credential');
    }
    return response.json();
}

export async function deleteAWSCredential(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/credentials/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete AWS credential');
    }
}

// Dev Provisioning Permissions
export interface UserProvisioningPermissions {
    user_id: string;
    allowed_types: string[];
    s3_enabled: boolean;
    sqs_enabled: boolean;
    sns_enabled: boolean;
}

export async function fetchDevProvisioningPermissions(userId: string): Promise<UserProvisioningPermissions> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/provisioning-permissions`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch provisioning permissions');
}

export async function updateDevProvisioningPermissions(
    userId: string,
    permissions: { s3_enabled: boolean; sqs_enabled: boolean; sns_enabled: boolean }
): Promise<UserProvisioningPermissions> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/provisioning-permissions`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(permissions),
    });
    return handleResponse(response, 'Failed to update provisioning permissions');
}

export async function createResource(request: any): Promise<Resource> {
    const response = await fetch(`${API_BASE_URL}/api/v1/provision`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to provision resource');
    }
    return response.json();
}

export async function fetchProjectResources(projectId: string): Promise<Resource[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/resources`, {
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch project resources');
    }
    return response.json();
}

// AWS Resource Discovery


export interface DiscoveryResponse {
    resources: DiscoveredResource[];
    region: string;
    count: number;
}

export async function discoverResources(
    secretId: string,
    region?: string,
    types?: string[]
): Promise<DiscoveryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/discover`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            secret_id: secretId,
            region: region,
            types: types,
        }),
    });
    return handleResponse(response, 'Failed to discover resources');
}

// Resource Metrics
export interface MetricDataPoint {
    timestamp: string;
    value: number;
}

export interface ResourceMetrics {
    resource_arn: string;
    resource_type: string;
    period: string;
    metrics: Record<string, MetricDataPoint[]>;
    metadata?: Record<string, string>;
    fetched_at: string;
}

export async function fetchResourceMetrics(
    secretId: string,
    resourceType: string,
    resourceName: string,
    region?: string,
    period: string = '24h'
): Promise<ResourceMetrics> {
    const response = await fetch(`${API_BASE_URL}/api/v1/resources/metrics`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            secret_id: secretId,
            resource_type: resourceType,
            resource_name: resourceName,
            region: region,
            period: period,
        }),
    });
    return handleResponse(response, 'Failed to fetch resource metrics');
}

// Discovered Resources & Sync
// Discovered Resources & Sync

export interface SyncResult {
    project_id: string;
    secret_id: string;
    region: string;
    resources_found: number;
    resources_added: number;
    resources_active: number;
    resources_deleted: number;
    synced_at: string;
    error?: string;
}

export async function syncProjectResources(
    projectId: string,
    secretId: string,
    region?: string
): Promise<SyncResult> {
    const response = await fetch(`${API_BASE_URL}/api/v1/resources/sync`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            project_id: projectId,
            secret_id: secretId,
            region: region,
        }),
    });
    return handleResponse(response, 'Failed to sync resources');
}

export async function associateResources(
    projectId: string,
    secretId: string,
    resources: DiscoveredResource[]
): Promise<{ success: boolean; resources_added: number }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/resources/associate`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            project_id: projectId,
            secret_id: secretId,
            resources: resources.map(r => ({
                arn: r.arn,
                resource_type: r.type,
                name: r.name,
                region: r.region,
                metadata: r.metadata,
            })),
        }),
    });
    return handleResponse(response, 'Failed to associate resources');
}

export async function fetchDiscoveredResources(projectId?: string): Promise<DiscoveredResourceDB[]> {
    const url = projectId
        ? `${API_BASE_URL}/api/v1/resources/discovered?project_id=${projectId}`
        : `${API_BASE_URL}/api/v1/resources/discovered`;

    const response = await fetch(url, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch discovered resources');
}

export async function removeDiscoveredResource(resourceId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/resources/discovered/${resourceId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to remove resource');
}

export async function fetchResourceById(identifier: string): Promise<DiscoveredResourceDB> {
    const response = await fetch(`${API_BASE_URL}/api/v1/resources/discovered/${identifier}`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch resource');
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
    return handleResponse(response, 'Failed to fetch current user');
}

export async function fetchUsers(): Promise<import('./types').User[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch users');
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
    return handleResponse(response, 'Failed to fetch teams');
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
    return handleResponse(response, 'Failed to fetch projects');
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

export async function syncProject(id: string): Promise<{ success: boolean, message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/projects/${id}/sync`, {
        method: 'POST',
        headers: getHeaders(),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to sync project');
    }
    return response.json();
}

export async function deleteProject(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/projects/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete project');
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

// GitHub Integration APIs
export async function fetchGitHubConfig() {
    const response = await fetch(`${API_BASE_URL}/api/v1/catalog/config`, {
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch GitHub config');
    }
    return response.json();
}

export async function updateGitHubConfig(config: any) {
    const response = await fetch(`${API_BASE_URL}/api/v1/catalog/config`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(config),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update GitHub config: ${error}`);
    }
    return response.json();
}

export async function fetchCatalogScan() {
    const response = await fetch(`${API_BASE_URL}/api/v1/catalog/scan`, {
        headers: getHeaders(),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to scan catalog: ${error}`);
    }
    return response.json();
}

export async function syncCatalog(mappings: Array<{ file: string, team_id: string }>) {
    console.log('[API] syncCatalog called with:', mappings);
    console.log('[API] Sending to URL:', `${API_BASE_URL}/api/v1/catalog/sync`);

    const response = await fetch(`${API_BASE_URL}/api/v1/catalog/sync`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ mappings }),
    });

    console.log('[API] Response status:', response.status);
    console.log('[API] Response ok:', response.ok);

    if (!response.ok) {
        const error = await response.text();
        console.error('[API] Error response:', error);
        throw new Error(`Failed to sync catalog: ${error}`);
    }
    const result = await response.json();
    console.log('[API] Success response:', result);
    return result;
}

// ==================== ArgoCD API Functions ====================

export interface ArgoCDApplication {
    name: string;
    namespace: string;
    project: string;
    health: string;
    sync_status: string;
    revision?: string;
    created_at?: string;
}

export interface ArgoCDPod {
    name: string;
    namespace: string;
    status: string;
    ready: string;
    restarts: number;
    age: string;
    containers: string[];
}

export interface ServiceArgoCDApp {
    id: string;
    service_id: string;
    argocd_app_name: string;
    environment_name: string;
    created_at: string;
    updated_at: string;
}

// Get ArgoCD configuration (base URL for external links)
export async function fetchArgoCDConfig(): Promise<{ configured: boolean; base_url: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/config`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch ArgoCD config');
}

// List all ArgoCD applications from ArgoCD server
export async function fetchArgoCDApplications(): Promise<ArgoCDApplication[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/applications`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch ArgoCD applications');
}

// Get ArgoCD apps linked to a service
export async function fetchServiceArgoCDApps(serviceId: string): Promise<ServiceArgoCDApp[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/service/${serviceId}/apps`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch service ArgoCD apps');
}

// Link an ArgoCD app to a service with an environment name
export async function linkArgoCDApp(serviceId: string, appName: string, environmentName: string): Promise<ServiceArgoCDApp> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/service/${serviceId}/apps`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            argocd_app_name: appName,
            environment_name: environmentName,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to link ArgoCD app');
    }
    return response.json();
}

// Unlink an ArgoCD app from a service
export async function unlinkArgoCDApp(serviceId: string, appId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/service/${serviceId}/apps/${appId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to unlink ArgoCD app');
    }
}

// Get ArgoCD application status
export async function fetchArgoCDAppStatus(appName: string): Promise<ArgoCDApplication> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/apps/${appName}/status`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch app status');
}

// Get pods for an ArgoCD application
export async function fetchArgoCDAppPods(appName: string): Promise<ArgoCDPod[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/apps/${appName}/pods`, {
        headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch pods');
}

// Get logs for a pod
export async function fetchArgoCDPodLogs(appName: string, podName: string, namespace: string, container?: string): Promise<string> {
    const params = new URLSearchParams({ namespace });
    if (container) params.append('container', container);

    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/apps/${appName}/pods/${podName}/logs?${params}`, {
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch logs');
    }
    return response.text();
}

// Delete a pod
export async function deleteArgoCDPod(appName: string, podName: string, namespace: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/apps/${appName}/pods/${podName}?namespace=${namespace}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete pod');
    }
}

// Trigger a sync for an ArgoCD application
export async function syncArgoCDApp(appName: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/argocd/apps/${appName}/sync`, {
        method: 'POST',
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to sync application');
    }
}
