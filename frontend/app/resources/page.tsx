'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchAWSCredentials, fetchResourceMetrics, ResourceMetrics, MetricDataPoint } from '@/lib/api';
import { Secret } from '@/lib/types';
import styles from './page.module.css';

const RESOURCE_TYPE_INFO: Record<string, { icon: string; label: string; color: string }> = {
    s3: { icon: '🪣', label: 'S3 Bucket', color: '#FF9900' },
    sqs: { icon: '📨', label: 'SQS Queue', color: '#FF4F8B' },
    sns: { icon: '🔔', label: 'SNS Topic', color: '#DD344C' },
    rds: { icon: '🗄️', label: 'RDS Database', color: '#3B48CC' },
    lambda: { icon: '⚡', label: 'Lambda Function', color: '#FA7343' },
};

const METRIC_LABELS: Record<string, string> = {
    // RDS
    CPUUtilization: 'CPU Usage (%)',
    FreeableMemory: 'Freeable Memory',
    DatabaseConnections: 'Active Connections',
    ReadIOPS: 'Read IOPS',
    WriteIOPS: 'Write IOPS',
    // Lambda
    Invocations: 'Invocations',
    Duration: 'Duration (ms)',
    Errors: 'Errors',
    Throttles: 'Throttles',
    ConcurrentExecutions: 'Concurrent Executions',
    // S3
    BucketSizeBytes: 'Bucket Size',
    NumberOfObjects: 'Number of Objects',
    // SQS
    NumberOfMessagesSent: 'Messages Sent',
    NumberOfMessagesReceived: 'Messages Received',
    NumberOfMessagesDeleted: 'Messages Deleted',
    ApproximateNumberOfMessagesVisible: 'Visible Messages',
    ApproximateAgeOfOldestMessage: 'Oldest Message Age (s)',
};

function ResourceDetailsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const resourceType = searchParams.get('type') || '';
    const resourceName = searchParams.get('name') || '';
    const region = searchParams.get('region') || 'ap-south-1';

    const [credentials, setCredentials] = useState<Secret[]>([]);
    const [selectedCredential, setSelectedCredential] = useState<string>('');
    const [period, setPeriod] = useState<string>('24h');
    const [metrics, setMetrics] = useState<ResourceMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editSuccess, setEditSuccess] = useState<string | null>(null);

    // Editable resource types
    const editableTypes = ['s3', 'sqs', 'sns'];
    const canEdit = editableTypes.includes(resourceType);

    // Read initial tab from URL, default to 'details'
    const initialViewTab = searchParams.get('view') === 'metrics' ? 'metrics' : 'details';

    // Tab state
    const [activeTab, setActiveTab] = useState<'details' | 'metrics'>(initialViewTab);
    const [resourceDetails, setResourceDetails] = useState<Record<string, any> | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Update URL when tab changes
    const handleTabChange = (tab: 'details' | 'metrics') => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        if (tab === 'metrics') {
            params.set('view', 'metrics');
        } else {
            params.delete('view');
        }
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    };


    useEffect(() => {
        loadCredentials();
    }, []);

    useEffect(() => {
        if (selectedCredential && resourceType && resourceName) {
            loadMetrics();
        }
    }, [selectedCredential, resourceType, resourceName, period]);

    // Auto-refresh state
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    // Auto-refresh effect - refresh every 15 seconds when enabled and on metrics tab
    useEffect(() => {
        if (!autoRefresh || activeTab !== 'metrics') return;

        const interval = setInterval(() => {
            if (selectedCredential && resourceType && resourceName) {
                loadMetrics();
                setLastRefreshed(new Date());
            }
        }, 15000); // 15 seconds

        return () => clearInterval(interval);
    }, [autoRefresh, activeTab, selectedCredential, resourceType, resourceName, period]);


    const loadCredentials = async () => {
        try {
            const creds = await fetchAWSCredentials();
            setCredentials(creds || []);
            if (creds && creds.length > 0) {
                setSelectedCredential(creds[0].id);
            }
        } catch (err) {
            setError('Failed to load credentials');
        } finally {
            setLoading(false);
        }
    };

    const loadMetrics = async () => {
        if (!selectedCredential) return;

        setLoading(true);
        setError(null);

        try {
            const data = await fetchResourceMetrics(
                selectedCredential,
                resourceType,
                resourceName,
                region,
                period
            );
            setMetrics(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load metrics');
        } finally {
            setLoading(false);
        }
    };

    const formatValue = (value: number, metricName: string): string => {
        if (metricName === 'FreeableMemory' || metricName === 'BucketSizeBytes') {
            if (value > 1e12) return `${(value / 1e12).toFixed(2)} TB`;
            if (value > 1e9) return `${(value / 1e9).toFixed(2)} GB`;
            if (value > 1e6) return `${(value / 1e6).toFixed(2)} MB`;
            if (value > 1e3) return `${(value / 1e3).toFixed(2)} KB`;
            return `${value.toFixed(0)} B`;
        }
        if (metricName === 'CPUUtilization') {
            return `${value.toFixed(1)}%`;
        }
        if (metricName === 'Duration') {
            return `${value.toFixed(2)} ms`;
        }
        if (value > 1e6) return `${(value / 1e6).toFixed(2)}M`;
        if (value > 1e3) return `${(value / 1e3).toFixed(2)}K`;
        return value.toFixed(value < 10 ? 2 : 0);
    };

    const getMetricStats = (dataPoints: MetricDataPoint[]): { min: number; max: number; avg: number; latest: number } => {
        if (!dataPoints || dataPoints.length === 0) {
            return { min: 0, max: 0, avg: 0, latest: 0 };
        }
        const values = dataPoints.map(dp => dp.value);
        const sum = values.reduce((a, b) => a + b, 0);
        return {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: sum / values.length,
            latest: values[values.length - 1],
        };
    };

    const typeInfo = RESOURCE_TYPE_INFO[resourceType] || { icon: '☁️', label: resourceType, color: '#6b7280' };

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    <button onClick={() => router.back()} className={styles.backButton}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>

                    <div className={styles.header}>
                        <div className={styles.resourceIcon} style={{ background: typeInfo.color }}>
                            {typeInfo.icon}
                        </div>
                        <div className={styles.resourceInfo}>
                            <h1>{resourceName}</h1>
                            <p>{typeInfo.label} • {region}</p>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                style={{
                                    marginLeft: 'auto',
                                    padding: '0.625rem 1.25rem',
                                    background: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }}
                            >
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Resource
                            </button>
                        )}
                    </div>


                    {/* Tab Navigation */}
                    <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => handleTabChange('details')}
                            style={{
                                padding: '1rem 2rem',
                                fontSize: '1rem',
                                fontWeight: activeTab === 'details' ? 600 : 500,
                                color: activeTab === 'details' ? '#2563eb' : '#6b7280',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'details' ? '3px solid #2563eb' : '3px solid transparent',
                                marginBottom: '-2px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            📋 Details
                        </button>
                        {resourceType === 'rds' && (
                            <button
                                onClick={() => handleTabChange('metrics')}
                                style={{
                                    padding: '1rem 2rem',
                                    fontSize: '1rem',
                                    fontWeight: activeTab === 'metrics' ? 600 : 500,
                                    color: activeTab === 'metrics' ? '#2563eb' : '#6b7280',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'metrics' ? '3px solid #2563eb' : '3px solid transparent',
                                    marginBottom: '-2px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                📊 Metrics
                            </button>
                        )}
                    </div>


                    {/* Details Tab */}
                    {activeTab === 'details' && (
                        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111827' }}>
                                Resource Information
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', borderLeft: `3px solid ${typeInfo.color}` }}>
                                    <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Name</label>
                                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.375rem 0 0 0', fontWeight: 600 }}>{resourceName}</p>
                                </div>

                                <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', borderLeft: `3px solid ${typeInfo.color}` }}>
                                    <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Type</label>
                                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.375rem 0 0 0', fontWeight: 600 }}>{typeInfo.icon} {typeInfo.label}</p>
                                </div>

                                <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', borderLeft: `3px solid ${typeInfo.color}` }}>
                                    <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Region</label>
                                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.375rem 0 0 0', fontWeight: 600 }}>{region}</p>
                                </div>
                            </div>

                            {/* Type-specific details */}
                            <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>
                                    {typeInfo.icon} {typeInfo.label} Details
                                </h4>

                                {resourceType === 's3' && (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>ARN</label>
                                            <p style={{ fontSize: '0.8125rem', color: '#111827', margin: '0.25rem 0 0 0', fontFamily: 'monospace', background: 'white', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                                arn:aws:s3:::{resourceName}
                                            </p>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Bucket URL</label>
                                            <p style={{ fontSize: '0.8125rem', color: '#111827', margin: '0.25rem 0 0 0', fontFamily: 'monospace', background: 'white', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                                https://{resourceName}.s3.{region}.amazonaws.com
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {resourceType === 'sqs' && (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Queue Type</label>
                                                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.25rem 0 0 0', fontWeight: 500 }}>
                                                    {resourceName.endsWith('.fifo') ? '🔄 FIFO' : '📋 Standard'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {resourceType === 'sns' && (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Topic Type</label>
                                                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.25rem 0 0 0', fontWeight: 500 }}>
                                                    {resourceName.endsWith('.fifo') ? '🔄 FIFO' : '📤 Standard'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {resourceType === 'rds' && (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>DB Identifier</label>
                                                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.25rem 0 0 0', fontWeight: 600 }}>{resourceName}</p>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Engine</label>
                                                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.25rem 0 0 0', fontWeight: 600 }}>
                                                    {metrics?.metadata?.engine || 'Loading...'} {metrics?.metadata?.engine_version ? `(${metrics.metadata.engine_version})` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Master Username</label>
                                            <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.25rem 0 0 0', fontWeight: 600 }}>
                                                {metrics?.metadata?.master_username || 'Loading...'}
                                            </p>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Endpoint</label>
                                            <p style={{ fontSize: '0.8125rem', color: '#111827', margin: '0.25rem 0 0 0', fontFamily: 'monospace', background: 'white', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                                {metrics?.metadata?.endpoint || 'Loading endpoint...'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {resourceType === 'lambda' && (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Function Name</label>
                                            <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0.25rem 0 0 0', fontWeight: 600 }}>{resourceName}</p>
                                        </div>
                                    </div>
                                )}
                            </div>


                            {/* Inline Metrics for non-RDS resources */}
                            {resourceType === 's3' && (
                                <div style={{ marginTop: '2rem' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>
                                        📊 Storage Metrics
                                    </h3>
                                    {loading ? (
                                        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading metrics...</p>
                                    ) : (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                                <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ff99002e, #ff990010)', borderRadius: '0.75rem', border: '1px solid #ff990040' }}>
                                                    <label style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 500 }}>Total Size</label>
                                                    <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                        {metrics?.metrics?.BucketSizeBytes && metrics.metrics.BucketSizeBytes.length > 0
                                                            ? `${(metrics.metrics.BucketSizeBytes[metrics.metrics.BucketSizeBytes.length - 1].value / 1e9).toFixed(2)} GB`
                                                            : 'N/A'}
                                                    </p>
                                                </div>
                                                <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ff99002e, #ff990010)', borderRadius: '0.75rem', border: '1px solid #ff990040' }}>
                                                    <label style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 500 }}>Objects</label>
                                                    <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                        {metrics?.metrics?.NumberOfObjects && metrics.metrics.NumberOfObjects.length > 0
                                                            ? metrics.metrics.NumberOfObjects[metrics.metrics.NumberOfObjects.length - 1].value.toLocaleString()
                                                            : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            {(!metrics?.metrics?.BucketSizeBytes && !metrics?.metrics?.NumberOfObjects) && (
                                                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '1rem' }}>
                                                    ℹ️ S3 bucket metrics require CloudWatch storage metrics to be enabled. These can take 1-2 days to populate after bucket creation.
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}


                            {resourceType === 'sqs' && (
                                <div style={{ marginTop: '2rem' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>
                                        📊 Queue Metrics
                                    </h3>
                                    {loading ? (
                                        <p style={{ color: '#6b7280' }}>Loading metrics...</p>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                            <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ff4f8b2e, #ff4f8b10)', borderRadius: '0.75rem', border: '1px solid #ff4f8b40' }}>
                                                <label style={{ fontSize: '0.75rem', color: '#9d174d', textTransform: 'uppercase', fontWeight: 500 }}>Messages Sent</label>
                                                <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                    {(() => {
                                                        const arr = metrics?.metrics?.NumberOfMessagesSent;
                                                        if (!arr || arr.length === 0) return '0';
                                                        return arr.reduce((sum, dp) => sum + (dp.value || 0), 0).toLocaleString();
                                                    })()}
                                                </p>
                                            </div>
                                            <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ff4f8b2e, #ff4f8b10)', borderRadius: '0.75rem', border: '1px solid #ff4f8b40' }}>
                                                <label style={{ fontSize: '0.75rem', color: '#9d174d', textTransform: 'uppercase', fontWeight: 500 }}>Messages Received</label>
                                                <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                    {(() => {
                                                        const arr = metrics?.metrics?.NumberOfMessagesReceived;
                                                        if (!arr || arr.length === 0) return '0';
                                                        return arr.reduce((sum, dp) => sum + (dp.value || 0), 0).toLocaleString();
                                                    })()}
                                                </p>
                                            </div>
                                            <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ff4f8b2e, #ff4f8b10)', borderRadius: '0.75rem', border: '1px solid #ff4f8b40' }}>
                                                <label style={{ fontSize: '0.75rem', color: '#9d174d', textTransform: 'uppercase', fontWeight: 500 }}>Visible Messages</label>
                                                <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                    {(() => {
                                                        const arr = metrics?.metrics?.ApproximateNumberOfMessagesVisible;
                                                        if (!arr || arr.length === 0) return '0';
                                                        // For visible messages, show the latest value (last in array)
                                                        return arr[arr.length - 1]?.value?.toLocaleString() || '0';
                                                    })()}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                            {resourceType === 'sns' && (
                                <div style={{ marginTop: '2rem' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>
                                        📊 Topic Metrics
                                    </h3>
                                    <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #dd344c2e, #dd344c10)', borderRadius: '0.75rem', border: '1px solid #dd344c40' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#991b1b', textTransform: 'uppercase', fontWeight: 500 }}>Messages Published</label>
                                        <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                            {metrics?.metrics?.NumberOfMessagesPublished?.[0]?.value?.toLocaleString() || '—'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {resourceType === 'lambda' && (
                                <div style={{ marginTop: '2rem' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>
                                        📊 Function Metrics
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #fa73432e, #fa734310)', borderRadius: '0.75rem', border: '1px solid #fa734340' }}>
                                            <label style={{ fontSize: '0.75rem', color: '#c2410c', textTransform: 'uppercase', fontWeight: 500 }}>Invocations</label>
                                            <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                {metrics?.metrics?.Invocations?.[0]?.value?.toLocaleString() || '—'}
                                            </p>
                                        </div>
                                        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #fa73432e, #fa734310)', borderRadius: '0.75rem', border: '1px solid #fa734340' }}>
                                            <label style={{ fontSize: '0.75rem', color: '#c2410c', textTransform: 'uppercase', fontWeight: 500 }}>Avg Duration</label>
                                            <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                {metrics?.metrics?.Duration?.[0]?.value
                                                    ? `${metrics.metrics.Duration[0].value.toFixed(0)} ms`
                                                    : '—'}
                                            </p>
                                        </div>
                                        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #fa73432e, #fa734310)', borderRadius: '0.75rem', border: '1px solid #fa734340' }}>
                                            <label style={{ fontSize: '0.75rem', color: '#c2410c', textTransform: 'uppercase', fontWeight: 500 }}>Errors</label>
                                            <p style={{ fontSize: '1.5rem', color: '#111827', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
                                                {metrics?.metrics?.Errors?.[0]?.value?.toLocaleString() || '0'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {resourceType === 'rds' && (
                                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                                    <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0 }}>
                                        💡 <strong>Tip:</strong> Switch to the Metrics tab to view detailed CloudWatch metrics for this database.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Metrics Tab */}
                    {activeTab === 'metrics' && (
                        <>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                marginBottom: '2rem',
                                padding: '1rem 1.25rem',
                                background: 'white',
                                borderRadius: '0.75rem',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <label style={{
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: '#374151'
                                    }}>
                                        Time Range
                                    </label>
                                    {/* Custom dropdown */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const dropdown = document.getElementById('time-range-dropdown');
                                                if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                                            }}
                                            style={{
                                                height: '2.375rem',
                                                padding: '0 2.25rem 0 0.875rem',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: 500,
                                                backgroundColor: 'white',
                                                color: '#374151',
                                                cursor: 'pointer',
                                                minWidth: '160px',
                                                textAlign: 'left',
                                                position: 'relative',
                                            }}
                                        >
                                            {period === '1h' ? 'Last 1 Hour' : period === '6h' ? 'Last 6 Hours' : period === '24h' ? 'Last 24 Hours' : 'Last 7 Days'}
                                            <svg
                                                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem' }}
                                                fill="none" viewBox="0 0 24 24" stroke="#6b7280"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        <div
                                            id="time-range-dropdown"
                                            style={{
                                                display: 'none',
                                                position: 'absolute',
                                                top: 'calc(100% + 4px)',
                                                left: 0,
                                                minWidth: '160px',
                                                backgroundColor: 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '0.5rem',
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                zIndex: 50,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {[
                                                { value: '1h', label: 'Last 1 Hour' },
                                                { value: '6h', label: 'Last 6 Hours' },
                                                { value: '24h', label: 'Last 24 Hours' },
                                                { value: '7d', label: 'Last 7 Days' },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setPeriod(option.value);
                                                        const dropdown = document.getElementById('time-range-dropdown');
                                                        if (dropdown) dropdown.style.display = 'none';
                                                    }}
                                                    style={{
                                                        display: 'block',
                                                        width: '100%',
                                                        padding: '0.625rem 0.875rem',
                                                        fontSize: '0.875rem',
                                                        fontWeight: period === option.value ? 600 : 400,
                                                        color: period === option.value ? '#3b82f6' : '#374151',
                                                        backgroundColor: period === option.value ? '#eff6ff' : 'white',
                                                        border: 'none',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (period !== option.value) {
                                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = period === option.value ? '#eff6ff' : 'white';
                                                    }}
                                                >
                                                    {period === option.value && '✓ '}{option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>


                                <button
                                    onClick={loadMetrics}
                                    disabled={loading}
                                    style={{
                                        height: '2.375rem',
                                        padding: '0 1.25rem',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.6 : 1,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {loading ? 'Loading...' : 'Refresh'}
                                </button>

                                {/* Auto-refresh toggle */}
                                <button
                                    onClick={() => setAutoRefresh(!autoRefresh)}
                                    style={{
                                        height: '2.375rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.625rem',
                                        padding: '0 1rem',
                                        border: autoRefresh ? '1px solid #10b981' : '1px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        background: autoRefresh
                                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))'
                                            : 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: autoRefresh ? '#059669' : '#6b7280',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {/* Toggle switch */}
                                    <div style={{
                                        width: '2rem',
                                        height: '1.125rem',
                                        borderRadius: '9999px',
                                        background: autoRefresh ? '#10b981' : '#d1d5db',
                                        position: 'relative',
                                        transition: 'all 0.2s ease',
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: '2px',
                                            left: autoRefresh ? 'calc(100% - 16px)' : '2px',
                                            width: '0.875rem',
                                            height: '0.875rem',
                                            borderRadius: '50%',
                                            background: 'white',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                            transition: 'all 0.2s ease',
                                        }} />
                                    </div>
                                    <span>
                                        {autoRefresh ? 'Live' : 'Auto'} (15s)
                                    </span>
                                </button>
                            </div>



                            {error && <div className={styles.error}>{error}</div>}

                            {loading && !metrics ? (
                                <div className={styles.loading}>Loading metrics...</div>
                            ) : metrics && Object.keys(metrics.metrics).length > 0 ? (
                                <div className={styles.metricsGrid}>
                                    {Object.entries(metrics.metrics).map(([metricName, dataPoints]) => {
                                        const stats = getMetricStats(dataPoints);
                                        return (
                                            <div key={metricName} className={styles.metricCard}>
                                                <div className={styles.metricHeader}>
                                                    <h3>{METRIC_LABELS[metricName] || metricName}</h3>
                                                    <span className={styles.metricValue}>
                                                        {formatValue(stats.latest, metricName)}
                                                    </span>
                                                </div>
                                                <div className={styles.metricStats}>
                                                    <div className={styles.stat}>
                                                        <span className={styles.statLabel}>Min</span>
                                                        <span className={styles.statValue}>{formatValue(stats.min, metricName)}</span>
                                                    </div>
                                                    <div className={styles.stat}>
                                                        <span className={styles.statLabel}>Avg</span>
                                                        <span className={styles.statValue}>{formatValue(stats.avg, metricName)}</span>
                                                    </div>
                                                    <div className={styles.stat}>
                                                        <span className={styles.statLabel}>Max</span>
                                                        <span className={styles.statValue}>{formatValue(stats.max, metricName)}</span>
                                                    </div>
                                                </div>
                                                <div
                                                    className={styles.miniChart}

                                                    style={{ position: 'relative' }}
                                                    onMouseMove={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const x = e.clientX - rect.left;
                                                        const percentage = x / rect.width;
                                                        const idx = Math.min(Math.max(0, Math.round(percentage * (dataPoints.length - 1))), dataPoints.length - 1);
                                                        const dp = dataPoints[idx];
                                                        if (dp) {
                                                            const tooltip = e.currentTarget.querySelector('.chart-tooltip') as HTMLElement;
                                                            const crosshair = e.currentTarget.querySelector('.chart-crosshair') as HTMLElement;
                                                            if (tooltip) {
                                                                tooltip.style.display = 'block';
                                                                tooltip.style.left = `${Math.min(Math.max(10, x - 40), rect.width - 90)}px`;
                                                                tooltip.innerHTML = `<div style="font-weight:600;font-size:0.813rem;">${formatValue(dp.value, metricName)}</div><div style="font-size:0.688rem;color:#6b7280;">${new Date(dp.timestamp).toLocaleTimeString()}</div>`;
                                                            }
                                                            if (crosshair) {
                                                                crosshair.style.display = 'block';
                                                                crosshair.style.left = `${x}px`;
                                                            }
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        const tooltip = e.currentTarget.querySelector('.chart-tooltip') as HTMLElement;
                                                        const crosshair = e.currentTarget.querySelector('.chart-crosshair') as HTMLElement;
                                                        if (tooltip) tooltip.style.display = 'none';
                                                        if (crosshair) crosshair.style.display = 'none';
                                                    }}
                                                >
                                                    {/* Crosshair line */}
                                                    <div
                                                        className="chart-crosshair"
                                                        style={{
                                                            display: 'none',
                                                            position: 'absolute',
                                                            top: 0,
                                                            bottom: 0,
                                                            width: '1px',
                                                            backgroundColor: typeInfo.color,
                                                            opacity: 0.5,
                                                            pointerEvents: 'none',
                                                            zIndex: 10,
                                                        }}
                                                    />
                                                    {/* Tooltip */}
                                                    <div
                                                        className="chart-tooltip"
                                                        style={{
                                                            display: 'none',
                                                            position: 'absolute',
                                                            top: '0.25rem',
                                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: '0.375rem',
                                                            padding: '0.25rem 0.5rem',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                                            pointerEvents: 'none',
                                                            zIndex: 20,
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    />

                                                    {dataPoints.length > 0 && (() => {
                                                        const chartHeight = 80;
                                                        const chartWidth = 100;
                                                        const padding = { top: 5, bottom: 15, left: 0, right: 0 };
                                                        const effectiveHeight = chartHeight - padding.top - padding.bottom;
                                                        const effectiveWidth = chartWidth - padding.left - padding.right;

                                                        // Generate points
                                                        const points = dataPoints.map((dp, i) => {
                                                            const x = padding.left + (i / (dataPoints.length - 1 || 1)) * effectiveWidth;
                                                            const y = padding.top + effectiveHeight - ((dp.value - stats.min) / ((stats.max - stats.min) || 1)) * effectiveHeight;
                                                            return { x, y, value: dp.value };
                                                        });

                                                        const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
                                                        const areaPoints = `${padding.left},${chartHeight - padding.bottom} ${linePoints} ${chartWidth - padding.right},${chartHeight - padding.bottom}`;

                                                        return (
                                                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className={styles.chartSvg} style={{ cursor: 'crosshair' }}>
                                                                <defs>
                                                                    <linearGradient id={`gradient-${metricName}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                                        <stop offset="0%" stopColor={typeInfo.color} stopOpacity="0.3" />
                                                                        <stop offset="100%" stopColor={typeInfo.color} stopOpacity="0.05" />
                                                                    </linearGradient>
                                                                </defs>

                                                                {/* Horizontal grid lines */}
                                                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                                                                    <line
                                                                        key={i}
                                                                        x1={padding.left}
                                                                        y1={padding.top + effectiveHeight * (1 - ratio)}
                                                                        x2={chartWidth - padding.right}
                                                                        y2={padding.top + effectiveHeight * (1 - ratio)}
                                                                        stroke="#e5e7eb"
                                                                        strokeWidth="0.5"
                                                                        strokeDasharray={ratio === 0 ? "0" : "2,2"}
                                                                    />
                                                                ))}

                                                                {/* Filled area under the line */}
                                                                <polygon
                                                                    points={areaPoints}
                                                                    fill={`url(#gradient-${metricName})`}
                                                                />

                                                                {/* Main line */}
                                                                <polyline
                                                                    fill="none"
                                                                    stroke={typeInfo.color}
                                                                    strokeWidth="0.5"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    points={linePoints}
                                                                />
                                                            </svg>

                                                        );
                                                    })()}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className={styles.noData}>
                                    <p>No metrics available for this resource.</p>
                                    <p>Make sure you have the correct credentials and the resource exists.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Edit Resource Modal */}
            {showEditModal && (
                <div
                    style={{
                        position: 'fixed',

                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowEditModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflow: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                                Edit {typeInfo.label}
                            </h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                                Resource Name
                            </label>
                            <input
                                type="text"
                                value={resourceName}
                                disabled
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    background: '#f9fafb',
                                    color: '#6b7280',
                                }}
                            />
                        </div>

                        {editError && (
                            <div style={{ padding: '0.75rem', background: '#fef2f2', color: '#dc2626', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                {editError}
                            </div>
                        )}

                        {editSuccess && (
                            <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#16a34a', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                {editSuccess}
                            </div>
                        )}

                        {/* S3 Edit Options */}
                        {resourceType === 's3' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    S3 bucket editing allows you to modify versioning, encryption, and public access settings.
                                </p>
                                <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
                                    <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                                        🚧 Coming soon: Versioning, Encryption, and Public Access Block settings
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* SQS Edit Options */}
                        {resourceType === 'sqs' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    SQS queue editing allows you to modify visibility timeout and message retention.
                                </p>
                                <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
                                    <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                                        🚧 Coming soon: Visibility Timeout, Message Retention, and Delay Seconds settings
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* SNS Edit Options */}
                        {resourceType === 'sns' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    SNS topic editing allows you to modify display name and delivery policy.
                                </p>
                                <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
                                    <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                                        🚧 Coming soon: Display Name and Delivery Policy settings
                                    </p>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setShowEditModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    background: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                disabled={editLoading}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    background: '#2563eb',
                                    color: 'white',
                                    cursor: editLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    opacity: editLoading ? 0.7 : 1,
                                }}
                            >
                                {editLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </>
    );
}

export default function ResourceDetailsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResourceDetailsContent />
        </Suspense>
    );
}

