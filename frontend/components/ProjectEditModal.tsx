import React, { useState, useEffect } from 'react';
import { Project } from '@/lib/types';
import { fetchAWSCredentials } from '@/lib/api';
import styles from './ProjectEditModal.module.css';
import CustomDropdown from './ui/CustomDropdown';

interface Secret {
    id: string;
    name: string;
    provider: string;
    region?: string;
}

interface ProjectEditModalProps {
    project: Project;
    onClose: () => void;
    onSave: (data: Partial<Project>) => Promise<void>;
}

export default function ProjectEditModal({
    project,
    onClose,
    onSave
}: ProjectEditModalProps) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description);
    const [confluenceUrl, setConfluenceUrl] = useState(project.confluence_url || '');
    const [avatar, setAvatar] = useState(project.avatar || '');
    const [secretId, setSecretId] = useState(project.secret_id || '');
    const [credentials, setCredentials] = useState<Secret[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadCredentials();
    }, []);

    const loadCredentials = async () => {
        try {
            const creds = await fetchAWSCredentials();
            setCredentials(creds || []);
        } catch (error) {
            console.error('Failed to load credentials:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                name,
                description,
                confluence_url: confluenceUrl,
                avatar,
                secret_id: secretId || undefined
            });
            onClose();
        } catch (error) {
            console.error('Failed to save project:', error);
            alert('Failed to save project changes');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>Edit Project</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.modalBody}>
                        <div className={styles.formRow}>
                            <div className={styles.leftColumn}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label} htmlFor="name">Project Name</label>
                                    <input
                                        id="name"
                                        type="text"
                                        className={styles.input}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        placeholder="e.g. Factory"
                                    />
                                </div>
                                <div className={styles.tipBox}>
                                    <strong>Tip:</strong>
                                    <p>Keep project names short for better visibility in the sidebar.</p>
                                </div>
                            </div>

                            <div className={styles.rightColumn}>
                                <label className={styles.label}>Project Avatar</label>
                                <div className={styles.avatarUploadBox}>
                                    {avatar ? (
                                        <img
                                            src={avatar}
                                            alt="Preview"
                                            className={styles.avatarPreview}
                                        />
                                    ) : (
                                        <div className={styles.avatarPlaceholder}>
                                            {name ? name.substring(0, 1).toUpperCase() : '?'}
                                        </div>
                                    )}

                                    <label htmlFor="avatar-upload" className={styles.changeImageLabel}>
                                        Change Image
                                    </label>
                                    <input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className={styles.hiddenInput}
                                    />

                                    {avatar && (
                                        <button
                                            type="button"
                                            onClick={() => setAvatar('')}
                                            className={styles.removeAvatarButton}
                                        >
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                className={styles.textarea}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                                placeholder="Brief description of the project..."
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="confluence">Confluence URL</label>
                            <div className={styles.inputWithIcon}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.inputIcon}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <input
                                    id="confluence"
                                    type="url"
                                    className={styles.input}
                                    value={confluenceUrl}
                                    onChange={(e) => setConfluenceUrl(e.target.value)}
                                    placeholder="https://confluence.company.com/..."
                                />
                            </div>
                        </div>

                        {/* AWS Credential Selector */}
                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="awsCredential">
                                🔑 AWS Credential
                            </label>
                            <CustomDropdown
                                options={[
                                    { value: '', label: '-- Select AWS Credential --' },
                                    ...credentials.map((cred) => ({
                                        value: cred.id,
                                        label: `${cred.name} (${cred.region || 'Global'})`
                                    }))
                                ]}
                                value={secretId}
                                onChange={setSecretId}
                                placeholder="Select AWS Credential"
                            />

                            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                                This credential will be used for resource discovery, provisioning, and metrics for this project.
                            </p>
                        </div>


                    </div>

                    <div className={styles.modalActions}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.saveButton}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <div className={styles.spinner}></div>
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

