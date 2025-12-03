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

    const [form, setForm] = useState<ProvisionForm>({
        secretId: '',
        accounts: [],
        resourceType: 'S3',
        resourceName: '',
        parameters: {},
    });

    // Mock AWS accounts
    const availableAccounts = [
        { id: 'prod', name: 'Production (123456789012)' },
        { id: 'staging', name: 'Staging (234567890123)' },
        { id: 'dev', name: 'Development (345678901234)' },
    ];

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
                                        {/* Credential Selection */}
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>AWS Credentials</label>
                                            <div className={styles.credentialSelector}>
                                                <select
                                                    className={styles.select}
                                                    value={form.secretId}
                                                    onChange={(e) => setForm({ ...form, secretId: e.target.value })}
                                                    required
                                                >
                                                    {secrets.map((secret) => (
                                                        <option key={secret.id} value={secret.id}>
                                                            {secret.name} ({secret.region})
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className={styles.createCredButton}
                                                    onClick={() => setShowCreateCredential(true)}
                                                >
                                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                    New
                                                </button>
                                            </div>
                                            {selectedSecret && (
                                                <p className={styles.hint}>
                                                    Region: {selectedSecret.region}
                                                </p>
                                            )}
                                        </div>

                                        {/* Account Selection */}
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>
                                                Target Accounts
                                                <span className={styles.required}>*</span>
                                            </label>
                                            <div className={styles.accountList}>
                                                {availableAccounts.map((account) => (
                                                    <label key={account.id} className={styles.accountItem}>
                                                        <input
                                                            type="checkbox"
                                                            checked={form.accounts.includes(account.id)}
                                                            onChange={() => handleAccountToggle(account.id)}
                                                            className={styles.checkbox}
                                                        />
                                                        <span className={styles.accountName}>{account.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <p className={styles.hint}>
                                                Select one or more AWS accounts to provision resources
                                            </p>
                                        </div>

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
                                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                                                </svg>
                                                            )}
                                                            {type === 'SQS' && (
                                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                                                </svg>
                                                            )}
                                                            {type === 'SNS' && (
                                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className={styles.resourceTitle}>{type}</div>
                                                            <div className={styles.resourceSubtitle}>
                                                                {type === 'S3' && 'Object Storage'}
                                                                {type === 'SQS' && 'Message Queue'}
                                                                {type === 'SNS' && 'Notification Service'}
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
