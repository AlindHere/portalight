'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchGitHubConfig, fetchCatalogScan, syncCatalog, fetchTeams } from '@/lib/api';
import { Team } from '@/lib/types';
import styles from './RegisterModal.module.css';

interface RegisterModalProps {
    onClose: () => void;
    onRegister: () => void;
}

export default function RegisterModal({ onClose, onRegister }: RegisterModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<'checking' | 'config_needed' | 'select_files' | 'syncing' | 'success'>('checking');
    const [teams, setTeams] = useState<Team[]>([]);
    const [files, setFiles] = useState<string[]>([]);
    const [fileTeamMappings, setFileTeamMappings] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkConfig();
    }, []);

    const checkConfig = async () => {
        try {
            const config = await fetchGitHubConfig();
            if (!config || !config.enabled) {
                setStep('config_needed');
            } else {
                // Load teams first
                const teamsData = await fetchTeams();
                setTeams(teamsData || []);

                if (!teamsData || teamsData.length === 0) {
                    setError('No teams found. Please create a team first in Configuration.');
                    setStep('config_needed');
                    return;
                }

                // Then load files
                await loadFiles();
            }
        } catch (err) {
            console.error(err);
            setStep('config_needed');
        }
    };

    const loadFiles = async () => {
        try {
            const data = await fetchCatalogScan();
            setFiles(data.files || []);
            setStep('select_files');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to scan repository. Please check your configuration.');
            setStep('select_files');
        }
    };

    const handleTeamChange = (file: string, teamId: string) => {
        setFileTeamMappings(prev => ({
            ...prev,
            [file]: teamId
        }));
    };

    const handleSync = async () => {
        const selectedFiles = Object.keys(fileTeamMappings);
        if (selectedFiles.length === 0) {
            setError('Please select at least one file and assign a team');
            return;
        }

        // Check all selected files have teams
        const missingTeams = selectedFiles.filter(file => !fileTeamMappings[file]);
        if (missingTeams.length > 0) {
            setError('Please assign a team to all selected files');
            return;
        }

        console.log('[RegisterModal] Starting sync with mappings:', fileTeamMappings);
        setStep('syncing');
        setError(null);

        try {
            // Convert to array format for backend
            const mappings = selectedFiles.map(file => ({
                file,
                team_id: fileTeamMappings[file]
            }));

            console.log('[RegisterModal] Sending mappings to backend:', mappings);
            const result = await syncCatalog(mappings);
            console.log('[RegisterModal] Sync completed successfully:', result);
            setStep('success');
            setTimeout(() => {
                console.log('[RegisterModal] Calling onRegister() to refresh project list');
                onRegister();
                onClose();
            }, 1500);
        } catch (err: any) {
            console.error('[RegisterModal] Sync failed with error:', err);
            setError(err.message || 'Failed to sync files.');
            setStep('select_files');
        }
    };

    const toggleFileSelection = (file: string) => {
        setFileTeamMappings(prev => {
            const newMappings = { ...prev };
            if (newMappings[file]) {
                // Deselect
                delete newMappings[file];
            } else {
                // Select with empty team (user must choose)
                newMappings[file] = '';
            }
            return newMappings;
        });
    };

    const navigateToConfig = () => {
        onClose();
        router.push('/configuration');
    };

    const selectedCount = Object.keys(fileTeamMappings).length;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Import from Catalog</h2>
                        <p className={styles.subtitle}>Sync projects from GitHub repository</p>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.content} style={{ padding: '20px' }}>
                    {step === 'checking' && (
                        <div className={styles.loadingContainer}>
                            <span className={styles.spinner}></span>
                        </div>
                    )}

                    {step === 'config_needed' && (
                        <div className={styles.configNeededContainer}>
                            <div className={styles.iconContainer}>
                                <svg className={styles.largeIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className={styles.messageTitle}>Configuration Required</h3>
                            <p className={styles.messageText}>
                                {error || 'You need to configure the GitHub integration before you can import projects.'}
                            </p>
                            <button
                                onClick={navigateToConfig}
                                className={styles.submitButton}
                            >
                                Go to Configuration
                            </button>
                        </div>
                    )}

                    {step === 'select_files' && (
                        <div>
                            {error && (
                                <div className={styles.errorBox}>
                                    <span>{error}</span>
                                </div>
                            )}

                            <p className={styles.instructionText}>
                                Select the catalog files you want to import:
                            </p>

                            {files.length === 0 ? (
                                <div className={styles.emptyState}>
                                    {error ? 'Unable to load files.' : 'No catalog files found in the configured path.'}
                                </div>
                            ) : (
                                <div className={styles.fileList}>
                                    {files.map(file => {
                                        const isSelected = fileTeamMappings.hasOwnProperty(file);
                                        return (
                                            <div key={file} className={styles.fileItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleFileSelection(file)}
                                                    className={styles.checkbox}
                                                />
                                                <span className={styles.fileName}>{file}</span>
                                                {isSelected && (
                                                    <select
                                                        value={fileTeamMappings[file] || ''}
                                                        onChange={(e) => handleTeamChange(file, e.target.value)}
                                                        className={styles.teamSelect}
                                                    >
                                                        <option value="">-- Select Team --</option>
                                                        {teams.map(team => (
                                                            <option key={team.id} value={team.id}>
                                                                {team.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className={styles.actions}>
                                <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
                                <button
                                    className={styles.submitButton}
                                    onClick={handleSync}
                                    disabled={selectedCount === 0}
                                >
                                    Import {selectedCount > 0 ? `(${selectedCount})` : ''}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'syncing' && (
                        <div className={styles.syncingContainer}>
                            <span className={styles.spinner} style={{ marginBottom: '1rem', display: 'inline-block' }}></span>
                            <p className={styles.messageText}>Syncing selected projects...</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className={styles.successContainer}>
                            <div className={styles.successIconContainer}>
                                <svg className={styles.largeIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className={styles.successTitle}>Import Successful!</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
