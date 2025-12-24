'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { fetchServices } from '@/lib/api';
import { Service } from '@/lib/types';
import GrafanaFrame from '@/components/integrations/GrafanaFrame';
import ConfluenceFrame from '@/components/integrations/ConfluenceFrame';
import styles from './page.module.css';

type TabType = 'overview' | 'runs' | 'audit-log' | 'readme' | 'monitoring' | 'documentation' | 'packages';

export default function ServiceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [service, setService] = useState<Service | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadService();
    }, [params.id]);

    const loadService = async () => {
        try {
            const services = await fetchServices();
            const found = services.find(s => s.id === params.id);
            if (found) {
                setService(found);
            }
        } catch (error) {
            console.error('Failed to load service:', error);
        } finally {
            setLoading(false);
        }
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
        { id: 'runs' as TabType, label: 'Runs' },
        { id: 'audit-log' as TabType, label: 'Audit Log' },
        { id: 'readme' as TabType, label: 'README' },
        { id: 'monitoring' as TabType, label: 'Monitoring' },
        { id: 'documentation' as TabType, label: 'Documentation' },
        { id: 'packages' as TabType, label: 'Packages' },
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
                                <p className={styles.subtitle}>{service.team}</p>
                            </div>
                        </div>
                        <div className={styles.headerRight}>
                            <span className={`badge badge-${service.environment.toLowerCase()}`}>
                                {service.environment}
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
                        {activeTab === 'overview' && <OverviewTab service={service} />}
                        {activeTab === 'runs' && <RunsTab service={service} />}
                        {activeTab === 'audit-log' && <AuditLogTab service={service} />}
                        {activeTab === 'readme' && <ReadmeTab service={service} />}
                        {activeTab === 'monitoring' && (
                            <MonitoringTab service={service} />
                        )}
                        {activeTab === 'documentation' && (
                            <DocumentationTab service={service} />
                        )}
                        {activeTab === 'packages' && <PackagesTab service={service} />}
                    </div>
                </div>
            </main>
        </>
    );
}

// Overview Tab Component
function OverviewTab({ service }: { service: Service }) {
    return (
        <div className={styles.tabContent}>
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Details</h2>
                <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Identifier</span>
                        <span className={styles.detailValue}>{service.id}</span>
                    </div>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Title</span>
                        <span className={styles.detailValue}>{service.name}</span>
                    </div>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Team</span>
                        <span className={styles.detailValue}>{service.team}</span>
                    </div>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Owner</span>
                        <span className={styles.detailValue}>{service.owner}</span>
                    </div>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Language</span>
                        <span className={styles.detailValue}>{service.language}</span>
                    </div>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Environment</span>
                        <span className={styles.detailValue}>{service.environment}</span>
                    </div>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Created</span>
                        <span className={styles.detailValue}>
                            {new Date(service.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Last Updated</span>
                        <span className={styles.detailValue}>
                            {new Date(service.updated_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Description</h2>
                <p className={styles.description}>{service.description}</p>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Repository</h2>
                <a href={service.repository} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    {service.repository}
                </a>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Tags</h2>
                <div className={styles.tags}>
                    {service.tags.map((tag) => (
                        <span key={tag} className="tag">#{tag}</span>
                    ))}
                </div>
            </section>
        </div>
    );
}

// Runs Tab Component
function RunsTab({ service }: { service: Service }) {
    const mockRuns = [
        { id: 1, status: 'success', commit: 'abc1234', branch: 'main', time: '2 hours ago' },
        { id: 2, status: 'success', commit: 'def5678', branch: 'main', time: '5 hours ago' },
        { id: 3, status: 'failed', commit: 'ghi9012', branch: 'develop', time: '1 day ago' },
    ];

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Deployment History</h2>
            <div className={styles.runsList}>
                {mockRuns.map((run) => (
                    <div key={run.id} className={styles.runItem}>
                        <div className={styles.runStatus}>
                            <span className={`${styles.statusDot} ${styles[`status-${run.status}`]}`}></span>
                            <span className={styles.statusText}>{run.status}</span>
                        </div>
                        <div className={styles.runDetails}>
                            <span className={styles.runCommit}>{run.commit}</span>
                            <span className={styles.runBranch}>{run.branch}</span>
                        </div>
                        <div className={styles.runTime}>{run.time}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Audit Log Tab Component
function AuditLogTab({ service }: { service: Service }) {
    const mockLogs = [
        { id: 1, action: 'Service updated', user: 'john.doe', time: '2 hours ago' },
        { id: 2, action: 'Configuration changed', user: 'jane.smith', time: '1 day ago' },
        { id: 3, action: 'Service created', user: 'admin', time: '7 days ago' },
    ];

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Activity Log</h2>
            <div className={styles.auditList}>
                {mockLogs.map((log) => (
                    <div key={log.id} className={styles.auditItem}>
                        <div className={styles.auditIcon}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className={styles.auditContent}>
                            <p className={styles.auditAction}>{log.action}</p>
                            <p className={styles.auditMeta}>by {log.user} • {log.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// README Tab Component
function ReadmeTab({ service }: { service: Service }) {
    return (
        <div className={styles.tabContent}>
            <div className={styles.readmeContent}>
                <h2># {service.name}</h2>
                <p>{service.description}</p>
                <h3>## Getting Started</h3>
                <p>This is a placeholder README. In production, this would be fetched from the service repository.</p>
                <pre className={styles.codeBlock}>
                    <code>{`git clone ${service.repository}\ncd ${service.id}\nnpm install\nnpm start`}</code>
                </pre>
            </div>
        </div>
    );
}

// Monitoring Tab Component
function MonitoringTab({ service }: { service: Service }) {
    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Grafana Dashboard</h2>
            <GrafanaFrame
                url={service.grafana_url || ''}
                title={`${service.name} Monitoring`}
                height="700px"
            />
        </div>
    );
}

// Documentation Tab Component
function DocumentationTab({ service }: { service: Service }) {
    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Confluence Documentation</h2>
            <ConfluenceFrame
                url={service.confluence_url || ''}
                title={`${service.name} Documentation`}
                height="700px"
            />
        </div>
    );
}

// Packages Tab Component
function PackagesTab({ service }: { service: Service }) {
    const mockPackages = [
        { name: service.team.replace('Team ', '') + ' Package', version: '1.2.3', team: service.team },
    ];

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Dependencies & Packages</h2>
            <div className={styles.packagesList}>
                {mockPackages.map((pkg, idx) => (
                    <div key={idx} className={styles.packageItem}>
                        <div className={styles.packageIcon}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <div className={styles.packageInfo}>
                            <h3 className={styles.packageName}>{pkg.name}</h3>
                            <p className={styles.packageMeta}>Version {pkg.version} • {pkg.team}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
