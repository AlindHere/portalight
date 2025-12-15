'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchCurrentUser, fetchUsers, fetchTeams, fetchSecrets } from '@/lib/api';
import styles from './page.module.css';

type Tab = 'credentials' | 'permissions' | 'access';

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
                    </div>

                    {/* Tab Content */}
                    <div className={styles.tabContent}>
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
    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h2>AWS Credentials</h2>
                <button className={styles.addButton}>
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
                                <p>AWS Account • Created {new Date(cred.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className={styles.credentialActions}>
                                <button className={styles.editButton}>Edit</button>
                                <button className={styles.deleteButton}>Delete</button>
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
