'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchUsers, fetchTeams, createUser, updateUser, deleteUser } from '@/lib/api';
import { User, Team, Role } from '@/lib/types';
import styles from './page.module.css';

export default function MembersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersData, teamsData] = await Promise.all([
                fetchUsers(),
                fetchTeams(),
            ]);
            setUsers(usersData);
            setTeams(teamsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = () => {
        setEditingUser(null);
        setShowModal(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setShowModal(true);
    };

    const handleDeleteUser = async (userId: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            try {
                await deleteUser(userId);
                setUsers(users.filter(u => u.id !== userId));
            } catch (error) {
                console.error('Failed to delete user:', error);
                alert('Failed to delete user');
            }
        }
    };

    const handleSaveUser = async (userData: Partial<User>) => {
        try {
            if (editingUser) {
                const updated = await updateUser({ ...editingUser, ...userData } as User);
                setUsers(users.map(u => u.id === updated.id ? updated : u));
            } else {
                const newUser = await createUser(userData);
                setUsers([...users, newUser]);
            }
            setShowModal(false);
        } catch (error) {
            console.error('Failed to save user:', error);
            alert('Failed to save user');
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getUserTeams = (user: User) => {
        return teams.filter(t => user.team_ids.includes(t.id));
    };

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
                                <h1 className={styles.title}>Team Members</h1>
                                <p className={styles.subtitle}>Manage organization members and roles</p>
                            </div>
                            <button className={styles.addButton} onClick={handleAddUser}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Member
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className={styles.searchBar}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>

                    {/* Members List */}
                    {loading ? (
                        <div className={styles.loading}>Loading members...</div>
                    ) : (
                        <div className={styles.membersList}>
                            {filteredUsers.map((user) => (
                                <div key={user.id} className={styles.memberCard}>
                                    <div className={styles.memberHeader}>
                                        <div className={styles.avatar}>
                                            {user.avatar || user.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className={styles.memberInfo}>
                                            <h3>{user.name}</h3>
                                            <p>{user.email}</p>
                                        </div>
                                    </div>

                                    <div className={styles.memberDetails}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Role:</span>
                                            <span className={`${styles.roleBadge} ${user.role === 'admin' ? styles.roleAdmin : styles.roleDev}`}>
                                                {user.role === 'admin' ? 'Admin' : 'Developer'}
                                            </span>
                                        </div>

                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Teams:</span>
                                            <div className={styles.teamsBadges}>
                                                {getUserTeams(user).map((team) => (
                                                    <span key={team.id} className={styles.teamBadge}>
                                                        {team.name}
                                                    </span>
                                                ))}
                                                {user.team_ids.length === 0 && (
                                                    <span className={styles.noTeams}>No teams</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.memberActions}>
                                        <button
                                            className={styles.editButton}
                                            onClick={() => handleEditUser(user)}
                                        >
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit
                                        </button>
                                        <button
                                            className={styles.deleteButton}
                                            onClick={() => handleDeleteUser(user.id)}
                                        >
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Add/Edit Modal */}
            {showModal && (
                <UserModal
                    user={editingUser}
                    teams={teams}
                    onSave={handleSaveUser}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
}

// User Modal Component
function UserModal({
    user,
    teams,
    onSave,
    onClose,
}: {
    user: User | null;
    teams: Team[];
    onSave: (user: Partial<User>) => void;
    onClose: () => void;
}) {
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        role: user?.role || 'dev' as Role,
        team_ids: user?.team_ids || [] as string[],
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleTeamToggle = (teamId: string) => {
        setFormData({
            ...formData,
            team_ids: formData.team_ids.includes(teamId)
                ? formData.team_ids.filter(id => id !== teamId)
                : [...formData.team_ids, teamId],
        });
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>{user ? 'Edit Member' : 'Add New Member'}</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.modalForm}>
                    <div className={styles.formGroup}>
                        <label>Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Role</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                            className={styles.select}
                        >
                            <option value="dev">Developer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Teams</label>
                        <div className={styles.teamsCheckboxes}>
                            {teams.map((team) => (
                                <label key={team.id} className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={formData.team_ids.includes(team.id)}
                                        onChange={() => handleTeamToggle(team.id)}
                                        className={styles.checkbox}
                                    />
                                    <span>{team.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.cancelButton} onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.saveButton}>
                            {user ? 'Save Changes' : 'Add Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
