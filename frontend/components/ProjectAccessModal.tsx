import React, { useState } from 'react';
import { Project, Team, User } from '@/lib/types';
import styles from './ProjectAccessModal.module.css';

interface ProjectAccessModalProps {
    project: Project;
    allTeams: Team[];
    allUsers: User[];
    onClose: () => void;
    onSave: (teamIds: string[], userIds: string[]) => Promise<void>;
}

export default function ProjectAccessModal({
    project,
    allTeams,
    allUsers,
    onClose,
    onSave
}: ProjectAccessModalProps) {
    const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(project.team_ids || []);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>(project.user_ids || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleTeamToggle = (teamId: string) => {
        if (selectedTeamIds.includes(teamId)) {
            setSelectedTeamIds(selectedTeamIds.filter(id => id !== teamId));
        } else {
            setSelectedTeamIds([...selectedTeamIds, teamId]);
        }
    };

    const handleUserToggle = (userId: string) => {
        if (selectedUserIds.includes(userId)) {
            setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
        } else {
            setSelectedUserIds([...selectedUserIds, userId]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(selectedTeamIds, selectedUserIds);
            onClose();
        } catch (error) {
            console.error('Failed to save access:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Manage Access: {project.name}</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'teams' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('teams')}
                        >
                            Teams
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            Individual Users
                        </button>
                    </div>

                    <div className={styles.list}>
                        {activeTab === 'teams' ? (
                            allTeams.map(team => (
                                <div
                                    key={team.id}
                                    className={`${styles.item} ${selectedTeamIds.includes(team.id) ? styles.itemSelected : ''}`}
                                    onClick={() => handleTeamToggle(team.id)}
                                >
                                    <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={selectedTeamIds.includes(team.id)}
                                        readOnly
                                    />
                                    <div className={styles.avatar}>
                                        {team.name.substring(0, 1)}
                                    </div>
                                    <div className={styles.info}>
                                        <div className={styles.name}>{team.name}</div>
                                        <div className={styles.description}>{team.description}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            allUsers.map(user => (
                                <div
                                    key={user.id}
                                    className={`${styles.item} ${selectedUserIds.includes(user.id) ? styles.itemSelected : ''}`}
                                    onClick={() => handleUserToggle(user.id)}
                                >
                                    <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={selectedUserIds.includes(user.id)}
                                        readOnly
                                    />
                                    <div className={styles.avatar}>
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} />
                                        ) : (
                                            user.name.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className={styles.info}>
                                        <div className={styles.name}>{user.name}</div>
                                        <div className={styles.description}>{user.email}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                    <button className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
