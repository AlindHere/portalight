'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import ProjectEditModal from '@/components/ProjectEditModal';
import ProjectAccessModal from '@/components/ProjectAccessModal';
import ResourceDiscoveryModal from '@/components/ResourceDiscoveryModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { fetchProjectById, fetchCurrentUser, updateProject, fetchTeams, fetchUsers, updateProjectAccess, syncProject, fetchProjectResources, fetchDiscoveredResources, syncProjectResources, fetchAWSCredentials, removeDiscoveredResource, DiscoveredResource, DiscoveredResourceDB, deleteProject } from '@/lib/api';
import { ProjectWithServices, User, Team, Project, Resource, Secret } from '@/lib/types';
import styles from './page.module.css';
import CustomDropdown from '@/components/ui/CustomDropdown';

export default function ProjectDetailPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const projectId = params.id as string;

    // Read initial tab from URL, default to 'services'
    const initialTab = searchParams.get('tab') === 'resources' ? 'resources' : 'services';

    const [project, setProject] = useState<ProjectWithServices | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingProject, setIsEditingProject] = useState(false);
    const [managingAccess, setManagingAccess] = useState(false);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [discoveredResources, setDiscoveredResources] = useState<DiscoveredResourceDB[]>([]);
    const [credentials, setCredentials] = useState<Secret[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [resourceSyncing, setResourceSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'resources' | 'services'>(initialTab);
    const [resourceFilter, setResourceFilter] = useState<string>('all');

    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        resourceId: string;
        resourceName: string;
    }>({ isOpen: false, resourceId: '', resourceName: '' });
    const [removing, setRemoving] = useState(false);

    // Delete project modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Update URL when tab changes
    const handleTabChange = (tab: 'resources' | 'services') => {
        setActiveTab(tab);
        const newUrl = tab === 'services'
            ? `/projects/${projectId}`
            : `/projects/${projectId}?tab=resources`;
        window.history.replaceState({}, '', newUrl);
    };


    // Filter discovered resources by type
    const filteredResources = resourceFilter === 'all'
        ? discoveredResources
        : discoveredResources?.filter(r => r.resource_type === resourceFilter) || [];

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        try {
            const [projectData, userData, teamsData, usersData, resourcesData, discoveredData, credsData] = await Promise.all([
                fetchProjectById(projectId),
                fetchCurrentUser(),
                fetchTeams(),
                fetchUsers(),
                fetchProjectResources(projectId),
                fetchDiscoveredResources(projectId),
                fetchAWSCredentials(),
            ]);
            setProject(projectData);
            setCurrentUser(userData.user);
            setAllTeams(teamsData);
            setAllUsers(usersData);
            setResources(resourcesData);
            setDiscoveredResources(discoveredData || []);
            setCredentials(credsData || []);
        } catch (error) {
            console.error('Failed to load project:', error);
        } finally {
            setLoading(false);
        }
    };


    const handleSaveProject = async (data: Partial<Project>) => {
        if (!project) return;

        try {
            const updatedProject = await updateProject(project.id, data);
            setProject({ ...project, ...updatedProject });
            setIsEditingProject(false);
        } catch (error) {
            console.error('Failed to update project:', error);
            alert('Failed to update project');
        }
    };

    const handleDeleteProject = async () => {
        if (!project || deleteConfirmName !== project.name) return;

        setDeleting(true);
        try {
            await deleteProject(project.id);
            router.push('/');
        } catch (error) {
            console.error('Failed to delete project:', error);
            alert('Failed to delete project');
            setDeleting(false);
        }
    };

    const handleSaveAccess = async (teamIds: string[], userIds: string[]) => {
        if (!project) return;

        try {
            await updateProjectAccess(project.id, teamIds, userIds);
            setProject({ ...project, team_ids: teamIds, user_ids: userIds });
        } catch (error) {
            console.error('Failed to update access:', error);
            alert('Failed to update access');
        }
    };

    const handleSyncProject = async () => {
        if (!project) return;

        setSyncing(true);
        setSyncMessage(null);

        try {
            const result = await syncProject(project.id);
            setSyncMessage({ type: 'success', text: result.message || 'Project synced successfully!' });

            // Reload project data to show updated content
            await loadData();

            // Clear message after 5 seconds
            setTimeout(() => setSyncMessage(null), 5000);
        } catch (error: any) {
            console.error('Failed to sync project:', error);
            setSyncMessage({ type: 'error', text: error.message || 'Failed to sync project' });

            // Clear error message after 5 seconds
            setTimeout(() => setSyncMessage(null), 5000);
        } finally {
            setSyncing(false);
        }
    };

    const handleResourceSync = async () => {
        if (!project || credentials.length === 0) {
            setSyncMessage({ type: 'error', text: 'No credentials available for sync' });
            setTimeout(() => setSyncMessage(null), 5000);
            return;
        }

        setResourceSyncing(true);
        try {
            // Sync with the first available credential
            const result = await syncProjectResources(project.id, credentials[0].id, credentials[0].region || 'ap-south-1');
            setSyncMessage({
                type: 'success',
                text: `Synced: ${result.resources_active} active, ${result.resources_deleted} deleted`
            });

            // Reload data
            await loadData();

            setTimeout(() => setSyncMessage(null), 5000);
        } catch (error: any) {
            console.error('Failed to sync resources:', error);
            setSyncMessage({ type: 'error', text: error.message || 'Failed to sync resources' });
            setTimeout(() => setSyncMessage(null), 5000);
        } finally {
            setResourceSyncing(false);
        }
    };

    const handleRemoveResource = (e: React.MouseEvent, resourceId: string, resourceName: string) => {
        e.stopPropagation(); // Prevent card click navigation
        setConfirmModal({ isOpen: true, resourceId, resourceName });
    };

    const confirmRemoveResource = async () => {
        setRemoving(true);
        try {
            await removeDiscoveredResource(confirmModal.resourceId);
            setSyncMessage({ type: 'success', text: `Removed ${confirmModal.resourceName} from project` });
            setConfirmModal({ isOpen: false, resourceId: '', resourceName: '' });
            await loadData(); // Refresh list
            setTimeout(() => setSyncMessage(null), 3000);
        } catch (error: any) {
            console.error('Failed to remove resource:', error);
            setSyncMessage({ type: 'error', text: error.message || 'Failed to remove resource' });
            setTimeout(() => setSyncMessage(null), 5000);
        } finally {
            setRemoving(false);
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.loading}>Loading project...</div>
                    </div>
                </main>
            </>
        );
    }

    if (!project) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.error}>Project not found</div>
                    </div>
                </main>
            </>
        );
    }

    const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'lead';

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    {/* Back Button */}
                    <button onClick={() => router.push('/projects')} className={styles.backButton}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Projects
                    </button>

                    {/* Project Header */}
                    <div className={styles.projectHeader}>
                        <div className={styles.projectIcon}>
                            {project.avatar ? (
                                <img
                                    src={project.avatar}
                                    alt={project.name}
                                    className={styles.projectAvatar}
                                />
                            ) : (
                                project.name.substring(0, 1)
                            )}
                        </div>
                        <div className={styles.projectDetails}>
                            <div className="flex items-center gap-3">
                                <h1 className={styles.projectName}>{project.name}</h1>
                            </div>
                            <p className={styles.projectDescription}>{project.description}</p>
                            {project.team_name && (
                                <div className={styles.teamBadge}>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    {project.team_name}
                                </div>
                            )}
                        </div>

                        {/* Sync button in header */}
                        {project.catalog_file_path && (
                            <div className={styles.headerActions}>
                                <button
                                    className={styles.syncButton}
                                    onClick={handleSyncProject}
                                    disabled={syncing}
                                >
                                    {syncing ? (
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.spinning}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                        </svg>
                                    )}
                                    {syncing ? 'Syncing...' : 'Sync Now'}
                                </button>

                                {/* Sync message */}
                                {syncMessage && (
                                    <div className={syncMessage.type === 'success' ? styles.syncSuccess : styles.syncError}>
                                        {syncMessage.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Confluence Documentation & Access Management */}
                    <div className={styles.confluenceSection}>
                        <div className={styles.confluenceDisplay}>
                            {project.confluence_url ? (
                                <a
                                    href={project.confluence_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.confluenceButton}
                                >
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    View Confluence Documentation
                                </a>
                            ) : (
                                isAdmin && (
                                    <button
                                        className={styles.addConfluenceButton}
                                        onClick={() => setIsEditingProject(true)}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Confluence Documentation
                                    </button>
                                )
                            )}


                            {isAdmin && (
                                <div className={styles.adminActions}>
                                    <button
                                        className={styles.deleteButton}
                                        onClick={() => setShowDeleteModal(true)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            background: '#fee2e2',
                                            color: '#dc2626',
                                            border: '1px solid #fecaca',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            marginRight: '0.75rem',
                                        }}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1.125rem', height: '1.125rem' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete Project
                                    </button>
                                    <button
                                        className={styles.editButton}
                                        onClick={() => setIsEditingProject(true)}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit
                                    </button>
                                    <button
                                        className={styles.manageAccessButton}
                                        onClick={() => setManagingAccess(true)}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        Manage Access
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tabbed Resources & Services Section */}
                    <div className={styles.servicesSection}>
                        {/* Tab Headers */}
                        <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
                            <button
                                onClick={() => handleTabChange('services')}
                                style={{
                                    padding: '1rem 2rem',
                                    fontSize: '1.063rem',
                                    fontWeight: activeTab === 'services' ? 600 : 500,
                                    color: activeTab === 'services' ? '#2563eb' : '#6b7280',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'services' ? '3px solid #2563eb' : '3px solid transparent',
                                    marginBottom: '-2px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                📦 Services ({project?.services?.length || 0})
                            </button>
                            <button
                                onClick={() => handleTabChange('resources')}
                                style={{
                                    padding: '1rem 2rem',
                                    fontSize: '1.063rem',
                                    fontWeight: activeTab === 'resources' ? 600 : 500,
                                    color: activeTab === 'resources' ? '#2563eb' : '#6b7280',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'resources' ? '3px solid #2563eb' : '3px solid transparent',
                                    marginBottom: '-2px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                ☁️ Cloud Resources ({discoveredResources?.length || 0})
                            </button>
                        </div>


                        {/* Tab Actions */}
                        {activeTab === 'resources' && currentUser?.role !== 'dev' && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <button
                                    className={styles.addConfluenceButton}
                                    onClick={handleResourceSync}
                                    disabled={resourceSyncing || credentials.length === 0}
                                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', background: '#dbeafe', color: '#1d4ed8' }}
                                >
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {resourceSyncing ? 'Syncing...' : 'Sync'}
                                </button>
                                <button
                                    className={styles.addConfluenceButton}
                                    onClick={() => setShowDiscoveryModal(true)}
                                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151' }}
                                >
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    Discover
                                </button>
                                <button
                                    className={styles.addConfluenceButton}
                                    onClick={() => router.push('/provision')}
                                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                >
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Provision
                                </button>
                                <CustomDropdown
                                    options={[
                                        { value: 'all', label: '✓ All Types' },
                                        { value: 's3', label: '🪣 S3 Buckets' },
                                        { value: 'sqs', label: '📨 SQS Queues' },
                                        { value: 'sns', label: '🔔 SNS Topics' },
                                        { value: 'rds', label: '🗄️ RDS Databases' },
                                        { value: 'lambda', label: '⚡ Lambda Functions' }
                                    ]}
                                    value={resourceFilter}
                                    onChange={setResourceFilter}
                                />
                            </div>
                        )}


                        {/* Cloud Resources Tab Content */}
                        {activeTab === 'resources' && (
                            <>
                                {(filteredResources && filteredResources.length > 0) ? (
                                    <div className={styles.servicesGrid}>
                                        {filteredResources?.map((resource) => (

                                            <div
                                                key={resource.id}
                                                className={styles.serviceCard}
                                                onClick={() => router.push(`/resources?type=${resource.resource_type}&name=${encodeURIComponent(resource.name)}&region=${resource.region}`)}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderColor: resource.status === 'deleted' ? '#fecaca' : undefined,
                                                    background: resource.status === 'deleted' ? '#fef2f2' : undefined,
                                                }}
                                            >

                                                <div className={styles.serviceHeader}>
                                                    <div className="flex items-center gap-2">
                                                        <h3>{resource.name}</h3>
                                                    </div>
                                                    <span
                                                        className={styles.envBadge}
                                                        style={{
                                                            background: resource.status === 'active' ? '#dcfce7' : resource.status === 'deleted' ? '#fecaca' : '#fef3c7',
                                                            color: resource.status === 'active' ? '#16a34a' : resource.status === 'deleted' ? '#dc2626' : '#d97706',
                                                        }}
                                                    >
                                                        {resource.status === 'active' ? 'ACTIVE' : resource.status === 'deleted' ? 'DELETED' : 'UNKNOWN'}
                                                    </span>
                                                </div>
                                                <p className={styles.serviceDescription}>
                                                    {resource.resource_type === 's3' && '🪣 S3 Bucket'}
                                                    {resource.resource_type === 'sqs' && '📨 SQS Queue'}
                                                    {resource.resource_type === 'sns' && '🔔 SNS Topic'}
                                                    {resource.resource_type === 'rds' && '🗄️ RDS Database'}
                                                    {resource.resource_type === 'lambda' && '⚡ Lambda Function'}
                                                    {' • '}{resource.region}
                                                </p>
                                                <div className={styles.serviceMeta}>
                                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginTop: '0.25rem' }}>
                                                        Discovered {new Date(resource.discovered_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {isAdmin && (
                                                    <button
                                                        onClick={(e) => handleRemoveResource(e, resource.id, resource.name)}
                                                        className={styles.removeButton}
                                                        title="Remove from project"
                                                    >
                                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.emptyServices}>
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <p>No cloud resources associated yet. Use "Discover" to find and add AWS resources.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Services Tab Content */}
                        {activeTab === 'services' && (
                            <>
                                {(project?.services?.length || 0) > 0 ? (
                                    <div className={styles.servicesGrid}>
                                        {project?.services?.map((service) => (
                                            <div
                                                key={service.id}
                                                className={styles.serviceCard}
                                                onClick={() => router.push(`/services/${service.id}`)}
                                            >
                                                <div className={styles.serviceHeader}>
                                                    <div className="flex items-center gap-2">
                                                        <h3>{service.name}</h3>
                                                    </div>
                                                    <span className={`${styles.envBadge} ${styles[service.environment.toLowerCase()]}`}>
                                                        {service.environment}
                                                    </span>
                                                </div>
                                                <p className={styles.serviceDescription}>{service.description}</p>
                                                <div className={styles.serviceMeta}>
                                                    <span className={styles.language}>{service.language}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.emptyServices}>
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                        </svg>
                                        <p>No services in this project yet</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                </div>
            </main>

            {isEditingProject && project && (
                <ProjectEditModal
                    project={project}
                    onClose={() => setIsEditingProject(false)}
                    onSave={handleSaveProject}
                />
            )}

            {/* Delete Project Modal */}
            {showDeleteModal && project && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '450px' }}>
                        <div className={styles.modalHeader}>
                            <div style={{
                                width: '3rem',
                                height: '3rem',
                                borderRadius: '50%',
                                background: '#fef2f2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1rem'
                            }}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem', color: '#dc2626' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className={styles.modalTitle}>Delete Project</h3>
                            <p className={styles.modalDescription} style={{ marginTop: '0.5rem' }}>
                                This action cannot be undone. This will permanently delete the <strong>{project.name}</strong> project and remove all associations.
                            </p>
                            <div style={{ marginTop: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                    Please type <strong>{project.name}</strong> to confirm.
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmName}
                                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                                    placeholder={project.name}
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem 0.875rem',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.938rem',
                                    }}
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirmName('');
                                }}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.deleteButton}
                                onClick={handleDeleteProject}
                                disabled={deleteConfirmName !== project.name || deleting}
                                style={{
                                    opacity: deleteConfirmName !== project.name || deleting ? 0.5 : 1,
                                    cursor: deleteConfirmName !== project.name || deleting ? 'not-allowed' : 'pointer',
                                    background: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '0.5rem',
                                    fontWeight: 500,
                                }}
                            >
                                {deleting ? 'Deleting...' : 'Delete Project'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {managingAccess && project && (
                <ProjectAccessModal
                    project={project}
                    allTeams={allTeams}
                    allUsers={allUsers}
                    onClose={() => setManagingAccess(false)}
                    onSave={handleSaveAccess}
                />
            )}

            {showDiscoveryModal && project && (
                <ResourceDiscoveryModal
                    projectId={project.id}
                    onClose={() => setShowDiscoveryModal(false)}
                    onResourcesAssociated={(resources) => {
                        console.log('Associated resources:', resources);
                        // TODO: Save associated resources to project
                        setShowDiscoveryModal(false);
                        loadData(); // Refresh data
                    }}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title="Remove Resource"
                message="Are you sure you want to remove this resource from the project? This will not delete the AWS resource itself."
                resourceName={confirmModal.resourceName}
                confirmLabel="Remove"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={confirmRemoveResource}
                onCancel={() => setConfirmModal({ isOpen: false, resourceId: '', resourceName: '' })}
                loading={removing}
            />
        </>
    );
}
