'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchCurrentUser, fetchUsers, fetchTeams, fetchSecrets } from '@/lib/api';
import GitHubConfig from '@/components/configuration/GitHubConfig';
import styles from './page.module.css';

type Tab = 'credentials' | 'permissions' | 'access' | 'github';

export default function ConfigurationPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('credentials');
    const [users, setUsers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [credentials, setCredentials] = useState<any[]>([]);

    useEffect(() => {
        checkAuthorization();
    }, []);

    const checkAuthorization = async () => {
        try {
            const data = await fetchCurrentUser();
            setCurrentUser(data.user);

            // Check if user is superadmin
            if (data.user?.role !== 'superadmin') {
                alert('Access denied. Only superadmins can access this page.');
                router.push('/');
                return;
            }

            // Load data for tabs
            await loadData();
        } catch (error) {
            console.error('Authorization check failed:', error);
            router.push('/');
        } finally {
            setLoading(false);
        }
    };

    const loadData = async () => {
        try {
            const [usersData, teamsData, credentialsData] = await Promise.all([
                fetchUsers(),
                fetchTeams(),
                fetchSecrets(),
            ]);
            setUsers(usersData || []);
            setTeams(teamsData || []);
            setCredentials(credentialsData || []);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.loading}>Verifying access...</div>
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
                    {/* Page Header */}
                    <div className={styles.pageHeader}>
                        <button onClick={() => router.push('/')} className={styles.backButton}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </button>
                        <h1 className={styles.title}>⚙️ Configuration</h1>
                        <p className={styles.subtitle}>
                            Manage AWS credentials, user permissions, and project access
                        </p>
                    </div>

                    {/* Tab Navigation */}
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'credentials' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('credentials')}
                        >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            AWS Credentials
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'permissions' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('permissions')}
                        >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            User Permissions
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'access' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('access')}
                        >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            Project Access
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'github' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('github')}
                        >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            GitHub Integration
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className={styles.tabContent}>
                        {activeTab === 'github' && <GitHubConfig />}
                        {activeTab === 'credentials' && (
                            <CredentialsTab
                                credentials={credentials}
                                onRefresh={loadData}
                            />
                        )}
                        {activeTab === 'permissions' && (
                            <PermissionsTab
                                users={users}
                                teams={teams}
                                onRefresh={loadData}
                            />
                        )}
                        {activeTab === 'access' && (
                            <ProjectAccessTab
                                users={users}
                                onRefresh={loadData}
                            />
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}

// AWS Credentials Tab
function CredentialsTab({ credentials, onRefresh }: { credentials: any[], onRefresh: () => void }) {
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [accountId, setAccountId] = useState('');
    const [region, setRegion] = useState('ap-south-1');
    const [accessType, setAccessType] = useState<'read' | 'write'>('write');
    const [accessKeyId, setAccessKeyId] = useState('');
    const [secretAccessKey, setSecretAccessKey] = useState('');

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/v1/credentials`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name,
                    account_id: accountId,
                    region,
                    access_type: accessType,
                    access_key_id: accessKeyId,
                    secret_access_key: secretAccessKey,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to create credential');
            }

            // Reset form and close modal
            setName('');
            setAccountId('');
            setRegion('ap-south-1');
            setAccessType('write');
            setAccessKeyId('');
            setSecretAccessKey('');
            setShowModal(false);
            onRefresh();
        } catch (err: any) {
            setError(err.message || 'Failed to create credential');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/v1/credentials/${id}`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                throw new Error('Failed to delete credential');
            }

            setDeleteConfirm(null);
            onRefresh();
        } catch (err: any) {
            alert(err.message || 'Failed to delete credential');
        }
    };

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h2>AWS Credentials</h2>
                <button className={styles.addButton} onClick={() => setShowModal(true)}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Credential
                </button>
            </div>

            {credentials.length > 0 ? (
                <div className={styles.credentialsList}>
                    {credentials.map((cred) => (
                        <div key={cred.id} className={styles.credentialCard}>
                            <div className={styles.credentialIcon}>☁️</div>
                            <div className={styles.credentialInfo}>
                                <h3>{cred.name}</h3>
                                <p>
                                    {cred.account_id ? `AWS Account ${cred.account_id}` : 'AWS Account'} •
                                    {cred.region && ` ${cred.region} •`} Created {new Date(cred.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: cred.access_type === 'read' ? '#dbeafe' : '#dcfce7',
                                color: cred.access_type === 'read' ? '#1d4ed8' : '#16a34a',
                            }}>
                                {cred.access_type === 'read' ? '🔍 Read-Only' : '✏️ Read+Write'}
                            </span>
                            <div className={styles.credentialActions}>
                                {deleteConfirm === cred.id ? (
                                    <>
                                        <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>Delete?</span>
                                        <button className={styles.deleteButton} onClick={() => handleDelete(cred.id)}>Yes</button>
                                        <button className={styles.editButton} onClick={() => setDeleteConfirm(null)}>No</button>
                                    </>
                                ) : (
                                    <button className={styles.deleteButton} onClick={() => setDeleteConfirm(cred.id)}>Delete</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <h3>No AWS Credentials</h3>
                    <p>Add your first AWS credential to start provisioning resources</p>
                </div>
            )}

            {/* Add Credential Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            width: '700px',
                            maxWidth: '95vw',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>🔑 Add AWS Credential</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: 'none', background: '#f3f4f6', cursor: 'pointer', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Body */}
                            <div style={{ padding: '1.5rem' }}>
                                {error && <div style={{ color: '#ef4444', marginBottom: '1rem', padding: '0.75rem', background: '#fef2f2', borderRadius: '0.5rem' }}>{error}</div>}

                                {/* Two Column Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    {/* Credential Name */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Credential Name *</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g., Production AWS"
                                            required
                                            style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.938rem', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* AWS Account ID */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>AWS Account ID *</label>
                                        <input
                                            type="text"
                                            value={accountId}
                                            onChange={(e) => setAccountId(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                                            placeholder="123456789012"
                                            required
                                            maxLength={12}
                                            style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.938rem', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* Default Region */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Default Region</label>
                                        <select
                                            value={region}
                                            onChange={(e) => setRegion(e.target.value)}
                                            style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.938rem', boxSizing: 'border-box', cursor: 'pointer' }}
                                        >
                                            {AWS_REGIONS.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Access Type */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Access Type *</label>
                                        <select
                                            value={accessType}
                                            onChange={(e) => setAccessType(e.target.value as 'read' | 'write')}
                                            required
                                            style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.938rem', boxSizing: 'border-box', cursor: 'pointer' }}
                                        >
                                            <option value="write">Write (Provision + Discover)</option>
                                            <option value="read">Read-Only (Discover Only)</option>
                                        </select>
                                    </div>

                                    {/* Access Key ID */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Access Key ID *</label>
                                        <input
                                            type="text"
                                            value={accessKeyId}
                                            onChange={(e) => setAccessKeyId(e.target.value)}
                                            placeholder="AKIAIOSFODNN7EXAMPLE"
                                            required
                                            style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.938rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* Secret Access Key */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Secret Access Key *</label>
                                        <input
                                            type="password"
                                            value={secretAccessKey}
                                            onChange={(e) => setSecretAccessKey(e.target.value)}
                                            placeholder="••••••••••••••••••••"
                                            required
                                            style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.938rem', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>

                                <p style={{ fontSize: '0.813rem', color: '#6b7280', marginTop: '1rem', margin: '1rem 0 0 0' }}>
                                    🔒 Credentials are encrypted at rest and cannot be viewed after creation.
                                </p>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '0 0 1rem 1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
                                >
                                    {submitting ? 'Creating...' : '✓ Create Credential'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>

    );
}


// User Permissions Tab
function PermissionsTab({ users, teams, onRefresh }: { users: any[], teams: any[], onRefresh: () => void }) {
    const [updating, setUpdating] = useState<string | null>(null);
    const [editingTeams, setEditingTeams] = useState<string | null>(null);
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

    const handleRoleChange = async (userId: string, newRole: string) => {
        console.log('🔔 handleRoleChange called!', { userId, newRole });
        setUpdating(userId);
        try {
            const user = users.find(u => u.id === userId);
            if (!user) return;

            // Get token from localStorage for Authorization header
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            console.log('Updating role for user:', userId, 'to:', newRole);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/v1/users/${userId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    role: newRole
                }),
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (!response.ok) {
                throw new Error(`Failed to update user role: ${response.status} ${JSON.stringify(responseData)}`);
            }

            alert(`✅ Successfully updated ${user.name}'s role to ${newRole}`);
            await onRefresh();
        } catch (error) {
            console.error('Failed to update role:', error);
            alert(`❌ Failed to update user role. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUpdating(null);
        }
    };

    const openTeamEditor = (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (user) {
            setSelectedTeams(user.team_ids || []);
            setEditingTeams(userId);
        }
    };

    const handleTeamToggle = (teamId: string) => {
        setSelectedTeams(prev =>
            prev.includes(teamId)
                ? prev.filter(id => id !== teamId)
                : [...prev, teamId]
        );
    };

    const saveTeamChanges = async () => {
        if (!editingTeams) return;

        setUpdating(editingTeams);
        try {
            const user = users.find(u => u.id === editingTeams);
            if (!user) return;

            // Get token from localStorage for Authorization header
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/v1/users/${editingTeams}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    team_ids: selectedTeams
                }),
            });

            if (!response.ok) throw new Error('Failed to update user teams');

            alert(`✅ Successfully updated ${user.name}'s team assignments`);
            await onRefresh();
            setEditingTeams(null);
        } catch (error) {
            console.error('Failed to update teams:', error);
            alert('❌ Failed to update team assignments. Please try again.');
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h2>User Permissions</h2>
                <p>Manage user roles and team assignments</p>
            </div>

            <div className={styles.usersTable}>
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Teams</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <div className={styles.userCell}>
                                        <div className={styles.userAvatar}>
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={user.name} />
                                            ) : (
                                                user.name.substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <span>{user.name}</span>
                                    </div>
                                </td>
                                <td>{user.email}</td>
                                <td>
                                    <select
                                        value={user.role}
                                        className={styles.roleSelect}
                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                        disabled={updating === user.id}
                                        style={{ opacity: updating === user.id ? 0.5 : 1 }}
                                    >
                                        <option value="superadmin">🔑 Superadmin</option>
                                        <option value="lead">👔 Lead</option>
                                        <option value="dev">👨‍💻 Developer</option>
                                    </select>
                                </td>
                                <td>
                                    <div className={styles.teamBadges}>
                                        {teams.filter(t => user.team_ids?.includes(t.id)).map(team => (
                                            <span key={team.id} className={styles.teamBadge}>{team.name}</span>
                                        ))}
                                        {(!user.team_ids || user.team_ids.length === 0) && (
                                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No teams</span>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <button
                                        className={styles.editButton}
                                        onClick={() => openTeamEditor(user.id)}
                                        disabled={updating === user.id}
                                    >
                                        Edit Teams
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Team Editor Modal */}
            {editingTeams && (
                <div className={styles.modal} onClick={() => setEditingTeams(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Edit Team Assignments</h3>
                            <button className={styles.closeButton} onClick={() => setEditingTeams(null)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                                Select teams for {users.find(u => u.id === editingTeams)?.name}
                            </p>
                            <div className={styles.teamsList}>
                                {teams.map(team => (
                                    <label key={team.id} className={styles.teamCheckbox}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTeams.includes(team.id)}
                                            onChange={() => handleTeamToggle(team.id)}
                                        />
                                        <span>{team.name}</span>
                                        <span className={styles.teamDescription}>{team.description}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelButton} onClick={() => setEditingTeams(null)}>
                                Cancel
                            </button>
                            <button className={styles.saveButton} onClick={saveTeamChanges}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Project Access Tab
function ProjectAccessTab({ users, onRefresh }: { users: any[], onRefresh: () => void }) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h2>Project Access Control</h2>
                <p>Assign which leads and developers can access specific projects</p>
            </div>

            <div className={styles.emptyState}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <h3>Project Access Management</h3>
                <p>This feature will allow you to control which users can access which projects</p>
                <p className={styles.comingSoon}>Coming soon...</p>
            </div>
        </div>
    );
}
