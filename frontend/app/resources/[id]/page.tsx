'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { fetchResourceById, fetchCurrentUser, fetchResourceMetrics, fetchProjectById, fetchAWSCredentials } from '@/lib/api';
import { DiscoveredResourceDB, User, Project, AWSCredential } from '@/lib/types';
import styles from './page.module.css';

const RESOURCE_ICONS: Record<string, string> = {
    s3: '🪣',
    sqs: '📨',
    sns: '🔔',
    rds: '🗄️',
    lambda: '⚡',
    dynamodb: '📊',
    ec2: '💻',
};

interface Metric {
    name: string;
    unit: string;
    datapoints: Array<{ timestamp: string; value: number }>;
}

export default function ResourceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const resourceIdentifier = params.id as string;

    const [resource, setResource] = useState<DiscoveredResourceDB | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<Metric[] | null>(null);
    const [loadingMetrics, setLoadingMetrics] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState('24h');
    const [credentials, setCredentials] = useState<AWSCredential[]>([]);

    useEffect(() => {
        loadData();
    }, [resourceIdentifier]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [resourceData, userData] = await Promise.all([
                fetchResourceById(resourceIdentifier),
                fetchCurrentUser(),
            ]);
            setResource(resourceData);
            setCurrentUser(userData.user);

            // Fetch project info if available
            if (resourceData.project_id) {
                try {
                    const projectData = await fetchProjectById(resourceData.project_id);
                    setProject(projectData);

                    // Fetch all credentials and filter for this project's secret
                    const allCreds = await fetchAWSCredentials();
                    const projectCreds = allCreds.filter((c: AWSCredential) => c.project_id === resourceData.project_id);
                    setCredentials(projectCreds || []);

                    // Load metrics using the first credential
                    if (projectCreds && projectCreds.length > 0) {
                        loadMetrics(resourceData, projectCreds[0].id, selectedPeriod);
                    }
                } catch (e) {
                    console.error('Failed to fetch project:', e);
                }
            }
        } catch (error) {
            console.error('Failed to load resource:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMetrics = async (res: DiscoveredResourceDB, secretId: string, period: string) => {
        setLoadingMetrics(true);
        try {
            const data = await fetchResourceMetrics({
                secret_id: secretId,
                resource_type: res.resource_type,
                resource_name: res.name,
                region: res.region,
                period: period,
            });
            setMetrics(data?.metrics || []);
        } catch (error) {
            console.error('Failed to load metrics:', error);
            setMetrics([]);
        } finally {
            setLoadingMetrics(false);
        }
    };

    const handlePeriodChange = (period: string) => {
        setSelectedPeriod(period);
        if (resource && credentials.length > 0) {
            loadMetrics(resource, credentials[0].id, period);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <Header />
                <main className={styles.main}>
                    <div className={styles.loading}>Loading resource...</div>
                </main>
            </div>
        );
    }

    if (!resource) {
        return (
            <div className={styles.container}>
                <Header />
                <main className={styles.main}>
                    <div className={styles.error}>Resource not found</div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Header />
            <main className={styles.main}>
                <div className={styles.contentWrapper}>
                    {/* Breadcrumb */}
                    <div className={styles.breadcrumb}>
                        <button onClick={() => router.push('/')} className={styles.breadcrumbLink}>
                            Home
                        </button>
                        <span className={styles.breadcrumbSeparator}>/</span>
                        {project && (
                            <>
                                <button onClick={() => router.push(`/projects/${project.name}`)} className={styles.breadcrumbLink}>
                                    {project.name}
                                </button>
                                <span className={styles.breadcrumbSeparator}>/</span>
                            </>
                        )}
                        <span className={styles.breadcrumbCurrent}>{resource.name}</span>
                    </div>

                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.headerInfo}>
                            <div className={styles.resourceIcon}>
                                {RESOURCE_ICONS[resource.resource_type] || '📦'}
                            </div>
                            <div>
                                <h1 className={styles.title}>{resource.name}</h1>
                                <div className={styles.subtitle}>
                                    <span className={styles.resourceType}>{resource.resource_type.toUpperCase()}</span>
                                    <span className={styles.separator}>•</span>
                                    <span className={styles.region}>{resource.region}</span>
                                    <span className={styles.separator}>•</span>
                                    <span className={`${styles.status} ${styles[resource.status]}`}>
                                        {resource.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Cards */}
                    <div className={styles.infoGrid}>
                        <div className={styles.infoCard}>
                            <h3>Resource Details</h3>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>ARN</span>
                                <span className={styles.infoValue} title={resource.arn}>{resource.arn}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Region</span>
                                <span className={styles.infoValue}>{resource.region}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Type</span>
                                <span className={styles.infoValue}>{resource.resource_type}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Discovered</span>
                                <span className={styles.infoValue}>
                                    {new Date(resource.discovered_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {project && (
                            <div className={styles.infoCard}>
                                <h3>Project</h3>
                                <div className={styles.projectInfo}>
                                    <span className={styles.projectName}>{project.name}</span>
                                    <p className={styles.projectDescription}>{project.description}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metrics Section */}
                    <div className={styles.metricsSection}>
                        <div className={styles.metricsHeader}>
                            <h2>Metrics</h2>
                            <div className={styles.periodSelector}>
                                {['1h', '6h', '24h', '7d'].map((period) => (
                                    <button
                                        key={period}
                                        className={`${styles.periodButton} ${selectedPeriod === period ? styles.periodButtonActive : ''}`}
                                        onClick={() => handlePeriodChange(period)}
                                    >
                                        {period}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loadingMetrics ? (
                            <div className={styles.metricsLoading}>Loading metrics...</div>
                        ) : metrics && metrics.length > 0 ? (
                            <div className={styles.metricsGrid}>
                                {metrics.map((metric, index) => (
                                    <div key={index} className={styles.metricCard}>
                                        <h4>{metric.name}</h4>
                                        <div className={styles.metricValue}>
                                            {metric.datapoints.length > 0
                                                ? `${metric.datapoints[metric.datapoints.length - 1].value.toFixed(2)} ${metric.unit}`
                                                : 'No data'}
                                        </div>
                                        <div className={styles.metricDatapoints}>
                                            {metric.datapoints.length} data points
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.noMetrics}>
                                {credentials.length === 0
                                    ? 'No AWS credentials configured for this project'
                                    : 'No metrics available for this resource'}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
