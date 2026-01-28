'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { fetchAWSCredentials, createAWSCredential, deleteAWSCredential, fetchCurrentUser } from '@/lib/api';
import { Secret, User } from '@/lib/types';
import styles from './page.module.css';

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

export default function CredentialsPage() {
    const router = useRouter();
    const [credentials, setCredentials] = useState<Secret[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [accountId, setAccountId] = useState('');
    const [region, setRegion] = useState('ap-south-1');
    const [accessKeyId, setAccessKeyId] = useState('');
    const [secretAccessKey, setSecretAccessKey] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [credsData, userData] = await Promise.all([
                fetchAWSCredentials(),
                fetchCurrentUser(),
            ]);
            setCredentials(credsData || []);
            setCurrentUser(userData.user);

            // Check if user is superadmin
            if (userData.user.role !== 'superadmin') {
                router.push('/');
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            setError('Failed to load credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            await createAWSCredential(name, accountId, region, accessKeyId, secretAccessKey);
            setSuccess('AWS credential created successfully!');
            setShowForm(false);
            setName('');
            setAccountId('');
            setRegion('ap-south-1');
            setAccessKeyId('');
            setSecretAccessKey('');
            loadData();
        } catch (err: any) {
            setError(err.message || 'Failed to create credential');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteAWSCredential(id);
            setSuccess('Credential deleted successfully');
            setDeleteConfirm(null);
            loadData();
        } catch (err: any) {
            setError(err.message || 'Failed to delete credential');
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.loading}>Loading...</div>
                    </div>
                </main>
            </>
        );
    }

    if (currentUser?.role !== 'superadmin') {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.accessDenied}>
                            <h2>Access Denied</h2>
                            <p>Only superadmins can manage AWS credentials.</p>
                        </div>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    <div className={styles.pageHeader}>
                        <button onClick={() => router.push('/')} className={styles.backButton}>
                            ← Back to Dashboard
                        </button>
                        <div className={styles.headerContent}>
                            <div>
                                <h1 className={styles.title}>AWS Credentials</h1>
                                <p className={styles.subtitle}>
                                    Manage AWS access keys for resource provisioning
                                </p>
                            </div>
                            <button
                                className={styles.addButton}
                                onClick={() => setShowForm(true)}
                            >
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Credential
                            </button>
                        </div>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}
                    {success && <div className={styles.success}>{success}</div>}

                    <div className={styles.securityNote}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <div>
                            <strong>Security Notice:</strong> AWS credentials are encrypted using AES-256-GCM before storage.
                            Secret access keys are never displayed after creation.
                        </div>
                    </div>

                    {showForm && (
                        <div className={styles.formCard}>
                            <h3>Add New AWS Credential</h3>
                            <form onSubmit={handleSubmit}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Credential Name</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Production AWS"
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>AWS Account ID</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={accountId}
                                        onChange={(e) => setAccountId(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                                        placeholder="123456789012"
                                        required
                                        maxLength={12}
                                    />
                                    <p className={styles.hint}>12-digit AWS account number</p>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Default Region</label>
                                    <CustomDropdown
                                        value={region}
                                        onChange={(value) => setRegion(value)}
                                        options={AWS_REGIONS.map(r => ({
                                            value: r.id,
                                            label: r.name
                                        }))}
                                        placeholder="Select region..."
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Access Key ID</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={accessKeyId}
                                        onChange={(e) => setAccessKeyId(e.target.value)}
                                        placeholder="AKIAIOSFODNN7EXAMPLE"
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Secret Access Key</label>
                                    <input
                                        type="password"
                                        className={styles.input}
                                        value={secretAccessKey}
                                        onChange={(e) => setSecretAccessKey(e.target.value)}
                                        placeholder="••••••••••••••••••••••••••••••••••••••••"
                                        required
                                    />
                                    <p className={styles.hint}>
                                        This will be encrypted and cannot be viewed after creation.
                                    </p>
                                </div>

                                <div className={styles.formActions}>
                                    <button
                                        type="button"
                                        className={styles.cancelButton}
                                        onClick={() => setShowForm(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className={styles.submitButton}
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Creating...' : 'Create Credential'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className={styles.credentialsList}>
                        {credentials.length === 0 ? (
                            <div className={styles.emptyState}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                <h3>No AWS Credentials</h3>
                                <p>Add your first AWS credential to start provisioning resources.</p>
                            </div>
                        ) : (
                            credentials.map(cred => (
                                <div key={cred.id} className={styles.credentialCard}>
                                    <div className={styles.credentialInfo}>
                                        <div className={styles.credentialIcon}>
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                            </svg>
                                        </div>
                                        <div className={styles.credentialDetails}>
                                            <h4>{cred.name}</h4>
                                            <p>
                                                <span className={styles.badge}>{cred.provider}</span>
                                                <span className={styles.region}>{cred.region || 'No default region'}</span>
                                            </p>
                                            <p className={styles.createdAt}>
                                                Created {new Date(cred.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={styles.credentialActions}>
                                        {deleteConfirm === cred.id ? (
                                            <>
                                                <span className={styles.confirmText}>Delete?</span>
                                                <button
                                                    className={styles.confirmYes}
                                                    onClick={() => handleDelete(cred.id)}
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    className={styles.confirmNo}
                                                    onClick={() => setDeleteConfirm(null)}
                                                >
                                                    No
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                className={styles.deleteButton}
                                                onClick={() => setDeleteConfirm(cred.id)}
                                            >
                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
