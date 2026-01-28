'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/layout/Header';
import { fetchServiceById, fetchCurrentUser, addServiceLink, deleteServiceLink, updateServiceLink, mapResourcesToService, unmapResourceFromService, fetchDiscoveredResources, fetchTeams, fetchUsers, fetchProjectById, fetchServiceArgoCDApps, fetchArgoCDApplications, fetchArgoCDConfig, linkArgoCDApp, unlinkArgoCDApp, fetchArgoCDAppStatus, fetchArgoCDAppPods, fetchArgoCDPodLogs, deleteArgoCDPod, syncArgoCDApp, ServiceArgoCDApp, ArgoCDApplication, ArgoCDPod } from '@/lib/api';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { Service, ServiceLink, ServiceResourceMapping, User, Team, Project } from '@/lib/types';
import GrafanaFrame from '@/components/integrations/GrafanaFrame';
import ConfluenceFrame from '@/components/integrations/ConfluenceFrame';
import AddLinkModal, { ServiceIconImage, SERVICE_ICONS } from '@/components/AddLinkModal';
import MapResourceModal from '@/components/MapResourceModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import EditServiceModal from '@/components/EditServiceModal';
import styles from './page.module.css';

type TabType = 'overview' | 'logs' | 'deployments' | 'monitoring' | 'documentation';

const RESOURCE_ICONS: Record<string, string> = {
    s3: '🪣',
    sqs: '📨',
    sns: '🔔',
    rds: '🗄️',
    lambda: '⚡',
    dynamodb: '📊',
    ec2: '💻',
};

