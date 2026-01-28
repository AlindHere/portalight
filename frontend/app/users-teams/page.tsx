'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import DevPermissionsModal from '@/components/DevPermissionsModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { useToast } from '@/components/ui/Toast';
import { fetchUsers, fetchTeams, fetchCurrentUser, updateUser, updateTeamMembers, createTeam, fetchProjects, deleteTeam } from '@/lib/api';
import { User, Team, CurrentUserResponse, Project } from '@/lib/types';
import styles from './page.module.css';

export default function UsersTeamsPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingPermissionsFor, setEditingPermissionsFor] = useState<User | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [viewingTeam, setViewingTeam] = useState<string | null>(null);

    // Delete team confirmation modal state
    const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [currentUserData, usersData, teamsData, projectsData] = await Promise.all([
                fetchCurrentUser(),
                fetchUsers(),
                fetchTeams(),
                fetchProjects(),
            ]);
            setCurrentUser(currentUserData.user);
            setUsers(usersData || []);
            setTeams(teamsData || []);
            setProjects(projectsData || []);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (user: User, newRole: 'superadmin' | 'lead' | 'dev') => {
        if (!currentUser?.role || currentUser.role !== 'superadmin') {
            showToast('Only superadmins can change roles', 'error');
            return;
        }

        try {
            const updated = await updateUser({ ...user, role: newRole });
            setUsers(users.map(u => u.id === updated.id ? updated : u));
            showToast(`Updated ${user.name}'s role to ${newRole}`, 'success');
        } catch (error) {
            console.error('Failed to update role:', error);
            showToast('Failed to update role', 'error');
        }
    };

    const handleTeamToggle = async (user: User, teamId: string) => {
        if (!currentUser?.role || currentUser.role !== 'superadmin') {
            showToast('Only superadmins can modify team assignments', 'error');
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
            showToast('Failed to update teams', 'error');
        }
    };

    // Request to delete team (shows confirmation modal)
    const requestDeleteTeam = (teamId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setTeamToDelete(teamId);
        setShowDeleteTeamModal(true);
    };

    // Actually delete the team after confirmation
    const confirmDeleteTeam = async () => {
        if (!teamToDelete) return;
        setShowDeleteTeamModal(false);

        try {
            await deleteTeam(teamToDelete);
            setTeams(teams.filter(t => t.id !== teamToDelete));
            // Update users to remove team from their list locally
            setUsers(users.map(u => ({
                ...u,
                team_ids: u.team_ids.filter(id => id !== teamToDelete)
            })));
            showToast('Team deleted successfully', 'success');
        } catch (error) {
            console.error('Failed to delete team:', error);
            showToast('Failed to delete team', 'error');
        } finally {
            setTeamToDelete(null);
        }
    };



    const getUserTeams = (user: User) => {
        return teams.filter(t => user.team_ids.includes(t.id));
    };

    const filteredUsers = selectedTeam === 'all'
        ? users
        : users.filter(u => u.team_ids.includes(selectedTeam));

    const isAdmin = currentUser?.role === 'superadmin';

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
                            <CustomDropdown
                                value={selectedTeam}
                                onChange={(value) => setSelectedTeam(value)}
                                options={[
                                    { value: 'all', label: `All Users (${users.length})` },
                                    { value: 'unassigned', label: `Unassigned (${users.filter(u => u.team_ids.length === 0).length})` },
                                    ...teams.map((team) => ({
                                        value: team.id,
                                        label: `${team.name} (${users.filter(u => u.team_ids.includes(team.id)).length})`
                                    }))
                                ]}
                                placeholder="Select team..."
                            />
                        </div>

                        <div className={styles.stats}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{users.filter(u => u.role === 'superadmin').length}</span>
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
                                                        {user.avatar ? (
                                                            <img src={user.avatar} alt={user.name} />
                                                        ) : (
                                                            user.name.substring(0, 2).toUpperCase()
                                                        )}
                                                    </div>
                                                    <span className={styles.userName}>{user.name}</span>
                                                </div>
                                            </td>
                                            <td>{user.email}</td>
                                            <td>
                                                <span className={`${styles.roleBadge} ${user.role === 'superadmin' ? styles.roleAdmin : user.role === 'lead' ? styles.roleLead : styles.roleDev}`}>
                                                    {user.role === 'superadmin' ? '👑 Superadmin' : user.role === 'lead' ? '👔 Lead' : '👨‍💻 Developer'}
                                                </span>
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
                                                    <div className={styles.actionButtons}>
                                                        <button
                                                            className={styles.editButton}
                                                            onClick={() => setEditingUser(user)}
                                                        >
                                                            Edit Teams
                                                        </button>
                                                        {user.role === 'dev' && (
                                                            <button
                                                                className={styles.accessButton}
                                                                onClick={() => setEditingPermissionsFor(user)}
                                                                title="Manage provisioning permissions"
                                                            >
                                                                Edit Access
                                                            </button>
                                                        )}
                                                    </div>
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
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Teams Overview</h2>
                            {(currentUser?.role === 'superadmin' || currentUser?.role === 'lead') && (
                                <button
                                    className={styles.createTeamButton}
                                    onClick={() => setCreatingTeam(true)}
                                >
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Team
                                </button>
                            )}
                        </div>
                        <div className={styles.teamsGrid}>
                            {teams.map((team) => {
                                const teamMembers = users.filter(u => u.team_ids.includes(team.id));
                                return (
                                    <div
                                        key={team.id}
                                        className={styles.teamCard}
                                        onClick={() => setViewingTeam(team.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className={styles.teamHeader}>
                                            <div className={styles.teamIcon}>
                                                {team.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3>{team.name}</h3>
                                                <p>{team.description}</p>
                                            </div>
                                            {currentUser?.role === 'superadmin' && (
                                                <button
                                                    onClick={(e) => requestDeleteTeam(team.id, e)}
                                                    className={styles.deleteTeamButton}
                                                    title="Delete Team"
                                                >
                                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.teamStats}>
                                            <span>{teamMembers.length} members</span>
                                            <span>•</span>
                                            <span>{team.service_ids?.length || 0} services</span>
                                        </div>
                                        <div className={styles.teamMembers}>
                                            {teamMembers.slice(0, 5).map((member) => (
                                                <div key={member.id} className={styles.memberBadge}>
                                                    <div className={styles.memberAvatar}>
                                                        {member.avatar && member.avatar.startsWith('http') ? (
                                                            <img src={member.avatar} alt={member.name} />
                                                        ) : (
                                                            member.avatar || member.name.substring(0, 2).toUpperCase()
                                                        )}
                                                    </div>
                                                    <span>{member.name.split(' ')[0]}</span>
                                                </div>
                                            ))}
                                            {teamMembers.length > 5 && (
                                                <div className={styles.memberBadge}>
                                                    <div className={styles.memberAvatar}>+{teamMembers.length - 5}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Team Modal */}
            {creatingTeam && (
                <CreateTeamModal
                    users={users}
                    onSave={async (teamData, memberIds) => {
                        try {
                            if (!teamData.name) throw new Error('Team name is required');
                            const newTeam = await createTeam(teamData.name, teamData.description || '');
                            // Update team members if any were selected
                            if (memberIds.length > 0 && newTeam.id) {
                                await updateTeamMembers(newTeam.id, memberIds);
                            }
                            await loadData();
                            setCreatingTeam(false);
                            showToast('Team created successfully!', 'success');
                        } catch (error) {
                            console.error('Failed to create team:', error);
                            showToast(`Failed to create team: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                        }
                    }}
                    onClose={() => setCreatingTeam(false)}
                />
            )}

            {/* Team Detail Modal */}
            {viewingTeam && (
                <TeamDetailModal
                    team={teams.find(t => t.id === viewingTeam)!}
                    members={users.filter(u => u.team_ids.includes(viewingTeam))}
                    allUsers={users}
                    allProjects={projects}
                    onClose={() => setViewingTeam(null)}
                    onMembersUpdate={async (teamId, memberIds) => {
                        try {
                            await updateTeamMembers(teamId, memberIds);
                            await loadData();
                        } catch (error) {
                            throw error;
                        }
                    }}
                    currentUser={currentUser}
                    onDelete={async (teamId) => {
                        try {
                            await deleteTeam(teamId);
                            setTeams(teams.filter(t => t.id !== teamId));
                            setUsers(users.map(u => ({
                                ...u,
                                team_ids: u.team_ids.filter(id => id !== teamId)
                            })));
                            setViewingTeam(null);
                            showToast('Team deleted successfully', 'success');
                        } catch (error) {
                            console.error('Failed to delete team:', error);
                            showToast('Failed to delete team', 'error');
                        }
                    }}
                />
            )}

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
                            showToast('Teams updated successfully', 'success');
                        } catch (error) {
                            console.error('Failed to update teams:', error);
                            showToast('Failed to update teams', 'error');
                        }
                    }}
                    onClose={() => setEditingUser(null)}
                />
            )}

            {/* Dev Permissions Modal */}
            {editingPermissionsFor && (
                <DevPermissionsModal
                    user={editingPermissionsFor}
                    onClose={() => setEditingPermissionsFor(null)}
                    onSave={() => {
                        // Optionally refresh data or show success message
                        setEditingPermissionsFor(null);
                    }}
                />
            )}

            {/* Delete Team Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteTeamModal}
                title="Delete Team"
                message="Are you sure you want to delete this team? This action cannot be undone."
                resourceName={teams.find(t => t.id === teamToDelete)?.name}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={confirmDeleteTeam}
                onCancel={() => {
                    setShowDeleteTeamModal(false);
                    setTeamToDelete(null);
                }}
            />
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

// Create Team Modal Component
function CreateTeamModal({
    users,
    onSave,
    onClose,
}: {
    users: User[];
    onSave: (teamData: Partial<Team>, memberIds: string[]) => void;
    onClose: () => void;
}) {
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    const handleMemberToggle = (userId: string) => {
        setSelectedMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSubmit = () => {
        if (!name.trim()) {
            showToast('Team name is required', 'error');
            return;
        }
        onSave({ name, description }, selectedMembers);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className={styles.modalHeader}>
                    <h2>Create New Team</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Team Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={styles.formInput}
                            placeholder="e.g., Platform Team, Product Team"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={styles.formTextarea}
                            placeholder="Brief description of the team's responsibilities"
                            rows={3}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Team Members ({selectedMembers.length} selected)</label>
                        <div className={styles.memberSelectionList}>
                            {users.map((user) => (
                                <label key={user.id} className={styles.memberSelectionItem}>
                                    <input
                                        type="checkbox"
                                        checked={selectedMembers.includes(user.id)}
                                        onChange={() => handleMemberToggle(user.id)}
                                        className={styles.checkbox}
                                    />
                                    <div className={styles.userAvatar}>
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} />
                                        ) : (
                                            user.name.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className={styles.memberInfo}>
                                        <div className={styles.memberName}>{user.name}</div>
                                        <div className={styles.memberEmail}>{user.email}</div>
                                    </div>
                                    <span className={`${styles.roleBadge} ${user.role === 'superadmin' ? styles.roleAdmin : user.role === 'lead' ? styles.roleLead : styles.roleDev}`}>
                                        {user.role === 'superadmin' && '🔑'}
                                        {user.role === 'lead' && '👔'}
                                        {user.role === 'dev' && '👨‍💻'}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.modalActions}>
                    <button className={styles.cancelButton} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.saveButton}
                        onClick={handleSubmit}
                    >
                        Create Team
                    </button>
                </div>
            </div>
        </div>
    );
}

// Team Detail Modal Component
function TeamDetailModal({
    team,
    members,
    allUsers,
    allProjects,
    onClose,
    onMembersUpdate,
    currentUser,
    onDelete,
}: {
    team: Team;
    members: User[];
    allUsers: User[];
    allProjects: Project[];
    onClose: () => void;
    onMembersUpdate: (teamId: string, memberIds: string[]) => Promise<void>;
    currentUser: User | null;
    onDelete: (teamId: string) => Promise<void>;
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<string[]>(members.map(m => m.id));
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const availableUsers = allUsers.filter(u => !selectedMembers.includes(u.id));

    const handleAddMember = (userId: string) => {
        setSelectedMembers(prev => [...prev, userId]);
    };

    const handleRemoveMember = (userId: string) => {
        setSelectedMembers(prev => prev.filter(id => id !== userId));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onMembersUpdate(team.id, selectedMembers);
            setIsEditing(false);
            showToast('Team members updated successfully!', 'success');
        } catch (error) {
            console.error('Failed to update members:', error);
            showToast('Failed to update team members. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const currentMembers = allUsers.filter(u => selectedMembers.includes(u.id));

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <div className={styles.modalHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className={styles.teamIcon} style={{ width: '3rem', height: '3rem', fontSize: '1.5rem' }}>
                            {team.name.substring(0, 1)}
                        </div>
                        <div>
                            <h2 style={{ margin: 0 }}>{team.name}</h2>
                            <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                                {team.description}
                            </p>
                        </div>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {/* Team Members */}
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#111827' }}>
                                Team Members ({currentMembers.length})
                            </h3>
                            {!isEditing ? (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {currentUser?.role === 'superadmin' && (
                                        <button
                                            className={styles.deleteTeamButton}
                                            onClick={() => setShowDeleteConfirm(true)}
                                            title="Delete Team"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                background: '#fee2e2',
                                                color: '#dc2626',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                fontSize: '0.813rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete Team
                                        </button>
                                    )}
                                    <button
                                        className={styles.editButton}
                                        onClick={() => setIsEditing(true)}
                                    >
                                        Manage Members
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className={styles.cancelButton}
                                        onClick={() => {
                                            setSelectedMembers(members.map(m => m.id));
                                            setIsEditing(false);
                                        }}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className={styles.saveButton}
                                        onClick={handleSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {!isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {currentMembers.length > 0 ? (
                                    currentMembers.map((member) => (
                                        <div key={member.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: '#f9fafb',
                                            borderRadius: '0.5rem'
                                        }}>
                                            <div className={styles.userAvatar}>
                                                {member.avatar ? (
                                                    <img src={member.avatar} alt={member.name} />
                                                ) : (
                                                    member.name.substring(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500, color: '#111827' }}>{member.name}</div>
                                                <div style={{ fontSize: '0.813rem', color: '#6b7280' }}>{member.email}</div>
                                            </div>
                                            <span className={`${styles.roleBadge} ${member.role === 'superadmin' ? styles.roleAdmin : member.role === 'lead' ? styles.roleLead : styles.roleDev}`}>
                                                {member.role === 'superadmin' && '🔑 Superadmin'}
                                                {member.role === 'lead' && '👔 Lead'}
                                                {member.role === 'dev' && '👨‍💻 Developer'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No members in this team yet
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                {/* Current Members with Remove */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                                        Current Members
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {currentMembers.map((member) => (
                                            <div key={member.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem',
                                                background: '#f9fafb',
                                                borderRadius: '0.5rem'
                                            }}>
                                                <div className={styles.userAvatar} style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>
                                                    {member.avatar ? (
                                                        <img src={member.avatar} alt={member.name} />
                                                    ) : (
                                                        member.name.substring(0, 2).toUpperCase()
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{member.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.email}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        background: '#fee2e2',
                                                        color: '#dc2626',
                                                        border: 'none',
                                                        borderRadius: '0.375rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Available Users to Add */}
                                {availableUsers.length > 0 && (
                                    <div>
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                                            Add Members
                                        </h4>
                                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {availableUsers.map((user) => (
                                                <div key={user.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem',
                                                    background: 'white',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '0.5rem'
                                                }}>
                                                    <div className={styles.userAvatar} style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>
                                                        {user.avatar ? (
                                                            <img src={user.avatar} alt={user.name} />
                                                        ) : (
                                                            user.name.substring(0, 2).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{user.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddMember(user.id)}
                                                        style={{
                                                            padding: '0.25rem 0.5rem',
                                                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                                                            color: '#10b981',
                                                            border: '1px solid #10b981',
                                                            borderRadius: '0.375rem',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Team Projects */}
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>
                            Projects
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {allProjects.filter(p => p.owner_team_id === team.id || p.team_ids?.includes(team.id)).length > 0 ? (
                                allProjects
                                    .filter(p => p.owner_team_id === team.id || p.team_ids?.includes(team.id))
                                    .map((project) => (
                                        <div
                                            key={project.id}
                                            onClick={() => router.push(`/projects/${project.id}`)}
                                            style={{
                                                padding: '0.75rem',
                                                background: 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '0.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#d1d5db';
                                                e.currentTarget.style.backgroundColor = '#f9fafb';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#e5e7eb';
                                                e.currentTarget.style.backgroundColor = 'white';
                                            }}
                                        >
                                            <div style={{
                                                width: '2.5rem',
                                                height: '2.5rem',
                                                borderRadius: '0.375rem',
                                                background: '#f3f4f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.25rem'
                                            }}>
                                                {project.name.substring(0, 1)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500, color: '#111827' }}>{project.name}</div>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{project.description}</div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '9999px',
                                                background: project.owner_team_id === team.id ? '#ecfdf5' : '#eff6ff',
                                                color: project.owner_team_id === team.id ? '#059669' : '#2563eb',
                                                fontWeight: 500
                                            }}>
                                                {project.owner_team_id === team.id ? 'Owner' : 'Member'}
                                            </span>
                                        </div>
                                    ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                    No projects assigned to this team yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!isEditing && (
                    <div className={styles.modalActions}>
                        <button className={styles.saveButton} onClick={onClose}>
                            Close
                        </button>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
                        <div className={styles.modal} style={{ maxWidth: '400px', padding: '1.5rem' }}>
                            <h3 style={{ marginTop: 0, color: '#dc2626' }}>Delete Team?</h3>
                            <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
                                Are you sure you want to delete <strong>{team.name}</strong>? This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    className={styles.cancelButton}
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.375rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                    onClick={async () => {
                                        setIsDeleting(true);
                                        await onDelete(team.id);
                                        setIsDeleting(false);
                                        setShowDeleteConfirm(false);
                                    }}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete Team'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
