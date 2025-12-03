'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchUsers, fetchTeams, fetchCurrentUser, updateUser, updateTeamMembers } from '@/lib/api';
import { User, Team, CurrentUserResponse } from '@/lib/types';
import styles from './page.module.css';

export default function UsersTeamsPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string>('all');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [currentUserData, usersData, teamsData] = await Promise.all([
                fetchCurrentUser(),
                fetchUsers(),
                fetchTeams(),
            ]);
            setCurrentUser(currentUserData.user);
            setUsers(usersData);
            setTeams(teamsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (user: User, newRole: 'admin' | 'dev') => {
        if (!currentUser?.role || currentUser.role !== 'admin') {
            alert('Only admins can change roles');
            return;
        }

        try {
            const updated = await updateUser({ ...user, role: newRole });
            setUsers(users.map(u => u.id === updated.id ? updated : u));
        } catch (error) {
            console.error('Failed to update role:', error);
            alert('Failed to update role');
        }
    };

    const handleTeamToggle = async (user: User, teamId: string) => {
        if (!currentUser?.role || currentUser.role !== 'admin') {
            alert('Only admins can modify team assignments');
            return;
        }

        try {
            const newTeamIds = user.team_ids.includes(teamId)
                ? user.team_ids.filter(id => id !== teamId)
                : [...user.team_ids, teamId];

            const updated = await updateUser({ ...user, team_ids: newTeamIds });
            setUsers(users.map(u => u.id === updated.id ? updated : u));
        } catch (error) {
            console.error('Failed to update teams:', error);
            alert('Failed to update teams');
        }
    };

    const getUserTeams = (user: User) => {
        return teams.filter(t => user.team_ids.includes(t.id));
    };

    const filteredUsers = selectedTeam === 'all'
        ? users
        : users.filter(u => u.team_ids.includes(selectedTeam));

    const isAdmin = currentUser?.role === 'admin';

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
                        <div className={styles.headerContent}>
                            <div>
                                <h1 className={styles.title}>Users & Teams</h1>
                                <p className={styles.subtitle}>
                                    Manage organization members,roles, and team assignments
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className={styles.filterBar}>
                        <div className={styles.filterGroup}>
                            <label>Filter by Team:</label>
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className={styles.select}
                            >
                                <option value="all">All Users ({users.length})</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name} ({users.filter(u => u.team_ids.includes(team.id)).length})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.stats}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{users.filter(u => u.role === 'admin').length}</span>
                                <span className={styles.statLabel}>Admins</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{users.filter(u => u.role === 'dev').length}</span>
                                <span className={styles.statLabel}>Developers</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{teams.length}</span>
                                <span className={styles.statLabel}>Teams</span>
                            </div>
                        </div>
                    </div>

                    {/* Users Table */}
                    {loading ? (
                        <div className={styles.loading}>Loading users...</div>
                    ) : (
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Teams</th>
                                        <th>Joined</th>
                                        {isAdmin && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className={styles.userCell}>
                                                    <div className={styles.userAvatar}>
                                                        {user.avatar || user.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className={styles.userName}>{user.name}</span>
                                                </div>
                                            </td>
                                            <td>{user.email}</td>
                                            <td>
                                                {isAdmin ? (
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => handleRoleChange(user, e.target.value as 'admin' | 'dev')}
                                                        className={`${styles.roleSelect} ${user.role === 'admin' ? styles.roleAdmin : styles.roleDev}`}
                                                    >
                                                        <option value="admin">👑 Admin</option>
                                                        <option value="dev">👨‍💻 Developer</option>
                                                    </select>
                                                ) : (
                                                    <span className={`${styles.roleBadge} ${user.role === 'admin' ? styles.roleAdmin : styles.roleDev}`}>
                                                        {user.role === 'admin' ? '👑 Admin' : '👨‍💻 Developer'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className={styles.teamsCell}>
                                                    {getUserTeams(user).map((team) => (
                                                        <span key={team.id} className={styles.teamBadge}>
                                                            {team.name}
                                                        </span>
                                                    ))}
                                                    {user.team_ids.length === 0 && (
                                                        <span className={styles.noTeams}>No teams</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                {new Date(user.created_at).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            {isAdmin && (
                                                <td>
                                                    <button
                                                        className={styles.editButton}
                                                        onClick={() => setEditingUser(user)}
                                                    >
                                                        Edit Teams
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Teams Overview */}
                    <div className={styles.teamsSection}>
                        <h2 className={styles.sectionTitle}>Teams Overview</h2>
                        <div className={styles.teamsGrid}>
                            {teams.map((team) => {
                                const teamMembers = users.filter(u => u.team_ids.includes(team.id));
                                return (
                                    <div key={team.id} className={styles.teamCard}>
                                        <div className={styles.teamHeader}>
                                            <div className={styles.teamIcon}>
                                                {team.name.substring(0, 1)}
                                            </div>
                                            <div>
                                                <h3>{team.name}</h3>
                                                <p>{team.description}</p>
                                            </div>
                                        </div>
                                        <div className={styles.teamStats}>
                                            <span>{teamMembers.length} members</span>
                                            <span>•</span>
                                            <span>{team.service_ids?.length || 0} services</span>
                                        </div>
                                        <div className={styles.teamMembers}>
                                            {teamMembers.map((member) => (
                                                <div key={member.id} className={styles.memberBadge}>
                                                    <div className={styles.memberAvatar}>
                                                        {member.avatar || member.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span>{member.name.split(' ')[0]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            {/* Edit Teams Modal */}
            {editingUser && (
                <EditTeamsModal
                    user={editingUser}
                    teams={teams}
                    onSave={async (teamIds) => {
                        try {
                            const updated = await updateUser({ ...editingUser, team_ids: teamIds });
                            setUsers(users.map(u => u.id === updated.id ? updated : u));
                            setEditingUser(null);
                        } catch (error) {
                            console.error('Failed to update teams:', error);
                            alert('Failed to update teams');
                        }
                    }}
                    onClose={() => setEditingUser(null)}
                />
            )}
        </>
    );
}

// Edit Teams Modal Component
function EditTeamsModal({
    user,
    teams,
    onSave,
    onClose,
}: {
    user: User;
    teams: Team[];
    onSave: (teamIds: string[]) => void;
    onClose: () => void;
}) {
    const [selectedTeams, setSelectedTeams] = useState<string[]>(user.team_ids);

    const handleToggle = (teamId: string) => {
        setSelectedTeams(prev =>
            prev.includes(teamId)
                ? prev.filter(id => id !== teamId)
                : [...prev, teamId]
        );
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>Edit Teams for {user.name}</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.modalBody}>
                    <p className={styles.modalDescription}>
                        Select the teams that {user.name.split(' ')[0]} should be a member of:
                    </p>

                    <div className={styles.teamsList}>
                        {teams.map((team) => (
                            <label key={team.id} className={styles.teamCheckbox}>
                                <input
                                    type="checkbox"
                                    checked={selectedTeams.includes(team.id)}
                                    onChange={() => handleToggle(team.id)}
                                    className={styles.checkbox}
                                />
                                <div className={styles.teamInfo}>
                                    <div className={styles.teamName}>{team.name}</div>
                                    <div className={styles.teamDesc}>{team.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div className={styles.modalActions}>
                    <button className={styles.cancelButton} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.saveButton}
                        onClick={() => onSave(selectedTeams)}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