export default function ServiceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Read initial tab from URL, default to 'overview'
    const validTabs: TabType[] = ['overview', 'logs', 'deployments', 'monitoring', 'documentation'];
    const urlTab = searchParams.get('tab') as TabType;
    const initialTab: TabType = validTabs.includes(urlTab) ? urlTab : 'overview';

    const [service, setService] = useState<Service | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [loading, setLoading] = useState(true);
    const [projectName, setProjectName] = useState<string | null>(null);

    // Modal states
    const [showAddLinkModal, setShowAddLinkModal] = useState(false);
    const [showMapResourceModal, setShowMapResourceModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editLinkData, setEditLinkData] = useState<ServiceLink | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'link' | 'resource'; id: string; name: string } | null>(null);

    // Team members popover state
    const [showTeamMembers, setShowTeamMembers] = useState(false);
    const [teamMembers, setTeamMembers] = useState<User[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Update URL when tab changes
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        const newUrl = tab === 'overview'
            ? `/services/${params.id}`
            : `/services/${params.id}?tab=${tab}`;
        window.history.replaceState({}, '', newUrl);
    };

    // Close team members popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (showTeamMembers && !target.closest('.team-members-popover')) {
                setShowTeamMembers(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showTeamMembers]);

    useEffect(() => {
        loadData();
    }, [params.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [serviceData, userData] = await Promise.all([
                fetchServiceById(params.id as string),
                fetchCurrentUser(),
            ]);
            setService(serviceData);
            setCurrentUser(userData.user);

            // Fetch project name if service has a project
            if (serviceData.project_id) {
                try {
                    const project = await fetchProjectById(serviceData.project_id);
                    setProjectName(project.name);
                } catch {
                    setProjectName(null);
                }
            }
        } catch (error) {
            console.error('Failed to load service:', error);
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'lead';

    const handleShowTeamMembers = async () => {
        if (showTeamMembers) {
            setShowTeamMembers(false);
            return;
        }
        setLoadingMembers(true);
        setShowTeamMembers(true);
        try {
            const [teams, users] = await Promise.all([fetchTeams(), fetchUsers()]);
            const team = teams.find(t => t.name === service?.team_name || t.id === service?.team);
            if (team && team.member_ids) {
                const members = users.filter(u => team.member_ids.includes(u.id));
                setTeamMembers(members);
            } else {
                setTeamMembers([]);
            }
        } catch (error) {
            console.error('Failed to load team members:', error);
            setTeamMembers([]);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleAddLink = async (label: string, url: string, icon?: string) => {
        if (!service) return;
        await addServiceLink(service.id, label, url, icon);
        await loadData();
    };

    const handleDeleteLink = async () => {
        if (!service || !confirmDelete || confirmDelete.type !== 'link') return;
        await deleteServiceLink(service.id, confirmDelete.id);
        setConfirmDelete(null);
        await loadData();
    };

    const handleMapResources = async (resourceIds: string[]) => {
        if (!service) return;
        await mapResourcesToService(service.id, resourceIds);
        await loadData();
    };

    const handleUnmapResource = async () => {
        if (!service || !confirmDelete || confirmDelete.type !== 'resource') return;
        await unmapResourceFromService(service.id, confirmDelete.id);
        setConfirmDelete(null);
        await loadData();
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className={styles.loading}>Loading service...</div>
            </>
        );
    }

    if (!service) {
        return (
            <>
                <Header />
                <div className={styles.error}>
                    <h2>Service not found</h2>
                    <button onClick={() => router.push('/')} className="btn btn-primary">
                        Back to Dashboard
                    </button>
                </div>
            </>
        );
    }

    const tabs = [
        { id: 'overview' as TabType, label: 'Overview' },
        { id: 'deployments' as TabType, label: 'Deployments' },
        { id: 'logs' as TabType, label: 'Logs' },
        { id: 'monitoring' as TabType, label: 'Monitoring' },
        { id: 'documentation' as TabType, label: 'Documentation' },
    ];

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    {/* Breadcrumb */}
                    <div className={styles.breadcrumb}>
                        <button onClick={() => router.push('/')} className={styles.breadcrumbLink}>
                            Home
                        </button>
                        <span className={styles.breadcrumbSeparator}>/</span>
                        {projectName && service.project_id && (
                            <>
                                <button onClick={() => router.push(`/projects/${projectName}`)} className={styles.breadcrumbLink}>
                                    {projectName}
                                </button>
                                <span className={styles.breadcrumbSeparator}>/</span>
                            </>
                        )}
                        <span className={styles.breadcrumbCurrent}>{service.name}</span>
                    </div>

                    {/* Service Header */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.iconWrapper}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                </svg>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className={styles.title}>{service.name}</h1>
                                    {service.auto_synced && (
                                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded border border-blue-200" title="Managed by GitHub Catalog">Synced</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className={styles.headerRight} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

                            <span className={`badge badge-${service.environment?.toLowerCase() || 'production'}`}>
                                {service.environment || 'Production'}
                            </span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                                onClick={() => handleTabChange(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className={styles.content}>
                        {activeTab === 'overview' && (
                            <OverviewTab
                                service={service}
                                isAdmin={isAdmin}
                                onAddLink={() => setShowAddLinkModal(true)}
                                onDeleteLink={(id, name) => setConfirmDelete({ type: 'link', id, name })}
                                onEditLink={(link) => { setEditLinkData(link); setShowAddLinkModal(true); }}
                                onMapResource={() => setShowMapResourceModal(true)}
                                onUnmapResource={(id, name) => setConfirmDelete({ type: 'resource', id, name })}
                                onEdit={() => setShowEditModal(true)}
                                showTeamMembers={showTeamMembers}
                                teamMembers={teamMembers}
                                loadingMembers={loadingMembers}
                                handleShowTeamMembers={handleShowTeamMembers}
                                router={router}
                            />
                        )}
                        {activeTab === 'logs' && <LogsTab service={service} currentUser={currentUser} />}
                        {activeTab === 'deployments' && <DeploymentsTab service={service} currentUser={currentUser} />}
                        {activeTab === 'monitoring' && <MonitoringTab service={service} />}
                        {activeTab === 'documentation' && <DocumentationTab service={service} />}
                    </div>
                </div>
            </main>

            {/* Modals */}
            <AddLinkModal
                isOpen={showAddLinkModal}
                onClose={() => { setShowAddLinkModal(false); setEditLinkData(null); }}
                onAdd={handleAddLink}
                editLink={editLinkData}
                onUpdate={async (linkId, label, url) => {
                    await updateServiceLink(service.id, linkId, label, url);
                    await loadData();
                }}
            />

            {service.project_id && (
                <MapResourceModal
                    isOpen={showMapResourceModal}
                    serviceId={service.id}
                    projectId={service.project_id}
                    existingMappings={service.mapped_resources || []}
                    onClose={() => setShowMapResourceModal(false)}
                    onMap={handleMapResources}
                    fetchProjectResources={fetchDiscoveredResources}
                />
            )}

            <ConfirmationModal
                isOpen={confirmDelete !== null}
                title={confirmDelete?.type === 'link' ? 'Remove Link' : 'Unmap Resource'}
                message={confirmDelete?.type === 'link'
                    ? 'Are you sure you want to remove this link?'
                    : 'Are you sure you want to unmap this resource from the service?'}
                resourceName={confirmDelete?.name}
                confirmLabel="Remove"
                variant="danger"
                onConfirm={confirmDelete?.type === 'link' ? handleDeleteLink : handleUnmapResource}
                onCancel={() => setConfirmDelete(null)}
            />

            <EditServiceModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                service={service}
                onSave={loadData}
            />
        </>
    );
}

// Overview Tab Component with Links and Resources
interface OverviewTabProps {
    service: Service;
    isAdmin: boolean;
    onAddLink: () => void;
    onDeleteLink: (id: string, name: string) => void;
    onEditLink: (link: ServiceLink) => void;
    onMapResource: () => void;
    onUnmapResource: (id: string, name: string) => void;
    onEdit: () => void;
    // Team members popover
    showTeamMembers: boolean;
    teamMembers: User[];
    loadingMembers: boolean;
    handleShowTeamMembers: () => void;
    // Router for navigation
    router: ReturnType<typeof import('next/navigation').useRouter>;
}

function OverviewTab({ service, isAdmin, onAddLink, onDeleteLink, onEditLink, onMapResource, onUnmapResource, onEdit, showTeamMembers, teamMembers, loadingMembers, handleShowTeamMembers, router }: OverviewTabProps) {
    // Helper function to format dates properly
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Helper for Sidebar Cards
    const SidebarCard = ({ title, children, action }: { title: string, children: React.ReactNode, action?: React.ReactNode }) => (
        <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
                {action}
            </div>
            {children}
        </div>
    );

    const MetadataItem = ({ label, value, icon }: { label: string, value: string | React.ReactNode, icon?: React.ReactNode }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                {icon}
                {label}
            </div>
            <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{value}</div>
        </div>
    );

    return (
        <div className={styles.tabContent}>
            {/* Enhanced Header Info (Sub-header) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', color: '#4b5563', fontSize: '0.938rem' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1.125rem', height: '1.125rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Owned by{' '}
                    <button
                        onClick={handleShowTeamMembers}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            color: '#10b981',
                            fontSize: 'inherit',
                            padding: 0,
                            textDecoration: 'underline',
                            textUnderlineOffset: '2px',
                        }}
                    >
                        {service.team_name || service.team}
                    </button>
                    {/* Team Members Popover */}
                    {showTeamMembers && (
                        <div className="team-members-popover" style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '0.5rem',
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            padding: '0.75rem',
                            minWidth: '200px',
                            zIndex: 100,
                        }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                                Team Members
                            </div>
                            {loadingMembers ? (
                                <div style={{ fontSize: '0.813rem', color: '#6b7280', padding: '0.5rem 0' }}>Loading...</div>
                            ) : teamMembers.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {teamMembers.map(member => (
                                        <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.813rem' }}>
                                            <div style={{
                                                width: '1.5rem',
                                                height: '1.5rem',
                                                borderRadius: '50%',
                                                background: '#10b981',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.625rem',
                                                fontWeight: 600,
                                            }}>
                                                {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500, color: '#111827' }}>{member.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{member.role}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.813rem', color: '#6b7280', padding: '0.5rem 0' }}>No members found</div>
                            )}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1.125rem', height: '1.125rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                    Service
                </div>
                {service.repository && (
                    <a href={service.repository} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4b5563', textDecoration: 'none', background: '#f3f4f6', padding: '0.375rem 0.75rem', borderRadius: '0.375rem' }} className={styles.link}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1.125rem', height: '1.125rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                        View Source
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                )}
            </div>

            {/* Main Layout Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>

                {/* Left Column: Main Content */}
                <div>
                    {/* About Card */}
                    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: 0 }}>About</h3>
                        </div>
                        <p className={styles.description} style={{ fontSize: '1rem' }}>
                            {service.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* Links Card - 2 column grid with service icons */}
                    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: 0 }}>Links</h3>
                            {isAdmin && (
                                <button onClick={onAddLink} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', fontSize: '0.875rem', fontWeight: 500 }}>+ Add</button>
                            )}
                        </div>
                        {service.links && service.links.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                                {service.links.map((link) => {
                                    // Get service config based on label
                                    const getServiceConfig = (label: string) => {
                                        const lower = label.toLowerCase();
                                        for (const svc of SERVICE_ICONS) {
                                            if (lower.includes(svc.id) || lower.includes(svc.label.toLowerCase())) {
                                                return svc;
                                            }
                                        }
                                        return SERVICE_ICONS.find(s => s.id === 'custom')!;
                                    };
                                    const config = getServiceConfig(link.label);
                                    return (
                                        <div
                                            key={link.id}
                                            className="link-row"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                padding: '0.5rem 0.5rem',
                                                borderRadius: '0.375rem',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#f3f4f6';
                                                const actions = e.currentTarget.querySelector('.link-actions') as HTMLElement;
                                                if (actions) actions.style.opacity = '1';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'transparent';
                                                const actions = e.currentTarget.querySelector('.link-actions') as HTMLElement;
                                                if (actions) actions.style.opacity = '0';
                                            }}
                                        >
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                                            >
                                                <div style={{
                                                    width: '1.75rem',
                                                    height: '1.75rem',
                                                    background: 'white',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '0.375rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                }}>
                                                    <ServiceIconImage type={config.id} size={14} />
                                                </div>
                                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>{link.label}</span>
                                            </a>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
                                                {/* Edit/Delete actions - visible on hover */}
                                                {isAdmin && (
                                                    <div
                                                        className="link-actions"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.125rem',
                                                            opacity: 0,
                                                            transition: 'opacity 0.15s',
                                                        }}
                                                    >
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditLink && onEditLink(link); }}
                                                            style={{
                                                                background: '#f3f4f6',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '0.25rem',
                                                                borderRadius: '0.25rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                            title="Edit"
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" style={{ width: '0.875rem', height: '0.875rem' }}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteLink(link.id, link.label); }}
                                                            style={{
                                                                background: '#f3f4f6',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '0.25rem',
                                                                borderRadius: '0.25rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                            title="Delete"
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" style={{ width: '0.875rem', height: '0.875rem' }}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                                No links added yet.
                                {isAdmin && (
                                    <button onClick={onAddLink} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', fontSize: '0.875rem', fontWeight: 500 }}>Add one</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Infrastructure Card */}
                    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: 0 }}>Infrastructure</h3>
                            {isAdmin && service.project_id && (
                                <button
                                    onClick={onMapResource}
                                    style={{
                                        padding: '0.375rem 0.75rem',
                                        background: 'white',
                                        border: '1px dashed #d1d5db',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.813rem',
                                        fontWeight: 500,
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                    }}
                                >
                                    + Map Resource
                                </button>
                            )}
                        </div>

                        {(service.mapped_resources && service.mapped_resources.length > 0) ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                                {service.mapped_resources.map((resource) => (
                                    <div
                                        key={resource.id}
                                        onClick={() => router.push(`/resources?type=${resource.resource_type}&name=${resource.resource_name}&region=${resource.region || 'ap-south-1'}`)}
                                        style={{
                                            background: '#f9fafb',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.5rem',
                                            padding: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#10b981';
                                            e.currentTarget.style.background = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.background = '#f9fafb';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ fontSize: '1.25rem' }}>
                                                {RESOURCE_ICONS[resource.resource_type || ''] || '📦'}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{resource.resource_name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{resource.resource_type}</div>
                                            </div>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUnmapResource(resource.discovered_resource_id, resource.resource_name || 'Resource');
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#9ca3af',
                                                    padding: '0.25rem',
                                                }}
                                            >
                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                padding: '2rem',
                                textAlign: 'center',
                                background: '#f9fafb',
                                border: '1px dashed #e5e7eb',
                                borderRadius: '0.75rem',
                                color: '#6b7280',
                                fontSize: '0.875rem'
                            }}>
                                No infrastructure resources mapped to this service.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Sidebar */}
                <div>
                    {/* Metadata Card */}
                    <SidebarCard title="Metadata">
                        <MetadataItem
                            label="Language"
                            value={service.language}
                            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
                        />
                        <div style={{ height: '1px', background: '#f3f4f6', margin: '0.25rem 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Service Owner
                                {isAdmin && (
                                    <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, marginLeft: '0.25rem', display: 'flex', alignItems: 'center' }} title="Edit">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{service.owner}</div>
                        </div>
                        <div style={{ height: '1px', background: '#f3f4f6', margin: '0.25rem 0' }} />
                        <MetadataItem
                            label="Environment"
                            value={<span className={`badge badge-${(service.environment || 'production').toLowerCase()}`}>{service.environment || 'Production'}</span>}
                            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        />
                        <div style={{ height: '1px', background: '#f3f4f6', margin: '0.25rem 0' }} />
                        <MetadataItem
                            label="Created"
                            value={formatDate(service.created_at)}
                            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                        />
                    </SidebarCard>

                    {/* Tags Card */}
                    {service.tags && service.tags.length > 0 && (
                        <SidebarCard title="Tags">
                            <div className={styles.tags}>
                                {service.tags.map((tag) => (
                                    <span key={tag} className="tag">#{tag}</span>
                                ))}
                            </div>
                        </SidebarCard>
                    )}
                </div>
            </div>
        </div>
    );
}


// Logs Tab Component with ArgoCD Integration
function LogsTab({ service, currentUser }: { service: Service; currentUser: User | null }) {
    const [linkedApps, setLinkedApps] = useState<ServiceArgoCDApp[]>([]);
    const [selectedEnv, setSelectedEnv] = useState<string>('');
    const [pods, setPods] = useState<ArgoCDPod[]>([]);
    const [selectedPod, setSelectedPod] = useState<string>('');
    const [selectedContainer, setSelectedContainer] = useState<string>('');
    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [wrapLines, setWrapLines] = useState(true);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    useEffect(() => {
        loadLinkedApps();
    }, [service.id]);

    useEffect(() => {
        if (selectedEnv) {
            loadPods();
        }
    }, [selectedEnv]);

    // Update selected container when pod changes
    useEffect(() => {
        if (selectedPod && pods.length > 0) {
            const pod = pods.find(p => p.name === selectedPod);
            if (pod && pod.containers && pod.containers.length > 0) {
                // Auto-select the first container
                setSelectedContainer(pod.containers[0]);
            } else {
                setSelectedContainer('');
            }
        }
    }, [selectedPod, pods]);

    useEffect(() => {
        if (selectedPod && selectedContainer) {
            loadLogs();
        }
    }, [selectedPod, selectedContainer]);

    useEffect(() => {
        if (!autoRefresh || !selectedPod) return;
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, selectedPod, selectedContainer]);

    const loadLinkedApps = async () => {
        try {
            const apps = await fetchServiceArgoCDApps(service.id);
            setLinkedApps(apps || []);
            if (apps && apps.length > 0) {
                setSelectedEnv(apps[0].environment_name);
            }
        } catch (error) {
            console.error('Failed to load linked apps:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPods = async () => {
        const app = linkedApps.find(a => a.environment_name === selectedEnv);
        if (!app) return;
        try {
            const podList = await fetchArgoCDAppPods(app.argocd_app_name);
            setPods(podList || []);
            if (podList && podList.length > 0) {
                const firstPod = podList[0];
                setSelectedPod(firstPod.name);
                if (firstPod.containers && firstPod.containers.length > 0) {
                    setSelectedContainer(firstPod.containers[0]);
                    // Auto-load logs for first pod/container
                    loadLogsForPod(app.argocd_app_name, firstPod.name, firstPod.namespace, firstPod.containers[0]);
                }
            }
        } catch (error) {
            console.error('Failed to load pods:', error);
            setPods([]);
        }
    };

    const loadLogsForPod = async (appName: string, podName: string, namespace: string, container: string) => {
        setLogsLoading(true);
        try {
            const logContent = await fetchArgoCDPodLogs(appName, podName, namespace, container);
            setLogs(logContent);
        } catch (error) {
            console.error('Failed to load logs:', error);
            setLogs('Failed to load logs');
        } finally {
            setLogsLoading(false);
        }
    };

    const loadLogs = async () => {
        const app = linkedApps.find(a => a.environment_name === selectedEnv);
        const pod = pods.find(p => p.name === selectedPod);
        if (!app || !pod) return;

        setLogsLoading(true);
        try {
            const logContent = await fetchArgoCDPodLogs(app.argocd_app_name, pod.name, pod.namespace, selectedContainer);
            setLogs(logContent);
        } catch (error) {
            console.error('Failed to load logs:', error);
            setLogs('Failed to load logs');
        } finally {
            setLogsLoading(false);
        }
    };


    // Helper function to find and format JSON in content using balanced brace counting
    const formatJsonInContent = (content: string): string => {
        if (!content) return content;

        let result = '';
        let i = 0;

        while (i < content.length) {
            const char = content[i];

            // Check for start of JSON object or array
            if (char === '{' || char === '[') {
                const start = i;
                const openChar = char;
                const closeChar = char === '{' ? '}' : ']';
                let depth = 1;
                let j = i + 1;
                let inString = false;
                let escape = false;

                // Find matching closing brace
                while (j < content.length && depth > 0) {
                    const c = content[j];

                    if (!escape && c === '"') {
                        inString = !inString;
                    } else if (!inString && !escape) {
                        if (c === openChar) depth++;
                        else if (c === closeChar) depth--;
                    }

                    if (c === '\\' && !escape) escape = true;
                    else escape = false;

                    j++;
                }

                if (depth === 0) {
                    // Found a balanced chunk
                    const candidate = content.substring(start, j);
                    try {
                        const parsed = JSON.parse(candidate);
                        // It's valid JSON, format it
                        result += '\n' + JSON.stringify(parsed, null, 2) + '\n';
                        i = j; // Advance past this chunk
                        continue;
                    } catch (e) {
                        // Not valid JSON, just append the character and continue
                    }
                }
            }

            result += char;
            i++;
        }

        return result;
    };

    // Parse log lines - aggregate lines that don't start with a timestamp
    const parseLogLines = (logText: string) => {
        if (!logText) return [];

        // Split by newline first to process line by line
        const rawLines = logText.split('\n');
        const timestampRegex = /^\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;

        const aggregatedEntries: { timestamp: string | null, content: string, raw: string }[] = [];
        let currentEntry: { timestamp: string | null, content: string, raw: string } | null = null;

        for (const line of rawLines) {
            if (!line.trim()) continue;

            const match = line.match(timestampRegex);

            if (match) {
                // Start of a new log entry
                if (currentEntry) {
                    aggregatedEntries.push(currentEntry);
                }

                // Extract content (everything after the full match)
                const timestamp = match[1];
                const content = line.substring(match[0].length).trim();

                currentEntry = {
                    timestamp,
                    content,
                    raw: line
                };
            } else {
                // Continuation of previous entry or start of a non-timestamped entry
                if (currentEntry) {
                    currentEntry.content += '\n' + line;
                    currentEntry.raw += '\n' + line;
                } else {
                    // First line has no timestamp
                    currentEntry = {
                        timestamp: null,
                        content: line,
                        raw: line
                    };
                }
            }
        }

        // Push the last entry
        if (currentEntry) {
            aggregatedEntries.push(currentEntry);
        }

        return aggregatedEntries.map((entry, index) => {
            return {
                lineNumber: index + 1,
                timestamp: entry.timestamp,
                content: formatJsonInContent(entry.content),
                raw: entry.raw
            };
        });
    };

    // Memoize parsed log lines to avoid re-parsing on every render
    const logLines = useMemo(() => parseLogLines(logs), [logs]);

    // Debounced search filter
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 150); // 150ms debounce for responsive feel
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset match index when search changes
    useEffect(() => {
        setCurrentMatchIndex(0);
    }, [debouncedSearch]);

    // Memoize filtered lines
    const filteredLines = useMemo(() => {
        if (!debouncedSearch) return logLines;
        const lowerSearch = debouncedSearch.toLowerCase();
        return logLines.filter(line => line.raw.toLowerCase().includes(lowerSearch));
    }, [logLines, debouncedSearch]);

    const matchCount = debouncedSearch ? filteredLines.length : 0;

    // Navigate to next/previous match
    const goToNextMatch = () => {
        if (matchCount > 0) {
            const nextIndex = (currentMatchIndex + 1) % matchCount;
            setCurrentMatchIndex(nextIndex);
            scrollToMatch(nextIndex);
        }
    };

    const goToPrevMatch = () => {
        if (matchCount > 0) {
            const prevIndex = (currentMatchIndex - 1 + matchCount) % matchCount;
            setCurrentMatchIndex(prevIndex);
            scrollToMatch(prevIndex);
        }
    };

    const scrollToMatch = (index: number) => {
        const matchElement = document.getElementById(`log-line-${filteredLines[index]?.lineNumber}`);
        if (matchElement) {
            matchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // Highlight search matches in text - optimized
    const highlightText = (text: string, query: string, isCurrentMatch: boolean) => {
        if (!query || !text) return text;
        try {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
            return parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} style={{
                        background: isCurrentMatch ? '#f59e0b' : '#fef3c7',
                        color: '#000',
                        padding: '0 2px',
                        borderRadius: '2px',
                        fontWeight: isCurrentMatch ? 600 : 400,
                    }}>{part}</mark>
                    : part
            );
        } catch {
            return text;
        }
    };

    if (loading) {
        return <div className={styles.tabContent}><p>Loading...</p></div>;
    }

    if (linkedApps.length === 0) {
        return (
            <div className={styles.tabContent}>
                <h2 className={styles.sectionTitle}>Application Logs</h2>
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '0.75rem', color: '#6b7280' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No ArgoCD environments configured.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Go to the Deployments tab to link an ArgoCD application.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Application Logs</h2>

            {/* Environment Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                {linkedApps.map(app => (
                    <button
                        key={app.id}
                        onClick={() => setSelectedEnv(app.environment_name)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem 0.375rem 0 0',
                            border: 'none',
                            background: selectedEnv === app.environment_name ? '#3b82f6' : '#f3f4f6',
                            color: selectedEnv === app.environment_name ? 'white' : '#374151',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        {app.environment_name}
                    </button>
                ))}
            </div>



            {/* Controls Row 1: Pod and Container Selection */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                    <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Pod</label>
                    <CustomDropdown
                        value={selectedPod}
                        onChange={(value) => setSelectedPod(value)}
                        options={pods.map(pod => ({ value: pod.name, label: pod.name }))}
                        placeholder="Select Pod"
                        disabled={pods.length === 0}
                    />
                </div>
                <div>
                    <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Container</label>
                    <CustomDropdown
                        value={selectedContainer}
                        onChange={(value) => setSelectedContainer(value)}
                        options={pods.find(p => p.name === selectedPod)?.containers?.map(c => ({ value: c, label: c })) || []}
                        placeholder="Select Container"
                        disabled={!selectedPod}
                    />
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={loadLogs}
                        disabled={logsLoading || !selectedPod || !selectedContainer}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                        }}
                    >
                        <svg
                            style={{
                                width: '1rem',
                                height: '1rem',
                                animation: logsLoading ? 'spin 1s linear infinite' : 'none',
                            }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {logsLoading ? 'Loading...' : 'Refresh'}
                    </button>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: autoRefresh ? '#10b981' : '#f3f4f6',
                            color: autoRefresh ? 'white' : '#374151',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                        }}
                    >
                        {autoRefresh ? '⏸ Stop' : '▶ Auto'}
                    </button>
                </div>
            </div>

            {/* Controls Row 2: Search and Display Options */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.5rem 1rem 0.5rem 2.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                        }}
                    />
                    <svg
                        style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '1rem',
                            height: '1rem',
                            color: '#9ca3af',
                        }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {debouncedSearch && matchCount > 0 && (
                        <div style={{
                            position: 'absolute',
                            right: '0.5rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                        }}>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: '0.25rem' }}>
                                {currentMatchIndex + 1}/{matchCount}
                            </span>
                            <button
                                onClick={goToPrevMatch}
                                style={{
                                    padding: '0.125rem 0.375rem',
                                    background: '#f3f4f6',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    color: '#374151',
                                }}
                                title="Previous match (↑)"
                            >
                                ↑
                            </button>
                            <button
                                onClick={goToNextMatch}
                                style={{
                                    padding: '0.125rem 0.375rem',
                                    background: '#f3f4f6',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    color: '#374151',
                                }}
                                title="Next match (↓)"
                            >
                                ↓
                            </button>
                        </div>
                    )}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={wrapLines}
                        onChange={(e) => setWrapLines(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    Wrap
                </label>
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        style={{
                            padding: '0.25rem 0.5rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                        }}
                    >
                        Clear filter
                    </button>
                )}
            </div>

            {/* Log Viewer */}
            <div style={{
                background: '#ffffff',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
            }}>
                {/* Log Header */}
                <div style={{
                    background: '#f9fafb',
                    padding: '0.5rem 1rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 500 }}>
                        📋 {selectedPod} / {selectedContainer}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                        {filteredLines.length} lines {debouncedSearch && `(filtered from ${logLines.length})`}
                    </span>
                </div>

                {/* Log Content - displays with newest at bottom */}
                <div
                    id="log-container"
                    style={{
                        height: '600px',
                        overflow: 'auto',
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
                        fontSize: '0.8125rem',
                        lineHeight: '1.6',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                    ref={(el) => {
                        // Auto-scroll to bottom when logs change (newest logs at bottom)
                        if (el && !debouncedSearch) {
                            el.scrollTop = el.scrollHeight;
                        }
                    }}
                >
                    {filteredLines.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {logs ? 'No matching lines found.' : 'No logs available. Select a pod and container.'}
                        </div>
                    ) : (
                        <div style={{ marginTop: 'auto' }}>
                            {filteredLines.map((line, index) => {
                                const isCurrentMatch = Boolean(debouncedSearch) && index === currentMatchIndex;
                                return (
                                    <div
                                        key={line.lineNumber}
                                        id={`log-line-${line.lineNumber}`}
                                        style={{
                                            display: 'flex',
                                            borderBottom: '1px solid #f3f4f6',
                                            background: isCurrentMatch
                                                ? '#fcd34d'
                                                : (debouncedSearch && line.raw.toLowerCase().includes(debouncedSearch.toLowerCase())
                                                    ? '#fef3c7'
                                                    : 'transparent'),
                                        }}
                                    >

                                        {line.timestamp && (
                                            <div style={{
                                                padding: '0.25rem 0.75rem',
                                                color: '#6366f1',
                                                whiteSpace: 'nowrap',
                                                fontWeight: 500,
                                                flexShrink: 0,
                                            }}>
                                                {line.timestamp}
                                            </div>
                                        )}
                                        <div style={{
                                            padding: '0.25rem 0.75rem',
                                            color: '#374151',
                                            whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                                            wordBreak: wrapLines ? 'break-word' : 'normal',
                                            flex: 1,
                                        }}>
                                            {debouncedSearch ? highlightText(line.content, debouncedSearch, isCurrentMatch) : line.content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Deployments Tab Component with ArgoCD Integration
function DeploymentsTab({ service, currentUser }: { service: Service; currentUser: User | null }) {
    const [linkedApps, setLinkedApps] = useState<ServiceArgoCDApp[]>([]);
    const [allApps, setAllApps] = useState<ArgoCDApplication[]>([]);
    const [selectedEnv, setSelectedEnv] = useState<string>('');
    const [appStatus, setAppStatus] = useState<ArgoCDApplication | null>(null);
    const [pods, setPods] = useState<ArgoCDPod[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEnvName, setNewEnvName] = useState('');
    const [newAppName, setNewAppName] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [argocdBaseUrl, setArgocdBaseUrl] = useState<string>('');

    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [podToDelete, setPodToDelete] = useState<ArgoCDPod | null>(null);

    // Remove environment modal state
    const [showRemoveEnvModal, setShowRemoveEnvModal] = useState(false);
    const [envToRemove, setEnvToRemove] = useState<{ appId: string; envName: string } | null>(null);

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const isAdmin = currentUser?.role === 'lead' || currentUser?.role === 'superadmin';

    useEffect(() => {
        loadLinkedApps();
        loadArgocdConfig();
    }, [service.id]);

    const loadArgocdConfig = async () => {
        try {
            const config = await fetchArgoCDConfig();
            if (config.base_url) {
                setArgocdBaseUrl(config.base_url);
            }
        } catch (error) {
            console.error('Failed to load ArgoCD config:', error);
        }
    };

    useEffect(() => {
        if (selectedEnv) {
            loadAppDetails();
        }
    }, [selectedEnv, linkedApps]);

    const loadLinkedApps = async () => {
        try {
            const apps = await fetchServiceArgoCDApps(service.id);
            setLinkedApps(apps || []);
            if (apps && apps.length > 0) {
                setSelectedEnv(apps[0].environment_name);
            }
        } catch (error) {
            console.error('Failed to load linked apps:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAppDetails = async () => {
        const app = linkedApps.find(a => a.environment_name === selectedEnv);
        if (!app) return;

        setActionLoading('refresh');
        try {
            const [status, podList] = await Promise.all([
                fetchArgoCDAppStatus(app.argocd_app_name),
                fetchArgoCDAppPods(app.argocd_app_name),
            ]);
            setAppStatus(status);
            setPods(podList || []);
        } catch (error) {
            console.error('Failed to load app details:', error);
            showToast('Failed to refresh application status', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const loadAllApps = async () => {
        try {
            const apps = await fetchArgoCDApplications();
            console.log('Fetched apps:', apps);
            if (!apps || apps.length === 0) {
                showToast('No ArgoCD applications found', 'error');
            } else {
                showToast(`Found ${apps.length} ArgoCD applications`, 'success');
            }
            setAllApps(apps || []);
        } catch (error) {
            console.error('Failed to load ArgoCD apps:', error);
            showToast('Failed to load ArgoCD apps: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
    };

    const handleAddEnvironment = async () => {
        if (!newEnvName || !newAppName) return;
        setAddLoading(true);
        try {
            await linkArgoCDApp(service.id, newAppName, newEnvName);
            await loadLinkedApps();
            setShowAddModal(false);
            setNewEnvName('');
            setNewAppName('');
        } catch (error) {
            console.error('Failed to link app:', error);
            showToast('Failed to link ArgoCD application', 'error');
        } finally {
            setAddLoading(false);
        }
    };

    // Request to remove environment (shows confirmation modal)
    const requestRemoveEnvironment = (appId: string, envName: string) => {
        setEnvToRemove({ appId, envName });
        setShowRemoveEnvModal(true);
    };

    // Actually remove the environment after confirmation
    const confirmRemoveEnvironment = async () => {
        if (!envToRemove) return;
        setShowRemoveEnvModal(false);
        try {
            await unlinkArgoCDApp(service.id, envToRemove.appId);
            await loadLinkedApps();
            if (selectedEnv === envToRemove.envName && linkedApps.length > 1) {
                setSelectedEnv(linkedApps.find(a => a.environment_name !== envToRemove.envName)?.environment_name || '');
            }
            showToast('Environment removed successfully', 'success');
        } catch (error) {
            console.error('Failed to unlink app:', error);
            showToast('Failed to remove environment', 'error');
        } finally {
            setEnvToRemove(null);
        }
    };

    const handleSync = async () => {
        const app = linkedApps.find(a => a.environment_name === selectedEnv);
        if (!app) return;
        setActionLoading('sync');
        try {
            await syncArgoCDApp(app.argocd_app_name);
            showToast('Sync initiated successfully', 'success');
            setTimeout(loadAppDetails, 2000);
        } catch (error) {
            console.error('Failed to sync:', error);
            showToast('Failed to sync application', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    // Show toast notification
    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Request to delete pod (shows confirmation modal)
    const requestDeletePod = (pod: ArgoCDPod) => {
        setPodToDelete(pod);
        setShowDeleteModal(true);
    };

    // Actually delete the pod after confirmation
    const confirmDeletePod = async () => {
        if (!podToDelete) return;
        const app = linkedApps.find(a => a.environment_name === selectedEnv);
        if (!app) return;

        setShowDeleteModal(false);
        setActionLoading(podToDelete.name);

        try {
            await deleteArgoCDPod(app.argocd_app_name, podToDelete.name, podToDelete.namespace);
            showToast('Pod deleted. It will be recreated shortly.', 'success');
            setTimeout(loadAppDetails, 2000);
        } catch (error) {
            console.error('Failed to delete pod:', error);
            showToast('Failed to delete pod', 'error');
        } finally {
            setActionLoading(null);
            setPodToDelete(null);
        }
    };

    const getHealthColor = (health: string) => {
        switch (health?.toLowerCase()) {
            case 'healthy': return '#10b981';
            case 'progressing': return '#3b82f6';
            case 'degraded': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getSyncColor = (sync: string) => {
        switch (sync?.toLowerCase()) {
            case 'synced': return '#10b981';
            case 'outofsync': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return <div className={styles.tabContent}><p>Loading...</p></div>;
    }

    return (
        <div className={styles.tabContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Deployment Status</h2>
                {isAdmin && (
                    <button
                        onClick={() => { setShowAddModal(true); loadAllApps(); }}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}
                    >
                        <span>+</span> Add Environment
                    </button>
                )}
            </div>

            {linkedApps.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '0.75rem', color: '#6b7280' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <p>No ArgoCD environments configured.</p>
                    {isAdmin && <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Click "+ Add Environment" to link an ArgoCD application.</p>}
                </div>
            ) : (
                <>
                    {/* Environment Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                        {linkedApps.map(app => (
                            <div key={app.id} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setSelectedEnv(app.environment_name)}
                                    style={{
                                        padding: '0.5rem 1.5rem',
                                        borderRadius: '0.375rem 0.375rem 0 0',
                                        border: 'none',
                                        background: selectedEnv === app.environment_name ? '#3b82f6' : '#f3f4f6',
                                        color: selectedEnv === app.environment_name ? 'white' : '#374151',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {app.environment_name}
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={() => requestRemoveEnvironment(app.id, app.environment_name)}
                                        style={{
                                            position: 'absolute',
                                            top: '-0.25rem',
                                            right: '-0.25rem',
                                            width: '1rem',
                                            height: '1rem',
                                            borderRadius: '50%',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            fontSize: '0.625rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Status Card */}
                    {appStatus && (
                        <div style={{
                            display: 'flex',
                            gap: '2rem',
                            padding: '1rem 1.5rem',
                            background: 'white',
                            borderRadius: '0.75rem',
                            border: '1px solid #e5e7eb',
                            marginBottom: '1.5rem',
                            alignItems: 'center',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: getHealthColor(appStatus.health) }} />
                                <span style={{ fontWeight: 500 }}>Health:</span>
                                <span style={{ color: getHealthColor(appStatus.health) }}>{appStatus.health || 'Unknown'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: getSyncColor(appStatus.sync_status) }} />
                                <span style={{ fontWeight: 500 }}>Sync:</span>
                                <span style={{ color: getSyncColor(appStatus.sync_status) }}>{appStatus.sync_status || 'Unknown'}</span>
                            </div>
                            {appStatus.revision && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: '#f3f4f6', // Matches .cancelButton background
                                    border: '1px solid #e5e7eb', // Matches .cancelButton border
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '0.5rem', // Matches .cancelButton radius
                                    color: '#374151', // Matches .cancelButton color
                                }}>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '0.875rem', height: '0.875rem', color: '#6b7280' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Version:</span>
                                    <code style={{
                                        fontSize: '0.75rem',
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                        fontWeight: 600,
                                    }}>
                                        {appStatus.revision}
                                    </code>
                                </div>
                            )}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                                {isAdmin && (
                                    <button
                                        onClick={handleSync}
                                        disabled={actionLoading === 'sync'}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            cursor: 'pointer',
                                            opacity: actionLoading === 'sync' ? 0.6 : 1,
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                        }}
                                    >
                                        {actionLoading === 'sync' ? 'Syncing...' : '↻ Sync'}
                                    </button>
                                )}
                                <button
                                    onClick={loadAppDetails}
                                    disabled={actionLoading === 'refresh'}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.375rem',
                                        cursor: 'pointer',
                                        opacity: actionLoading === 'refresh' ? 0.6 : 1,
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                    }}
                                >
                                    {actionLoading === 'refresh' ? 'Refreshing...' : '↻ Refresh'}
                                </button>
                                {argocdBaseUrl && appStatus && (
                                    <a
                                        href={`${argocdBaseUrl}/applications/${appStatus.name}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            cursor: 'pointer',
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.375rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                        }}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        View in ArgoCD
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pods Table */}
                    <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                            Pods ({pods.length})
                        </div>
                        {pods.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No pods found</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Name</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Ready</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Restarts</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Age</th>
                                        {isAdmin && <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pods.map(pod => (
                                        <tr key={pod.name} style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>{pod.name}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 500,
                                                    background: pod.status?.toLowerCase() === 'running' || pod.status?.toLowerCase() === 'healthy' ? '#dcfce7' : pod.status?.toLowerCase() === 'progressing' ? '#dbeafe' : '#fef2f2',
                                                    color: pod.status?.toLowerCase() === 'running' || pod.status?.toLowerCase() === 'healthy' ? '#166534' : pod.status?.toLowerCase() === 'progressing' ? '#1e40af' : '#991b1b',
                                                }}>
                                                    {pod.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{pod.ready}</td>
                                            <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{pod.restarts}</td>
                                            <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{pod.age}</td>
                                            {isAdmin && (
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => requestDeletePod(pod)}
                                                        disabled={actionLoading === pod.name}
                                                        style={{
                                                            padding: '0.25rem 0.5rem',
                                                            background: '#fee2e2',
                                                            color: '#dc2626',
                                                            border: 'none',
                                                            borderRadius: '0.25rem',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            opacity: actionLoading === pod.name ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {actionLoading === pod.name ? '...' : 'Delete'}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {/* Add Environment Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '28rem',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Link ArgoCD Application</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Environment Name *</label>
                            <input
                                type="text"
                                value={newEnvName}
                                onChange={(e) => setNewEnvName(e.target.value)}
                                placeholder="e.g., Production, Staging, Dev"
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                            />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>ArgoCD Application *</label>
                            <CustomDropdown
                                value={newAppName}
                                onChange={(value) => setNewAppName(value)}
                                options={[
                                    { value: '', label: 'Select an application...' },
                                    ...allApps.map(app => ({
                                        value: app.name,
                                        label: `${app.name} (${app.health})`
                                    }))
                                ]}
                                placeholder="Select an application..."
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                                onClick={() => setShowAddModal(false)}
                                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddEnvironment}
                                disabled={addLoading || !newEnvName || !newAppName}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    opacity: addLoading || !newEnvName || !newAppName ? 0.6 : 1,
                                }}
                            >
                                {addLoading ? 'Linking...' : 'Link Application'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Pod Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                title="Delete Pod"
                message="Are you sure you want to delete this pod?"
                resourceName={podToDelete?.name}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={confirmDeletePod}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setPodToDelete(null);
                }}
                loading={!!actionLoading}
            />

            {/* Remove Environment Confirmation Modal */}
            <ConfirmationModal
                isOpen={showRemoveEnvModal}
                title="Remove Environment"
                message="Are you sure you want to remove this environment?"
                resourceName={envToRemove?.envName}
                confirmLabel="Remove"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={confirmRemoveEnvironment}
                onCancel={() => {
                    setShowRemoveEnvModal(false);
                    setEnvToRemove(null);
                }}
            />

            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '1.5rem',
                    right: '1.5rem',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white',
                    fontWeight: 500,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}>
                    {toast.type === 'success' ? '✓' : '✗'} {toast.message}
                </div>
            )}
        </div>
    );
}


// Monitoring Tab Component
function MonitoringTab({ service }: { service: Service }) {
    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Monitoring Dashboard</h2>
            {service.grafana_url ? (
                <GrafanaFrame
                    url={service.grafana_url}
                    title={`${service.name} Monitoring`}
                    height="700px"
                />
            ) : (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '0.75rem', color: '#6b7280' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>No Grafana dashboard configured for this service.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Configure a Grafana URL to view metrics.</p>
                </div>
            )}
        </div>
    );
}

// Documentation Tab Component
function DocumentationTab({ service }: { service: Service }) {
    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Documentation</h2>
            {service.confluence_url ? (
                <ConfluenceFrame
                    url={service.confluence_url}
                    title={`${service.name} Documentation`}
                    height="700px"
                />
            ) : (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '0.75rem', color: '#6b7280' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p>No Confluence documentation linked for this service.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Configure a Confluence URL to view documentation.</p>
                </div>
            )}
        </div>
    );
}
