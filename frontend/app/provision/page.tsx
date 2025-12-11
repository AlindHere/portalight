'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchSecrets, provisionResource } from '@/lib/api';
import { Secret } from '@/lib/types';
import styles from './page.module.css';

type ResourceType = 'S3' | 'SQS' | 'SNS';

interface ProvisionForm {
    secretId: string;
    accounts: string[];
    resourceType: ResourceType;
    resourceName: string;
    parameters: Record<string, string>;
}

export default function ProvisionPage() {
    const router = useRouter();
    const [secrets, setSecrets] = useState<Secret[]>([]);
    const [loading, setLoading] = useState(true);
    const [provisioning, setProvisioning] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showCreateCredential, setShowCreateCredential] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<string>('');

    const [form, setForm] = useState<ProvisionForm>({
        secretId: '',
        accounts: [],
        resourceType: 'S3',
        resourceName: '',
        parameters: {},
    });

    // Get unique AWS accounts from secrets
    const awsAccounts = Array.from(new Set(secrets.map((s: Secret) => s.aws_account || 'Default Account')));

    // Filter credentials based on selected account
    const availableCredentials = selectedAccount
        ? secrets.filter((s: Secret) => (s.aws_account || 'Default Account') === selectedAccount)
        : [];

    // Handle account selection change - reset credential when changing account
    const handleAccountChange = (account: string) => {
        setSelectedAccount(account);
        setForm(prev => ({ ...prev, secretId: '', accounts: [account] }));
    };

    useEffect(() => {
        loadSecrets();
    }, []);

    const loadSecrets = async () => {
        try {
            const data = await fetchSecrets();
            // Filter only AWS credentials
            const awsSecrets = data.filter(s => s.provider === 'AWS');
            setSecrets(awsSecrets);
            if (awsSecrets.length > 0) {
                setForm(prev => ({ ...prev, secretId: awsSecrets[0].id }));
            }
        } catch (error) {
            console.error('Failed to load secrets:', error);
            setError('Failed to load credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleAccountToggle = (accountId: string) => {
        setForm(prev => ({
            ...prev,
            accounts: prev.accounts.includes(accountId)
                ? prev.accounts.filter(id => id !== accountId)
                : [...prev.accounts, accountId]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (form.accounts.length === 0) {
            setError('Please select at least one account');
            return;
        }

        setProvisioning(true);
        setError(null);
        setResult(null);

        try {
            const response = await provisionResource({
                secret_id: form.secretId,
                resource_type: form.resourceType,
                parameters: {
                    name: form.resourceName,
                    accounts: form.accounts.join(','),
                    ...form.parameters,
                },
            });
            setResult(response);
        } catch (err) {
            setError('Failed to provision resource. Please try again.');
            console.error(err);
        } finally {
            setProvisioning(false);
        }
    };

    const getParameterFields = () => {
        switch (form.resourceType) {
            case 'S3':
                return (
                    <>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Bucket Region</label>
                            <select
                                className={styles.select}
                                value={form.parameters.region || 'us-east-1'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, region: e.target.value } })}
                            >
                                <option value="us-east-1">US East (N. Virginia)</option>
                                <option value="us-west-2">US West (Oregon)</option>
                                <option value="eu-west-1">EU (Ireland)</option>
                                <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Versioning</label>
                            <select
                                className={styles.select}
                                value={form.parameters.versioning || 'Disabled'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, versioning: e.target.value } })}
                            >
                                <option value="Enabled">Enabled</option>
                                <option value="Disabled">Disabled</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Public Access</label>
                            <select
                                className={styles.select}
                                value={form.parameters.publicAccess || 'Block'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, publicAccess: e.target.value } })}
                            >
                                <option value="Block">Block all public access</option>
                                <option value="Allow">Allow public access</option>
                            </select>
                        </div>
                    </>
                );
            case 'SQS':
                return (
                    <>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Queue Type</label>
                            <select
                                className={styles.select}
                                value={form.parameters.queueType || 'Standard'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, queueType: e.target.value } })}
                            >
                                <option value="Standard">Standard Queue</option>
                                <option value="FIFO">FIFO Queue</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Message Retention (days)</label>
                            <input
                                type="number"
                                className={styles.input}
                                placeholder="4"
                                min="1"
                                max="14"
                                value={form.parameters.retention || '4'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, retention: e.target.value } })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Visibility Timeout (seconds)</label>
                            <input
                                type="number"
                                className={styles.input}
                                placeholder="30"
                                min="0"
                                max="43200"
                                value={form.parameters.visibilityTimeout || '30'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, visibilityTimeout: e.target.value } })}
                            />
                        </div>
                    </>
                );
            case 'SNS':
                return (
                    <>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Topic Type</label>
                            <select
                                className={styles.select}
                                value={form.parameters.topicType || 'Standard'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, topicType: e.target.value } })}
                            >
                                <option value="Standard">Standard Topic</option>
                                <option value="FIFO">FIFO Topic</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Display Name</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="My SNS Topic"
                                value={form.parameters.displayName || ''}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, displayName: e.target.value } })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Encryption</label>
                            <select
                                className={styles.select}
                                value={form.parameters.encryption || 'Disabled'}
                                onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, encryption: e.target.value } })}
                            >
                                <option value="Enabled">Enabled (KMS)</option>
                                <option value="Disabled">Disabled</option>
                            </select>
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    const selectedSecret = secrets.find(s => s.id === form.secretId);

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    {/* Header */}
                    <div className={styles.pageHeader}>
                        <button onClick={() => router.push('/')} className={styles.backButton}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </button>
                        <div>
                            <h1 className={styles.title}>Provision AWS Resources</h1>
                            <p className={styles.subtitle}>Create S3 buckets, SQS queues, and SNS topics</p>
                        </div>
                    </div>

                    <div className={styles.content}>
                        {/* Left Column - Form */}
                        <div className={styles.formSection}>
                            <div className={styles.card}>
                                <h2 className={styles.cardTitle}>Resource Configuration</h2>

                                {loading ? (
                                    <div className={styles.loading}>Loading credentials...</div>
                                ) : (
                                    <form onSubmit={handleSubmit}>


                                        {/* Step 1: Account Selection */}
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>
                                                1. Select AWS Account
                                                <span className={styles.required}>*</span>
                                            </label>
                                            <select
                                                className={styles.select}
                                                value={selectedAccount}
                                                onChange={(e) => handleAccountChange(e.target.value)}
                                                required
                                            >
                                                <option value="">Choose an AWS account...</option>
                                                {awsAccounts.map((account) => (
                                                    <option key={account} value={account}>
                                                        {account}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className={styles.hint}>
                                                Select the target AWS account for provisioning
                                            </p>
                                        </div>

                                        {/* Step 2: Credential Selection (appears after account selected) */}
                                        {selectedAccount && (
                                            <div className={styles.formGroup}>
                                                <label className={styles.label}>
                                                    2. Select Credentials for {selectedAccount}
                                                    <span className={styles.required}>*</span>
                                                </label>
                                                <select
                                                    className={styles.select}
                                                    value={form.secretId}
                                                    onChange={(e) => setForm({ ...form, secretId: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Choose credentials...</option>
                                                    {availableCredentials.map((secret) => (
                                                        <option key={secret.id} value={secret.id}>
                                                            {secret.name} ({secret.region})
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className={styles.hint}>
                                                    {availableCredentials.length} credential(s) available for {selectedAccount}
                                                </p>
                                            </div>
                                        )}

                                        {/* Resource Type */}
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Resource Type</label>
                                            <div className={styles.resourceTypes}>
                                                {(['S3', 'SQS', 'SNS'] as ResourceType[]).map((type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        className={`${styles.resourceButton} ${form.resourceType === type ? styles.resourceButtonActive : ''}`}
                                                        onClick={() => setForm({ ...form, resourceType: type, parameters: {} })}
                                                    >
                                                        <div className={styles.resourceIcon}>
                                                            {type === 'S3' && (
                                                                <svg viewBox="0 0 80 80" fill="none">
                                                                    <rect width="80" height="80" fill="#569A31" />
                                                                    <path d="M40 15L60 25V55L40 65L20 55V25L40 15Z" fill="#527F34" />
                                                                    <path d="M40 15V35L20 25V45L40 35V55L60 45V25L40 35V15Z" fill="#7AAA5A" />
                                                                    <path d="M40 35L60 45V65L40 55V35Z" fill="#3E6B29" />
                                                                    <path d="M40 35L20 45V65L40 55V35Z" fill="#7AAA5A" />
                                                                </svg>
                                                            )}
                                                            {type === 'SQS' && (
                                                                <svg viewBox="0 0 80 80" fill="none">
                                                                    <rect width="80" height="80" fill="#FF9900" />
                                                                    <rect x="15" y="20" width="50" height="10" rx="2" fill="#D26E00" />
                                                                    <rect x="15" y="35" width="50" height="10" rx="2" fill="#D26E00" />
                                                                    <rect x="15" y="50" width="50" height="10" rx="2" fill="#D26E00" />
                                                                    <circle cx="22" cy="25" r="2" fill="#FFB951" />
                                                                    <circle cx="22" cy="40" r="2" fill="#FFB951" />
                                                                    <circle cx="22" cy="55" r="2" fill="#FFB951" />
                                                                    <rect x="28" y="23" width="30" height="4" fill="#FFB951" />
                                                                    <rect x="28" y="38" width="30" height="4" fill="#FFB951" />
                                                                    <rect x="28" y="53" width="30" height="4" fill="#FFB951" />
                                                                </svg>
                                                            )}
                                                            {type === 'SNS' && (
                                                                <svg viewBox="0 0 80 80" fill="none">
                                                                    <rect width="80" height="80" fill="#E7157B" />
                                                                    <circle cx="40" cy="40" r="25" fill="#C2105C" />
                                                                    <path d="M40 22C30 22 22 30 22 40C22 45 24 50 27 53L24 60L32 57C35 59 37.5 60 40 60C50 60 58 52 58 40C58 30 50 22 40 22Z" fill="white" />
                                                                    <circle cx="32" cy="40" r="2.5" fill="#E7157B" />
                                                                    <circle cx="40" cy="40" r="2.5" fill="#E7157B" />
                                                                    <circle cx="48" cy="40" r="2.5" fill="#E7157B" />
                                                                    <path d="M27 53L24 60L32 57C30 55 28 54 27 53Z" fill="#FFB1D4" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className={styles.resourceTitle}>{type}</div>
                                                            <div className={styles.resourceSubtitle}>
                                                                {type === 'S3' && 'Object Storage'}
                                                                {type === 'SQS' && 'Message Queue'}
                                                                {type === 'SNS' && 'Pub/Sub Messaging'}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Resource Name */}
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Resource Name</label>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                placeholder={`my-${form.resourceType.toLowerCase()}-resource`}
                                                value={form.resourceName}
                                                onChange={(e) => setForm({ ...form, resourceName: e.target.value })}
                                                required
                                            />
                                        </div>

                                        {/* Dynamic Parameters */}
                                        {getParameterFields()}

                                        {/* Submit Button */}
                                        <div className={styles.formActions}>
                                            <button
                                                type="submit"
                                                className={styles.submitButton}
                                                disabled={provisioning || form.accounts.length === 0}
                                            >
                                                {provisioning ? (
                                                    <>
                                                        <span className={styles.spinner}></span>
                                                        Provisioning...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                        </svg>
                                                        Provision Resource
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Info & Results */}
                        <div className={styles.infoSection}>
                            {/* Info Card */}
                            <div className={styles.card}>
                                <h2 className={styles.cardTitle}>Available Resources</h2>
                                <div className={styles.resourceInfo}>
                                    <div className={styles.infoItem}>
                                        <h4>Amazon S3</h4>
                                        <p>Scalable object storage for data lakes, websites, and applications</p>
                                    </div>
                                    <div className={styles.infoItem}>
                                        <h4>Amazon SQS</h4>
                                        <p>Fully managed message queuing service for decoupling microservices</p>
                                    </div>
                                    <div className={styles.infoItem}>
                                        <h4>Amazon SNS</h4>
                                        <p>Pub/sub messaging and mobile notifications service</p>
                                    </div>
                                </div>
                            </div>

                            {/* Result Card */}
                            {result && (
                                <div className={`${styles.card} ${styles.successCard}`}>
                                    <div className={styles.successIcon}>
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h2 className={styles.cardTitle}>Provisioning Started!</h2>
                                    <p className={styles.resultMessage}>{result.message}</p>
                                    <div className={styles.resultDetails}>
                                        <div className={styles.resultItem}>
                                            <span className={styles.resultLabel}>Status:</span>
                                            <span className={styles.resultValue}>{result.status}</span>
                                        </div>
                                        <div className={styles.resultItem}>
                                            <span className={styles.resultLabel}>Resource Type:</span>
                                            <span className={styles.resultValue}>{result.resource_type}</span>
                                        </div>
                                        <div className={styles.resultItem}>
                                            <span className={styles.resultLabel}>Accounts:</span>
                                            <span className={styles.resultValue}>{form.accounts.length} selected</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error Card */}
                            {error && (
                                <div className={`${styles.card} ${styles.errorCard}`}>
                                    <div className={styles.errorIcon}>
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h2 className={styles.cardTitle}>Error</h2>
                                    <p className={styles.errorMessage}>{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
