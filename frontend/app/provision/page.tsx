'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchProjects, fetchAWSCredentials, createResource, fetchCurrentUser, fetchDevProvisioningPermissions, UserProvisioningPermissions } from '@/lib/api';
import { Project, Secret, User } from '@/lib/types';
import styles from './page.module.css';
import CustomDropdown from '@/components/ui/CustomDropdown';

const AWS_REGIONS = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-east-2', name: 'US East (Ohio)' },
    { id: 'us-west-1', name: 'US West (N. California)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'EU (Ireland)' },
    { id: 'eu-west-2', name: 'EU (London)' },
    { id: 'eu-central-1', name: 'EU (Frankfurt)' },
    { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
    { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
    { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
];

const ALL_RESOURCE_TYPES = [
    {
        id: 's3',
        name: 'S3 Bucket',
        description: 'Scalable object storage for data backup and archival.',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
        )
    },
    {
        id: 'sqs',
        name: 'SQS Queue',
        description: 'Fully managed message queuing service.',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        )
    },
    {
        id: 'sns',
        name: 'SNS Topic',
        description: 'Pub/sub messaging for microservices and serverless.',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
        )
    },
];

export default function ProvisionPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [projects, setProjects] = useState<Project[]>([]);
    const [credentials, setCredentials] = useState<Secret[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [availableResourceTypes, setAvailableResourceTypes] = useState(ALL_RESOURCE_TYPES);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedCredential, setSelectedCredential] = useState<string>('');
    const [resourceName, setResourceName] = useState('');

    // S3 Config
    const [s3Region, setS3Region] = useState('ap-south-1');
    const [s3Versioning, setS3Versioning] = useState(false);
    const [s3PublicAccessBlocked, setS3PublicAccessBlocked] = useState(true);
    const [s3Encryption, setS3Encryption] = useState('AES256');

    // SQS Config
    const [sqsRegion, setSqsRegion] = useState('ap-south-1');
    const [sqsQueueType, setSqsQueueType] = useState('standard');
    const [sqsVisibilityTimeout, setSqsVisibilityTimeout] = useState(30);
    const [sqsMessageRetentionDays, setSqsMessageRetentionDays] = useState(4);
    const [sqsDelaySeconds, setSqsDelaySeconds] = useState(0);

    // SNS Config
    const [snsRegion, setSnsRegion] = useState('ap-south-1');
    const [snsTopicType, setSnsTopicType] = useState('standard');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [projectsData, credsData, userData] = await Promise.all([
                fetchProjects(),
                fetchAWSCredentials(),
                fetchCurrentUser(),
            ]);
            setProjects(projectsData);
            setCredentials(credsData || []);
            setCurrentUser(userData.user);

            // Check permissions for dev users
            if (userData.user.role === 'dev') {
                try {
                    const permissions = await fetchDevProvisioningPermissions(userData.user.id);
                    const allowedTypes: string[] = [];
                    if (permissions.s3_enabled) allowedTypes.push('s3');
                    if (permissions.sqs_enabled) allowedTypes.push('sqs');
                    if (permissions.sns_enabled) allowedTypes.push('sns');

                    // If no permissions, redirect
                    if (allowedTypes.length === 0) {
                        router.push('/?error=no_provisioning_access');
                        return;
                    }

                    // Filter available resource types
                    setAvailableResourceTypes(ALL_RESOURCE_TYPES.filter(t => allowedTypes.includes(t.id)));
                } catch {
                    // No permissions
                    router.push('/?error=no_provisioning_access');
                    return;
                }
            }
            // Lead/superadmin get all types (already set as default)
        } catch (err) {
            console.error('Failed to load data:', err);
            setError('Failed to load data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const buildConfig = () => {
        switch (selectedType) {
            case 's3':
                return {
                    region: s3Region,
                    versioning: s3Versioning,
                    public_access_blocked: s3PublicAccessBlocked,
                    encryption: s3Encryption,
                };
            case 'sqs':
                return {
                    region: sqsRegion,
                    queue_type: sqsQueueType,
                    visibility_timeout: sqsVisibilityTimeout,
                    message_retention_days: sqsMessageRetentionDays,
                    delay_seconds: sqsDelaySeconds,
                };
            case 'sns':
                return {
                    region: snsRegion,
                    topic_type: snsTopicType,
                };
            default:
                return {};
        }
    };

    const handleSubmit = async () => {
        if (!resourceName || !selectedProject || !selectedType || !selectedCredential) {
            setError('Please fill in all required fields');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await createResource({
                project_id: selectedProject,
                secret_id: selectedCredential,
                name: resourceName,
                type: selectedType,
                config: buildConfig(),
            });

            router.push(`/projects/${selectedProject}`);
        } catch (err: any) {
            console.error('Failed to provision resource:', err);
            setError(err.message || 'Failed to provision resource. Please try again.');
            setSubmitting(false);
        }
    };

    const renderStep1 = () => (
        <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Select a Project</h2>
            <div className={styles.formGroup}>
                <label className={styles.label}>Project</label>
                <CustomDropdown
                    options={[
                        { value: '', label: 'Select a project...' },
                        ...projects.map(p => ({ value: p.id, label: p.name }))
                    ]}
                    value={selectedProject}
                    onChange={setSelectedProject}
                    placeholder="Select a project"
                />
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Select Resource Type</h2>
            <div className={styles.resourceGrid}>
                {availableResourceTypes.map((type: typeof ALL_RESOURCE_TYPES[0]) => (
                    <div
                        key={type.id}
                        className={`${styles.resourceCard} ${selectedType === type.id ? styles.resourceCardSelected : ''}`}
                        onClick={() => setSelectedType(type.id)}
                    >
                        <div className={styles.resourceIcon}>{type.icon}</div>
                        <div className={styles.resourceName}>{type.name}</div>
                        <div className={styles.resourceDesc}>{type.description}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderS3Config = () => (
        <>
            <div className={styles.formGroup}>
                <label className={styles.label}>Bucket Name</label>
                <input
                    type="text"
                    className={styles.input}
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="my-unique-bucket-name"
                />
                <p className={styles.hint}>Bucket names must be globally unique, 3-63 characters, lowercase letters, numbers, and hyphens only.</p>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Region</label>
                <CustomDropdown
                    options={AWS_REGIONS.map(r => ({ value: r.id, label: r.name }))}
                    value={s3Region}
                    onChange={setS3Region}
                />
            </div>
            <div className={styles.formRow}>
                <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={s3Versioning} onChange={(e) => setS3Versioning(e.target.checked)} />
                        <span>Enable Versioning</span>
                    </label>
                    <p className={styles.hint}>Keep multiple versions of objects</p>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={s3PublicAccessBlocked} onChange={(e) => setS3PublicAccessBlocked(e.target.checked)} />
                        <span>Block Public Access</span>
                    </label>
                    <p className={styles.hint}>Recommended for security</p>
                </div>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Encryption</label>
                <CustomDropdown
                    options={[
                        { value: 'AES256', label: 'SSE-S3 (AES-256)' },
                        { value: 'aws:kms', label: 'SSE-KMS' }
                    ]}
                    value={s3Encryption}
                    onChange={setS3Encryption}
                />
            </div>
        </>
    );

    const renderSQSConfig = () => (
        <>
            <div className={styles.formGroup}>
                <label className={styles.label}>Queue Name</label>
                <input
                    type="text"
                    className={styles.input}
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="my-queue-name"
                />
                <p className={styles.hint}>Alphanumeric characters, hyphens, and underscores only.</p>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Region</label>
                <CustomDropdown
                    options={AWS_REGIONS.map(r => ({ value: r.id, label: r.name }))}
                    value={sqsRegion}
                    onChange={setSqsRegion}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Queue Type</label>
                <CustomDropdown
                    options={[
                        { value: 'standard', label: 'Standard' },
                        { value: 'fifo', label: 'FIFO (First-In-First-Out)' }
                    ]}
                    value={sqsQueueType}
                    onChange={setSqsQueueType}
                />
                <p className={styles.hint}>FIFO queues guarantee ordering and exactly-once processing.</p>
            </div>
            <div className={styles.formRow}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Visibility Timeout (seconds)</label>
                    <input
                        type="number"
                        className={styles.input}
                        value={sqsVisibilityTimeout}
                        onChange={(e) => setSqsVisibilityTimeout(parseInt(e.target.value) || 0)}
                        min={0}
                        max={43200}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Message Retention (days)</label>
                    <input
                        type="number"
                        className={styles.input}
                        value={sqsMessageRetentionDays}
                        onChange={(e) => setSqsMessageRetentionDays(parseInt(e.target.value) || 1)}
                        min={1}
                        max={14}
                    />
                </div>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Delay Seconds</label>
                <input
                    type="number"
                    className={styles.input}
                    value={sqsDelaySeconds}
                    onChange={(e) => setSqsDelaySeconds(parseInt(e.target.value) || 0)}
                    min={0}
                    max={900}
                />
                <p className={styles.hint}>Delay before messages become visible (0-900 seconds)</p>
            </div>
        </>
    );

    const renderSNSConfig = () => (
        <>
            <div className={styles.formGroup}>
                <label className={styles.label}>Topic Name</label>
                <input
                    type="text"
                    className={styles.input}
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="my-topic-name"
                />
                <p className={styles.hint}>Alphanumeric characters, hyphens, and underscores only.</p>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Region</label>
                <CustomDropdown
                    options={AWS_REGIONS.map(r => ({ value: r.id, label: r.name }))}
                    value={snsRegion}
                    onChange={setSnsRegion}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Topic Type</label>
                <CustomDropdown
                    options={[
                        { value: 'standard', label: 'Standard' },
                        { value: 'fifo', label: 'FIFO (First-In-First-Out)' }
                    ]}
                    value={snsTopicType}
                    onChange={setSnsTopicType}
                />
                <p className={styles.hint}>FIFO topics provide strict message ordering and deduplication.</p>
            </div>
        </>
    );

    const renderStep3 = () => (
        <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Configure {ALL_RESOURCE_TYPES.find(t => t.id === selectedType)?.name}</h2>
            {selectedType === 's3' && renderS3Config()}
            {selectedType === 'sqs' && renderSQSConfig()}
            {selectedType === 'sns' && renderSNSConfig()}
        </div>
    );

    const renderStep4 = () => (
        <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Select AWS Credentials</h2>
            {credentials.length === 0 ? (
                <div className={styles.noCredentials}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h3>No AWS Credentials Found</h3>
                    <p>A superadmin needs to add AWS credentials before resources can be provisioned.</p>
                    <button onClick={() => router.push('/settings/credentials')} className={styles.addCredButton}>
                        Add Credentials
                    </button>
                </div>
            ) : (
                <div className={styles.credentialsList}>
                    {credentials.map(cred => (
                        <div
                            key={cred.id}
                            className={`${styles.credentialOption} ${selectedCredential === cred.id ? styles.credentialOptionSelected : ''}`}
                            onClick={() => setSelectedCredential(cred.id)}
                        >
                            <div className={styles.credentialRadio}>
                                <div className={selectedCredential === cred.id ? styles.radioChecked : styles.radioUnchecked} />
                            </div>
                            <div className={styles.credentialInfo}>
                                <strong>{cred.name}</strong>
                                <span>{cred.region || 'No default region'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderStep5 = () => {
        const project = projects.find(p => p.id === selectedProject);
        const type = ALL_RESOURCE_TYPES.find(t => t.id === selectedType);
        const cred = credentials.find(c => c.id === selectedCredential);
        const config = buildConfig();

        return (
            <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Review & Provision</h2>
                <div className={styles.reviewGrid}>
                    <div className={styles.reviewItem}>
                        <span className={styles.reviewLabel}>Project:</span>
                        <span className={styles.reviewValue}>{project?.name}</span>
                    </div>
                    <div className={styles.reviewItem}>
                        <span className={styles.reviewLabel}>Resource Type:</span>
                        <span className={styles.reviewValue}>{type?.name}</span>
                    </div>
                    <div className={styles.reviewItem}>
                        <span className={styles.reviewLabel}>Name:</span>
                        <span className={styles.reviewValue}>{resourceName}</span>
                    </div>
                    <div className={styles.reviewItem}>
                        <span className={styles.reviewLabel}>AWS Credential:</span>
                        <span className={styles.reviewValue}>{cred?.name}</span>
                    </div>
                    <div className={styles.reviewItem}>
                        <span className={styles.reviewLabel}>Region:</span>
                        <span className={styles.reviewValue}>{(config as any).region}</span>
                    </div>
                </div>
                <div className={styles.configSummary}>
                    <h4>Configuration Details</h4>
                    <pre>{JSON.stringify(config, null, 2)}</pre>
                </div>
            </div>
        );
    };

    const canProceed = () => {
        switch (step) {
            case 1: return !!selectedProject;
            case 2: return !!selectedType;
            case 3: return !!resourceName;
            case 4: return !!selectedCredential;
            default: return true;
        }
    };

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    <div className={styles.pageHeader}>
                        <button onClick={() => router.push('/')} className={styles.backButton} style={{ marginBottom: '1rem' }}>
                            ← Back to Dashboard
                        </button>
                        <h1 className={styles.title}>Provision AWS Resource</h1>
                        <p className={styles.subtitle}>Create new cloud infrastructure for your projects</p>
                    </div>

                    <div className={styles.wizard}>
                        <div className={styles.steps}>
                            <div className={`${styles.step} ${step >= 1 ? styles.stepActive : ''} ${step > 1 ? styles.stepCompleted : ''}`}>1. Project</div>
                            <div className={`${styles.step} ${step >= 2 ? styles.stepActive : ''} ${step > 2 ? styles.stepCompleted : ''}`}>2. Type</div>
                            <div className={`${styles.step} ${step >= 3 ? styles.stepActive : ''} ${step > 3 ? styles.stepCompleted : ''}`}>3. Configure</div>
                            <div className={`${styles.step} ${step >= 4 ? styles.stepActive : ''} ${step > 4 ? styles.stepCompleted : ''}`}>4. Credentials</div>
                            <div className={`${styles.step} ${step >= 5 ? styles.stepActive : ''}`}>5. Review</div>
                        </div>

                        <div className={styles.content}>
                            {error && <div className={styles.error}>{error}</div>}

                            {loading ? (
                                <div>Loading...</div>
                            ) : (
                                <>
                                    {step === 1 && renderStep1()}
                                    {step === 2 && renderStep2()}
                                    {step === 3 && renderStep3()}
                                    {step === 4 && renderStep4()}
                                    {step === 5 && renderStep5()}
                                </>
                            )}

                            <div className={styles.actions}>
                                <button
                                    className={styles.backButton}
                                    onClick={() => setStep(s => Math.max(1, s - 1))}
                                    disabled={step === 1 || submitting}
                                >
                                    Back
                                </button>

                                {step < 5 ? (
                                    <button
                                        className={styles.nextButton}
                                        onClick={() => {
                                            if (!canProceed()) {
                                                setError('Please complete all required fields');
                                                return;
                                            }
                                            setError(null);
                                            setStep(s => s + 1);
                                        }}
                                        disabled={!canProceed()}
                                    >
                                        Next Step
                                    </button>
                                ) : (
                                    <button
                                        className={styles.nextButton}
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Provisioning...' : 'Provision Resource'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
