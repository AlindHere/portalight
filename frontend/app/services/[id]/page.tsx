'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { fetchServiceById, fetchCurrentUser, addServiceLink, deleteServiceLink, updateServiceLink, mapResourcesToService, unmapResourceFromService, fetchDiscoveredResources, fetchTeams, fetchUsers, fetchProjectById } from '@/lib/api';
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
    const [service, setService] = useState<Service | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
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
        { id: 'logs' as TabType, label: 'Logs' },
        { id: 'deployments' as TabType, label: 'Deployments' },
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
                                <button onClick={() => router.push(`/projects/${service.project_id}`)} className={styles.breadcrumbLink}>
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
                                onClick={() => setActiveTab(tab.id)}
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
                            />
                        )}
                        {activeTab === 'logs' && <LogsTab service={service} />}
                        {activeTab === 'deployments' && <DeploymentsTab service={service} />}
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
}

function OverviewTab({ service, isAdmin, onAddLink, onDeleteLink, onEditLink, onMapResource, onUnmapResource, onEdit, showTeamMembers, teamMembers, loadingMembers, handleShowTeamMembers }: OverviewTabProps) {
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
                                        style={{
                                            background: '#f9fafb',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.5rem',
                                            padding: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
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
                                                onClick={() => onUnmapResource(resource.discovered_resource_id, resource.resource_name || 'Resource')}
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


// Logs Tab Component
function LogsTab({ service }: { service: Service }) {
    const lokiUrl = service.loki_url || service.grafana_url;

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Application Logs</h2>
            {lokiUrl ? (
                <GrafanaFrame
                    url={lokiUrl}
                    title={`${service.name} Logs`}
                    height="700px"
                />
            ) : (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '0.75rem', color: '#6b7280' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No log viewer configured for this service.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Configure a Grafana/Loki URL to view logs.</p>
                </div>
            )}
        </div>
    );
}

// Deployments Tab Component
function DeploymentsTab({ service }: { service: Service }) {
    const argocdUrl = service.argocd_url;

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Deployment Status</h2>
            {argocdUrl ? (
                <div>
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#ecfdf5', borderRadius: '0.5rem', border: '1px solid #10b981' }}>
                        <strong>ArgoCD Application:</strong> {service.argocd_app_name || service.name}
                    </div>
                    <iframe
                        src={argocdUrl}
                        title={`${service.name} Deployments`}
                        style={{ width: '100%', height: '600px', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    />
                </div>
            ) : (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '0.75rem', color: '#6b7280' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <p>No ArgoCD integration configured for this service.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Configure an ArgoCD URL to view deployment status.</p>
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
