'use client';

import { useState } from 'react';
import styles from './RegisterModal.module.css';

interface RegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RegisterData) => Promise<void>;
}

export interface RegisterData {
    repoUrl: string;
    pat: string;
    branch?: string;
}

export default function RegisterModal({ isOpen, onClose, onSubmit }: RegisterModalProps) {
    const [repoUrl, setRepoUrl] = useState('');
    const [pat, setPat] = useState('');
    const [branch, setBranch] = useState('main');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await onSubmit({ repoUrl, pat, branch });
            // Reset form
            setRepoUrl('');
            setPat('');
            setBranch('main');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to register repository');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setRepoUrl('');
            setPat('');
            setBranch('main');
            setError(null);
            onClose();
        }
    };

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Register Component</h2>
                        <p className={styles.subtitle}>Add a GitHub repository containing catalog-info.yaml</p>
                    </div>
                    <button
                        className={styles.closeButton}
                        onClick={handleClose}
                        disabled={loading}
                        aria-label="Close modal"
                    >
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Repository URL */}
                    <div className={styles.formGroup}>
                        <label htmlFor="repoUrl" className={styles.label}>
                            Repository URL
                            <span className={styles.required}>*</span>
                        </label>
                        <input
                            id="repoUrl"
                            type="url"
                            className={styles.input}
                            placeholder="https://github.com/org/repo"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            required
                            disabled={loading}
                        />
                        <p className={styles.hint}>
                            GitHub repository URL containing catalog-info.yaml file
                        </p>
                    </div>

                    {/* Personal Access Token */}
                    <div className={styles.formGroup}>
                        <label htmlFor="pat" className={styles.label}>
                            Personal Access Token (PAT)
                            <span className={styles.required}>*</span>
                        </label>
                        <input
                            id="pat"
                            type="password"
                            className={styles.input}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            value={pat}
                            onChange={(e) => setPat(e.target.value)}
                            required
                            disabled={loading}
                        />
                        <p className={styles.hint}>
                            GitHub PAT with <code>repo</code> read access
                        </p>
                    </div>

                    {/* Branch */}
                    <div className={styles.formGroup}>
                        <label htmlFor="branch" className={styles.label}>
                            Branch
                        </label>
                        <input
                            id="branch"
                            type="text"
                            className={styles.input}
                            placeholder="main"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            disabled={loading}
                        />
                        <p className={styles.hint}>
                            Default: main
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className={styles.infoBox}>
                        <div className={styles.infoIcon}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className={styles.infoContent}>
                            <h4>catalog-info.yaml Format</h4>
                            <p>Your repository should contain a <code>catalog-info.yaml</code> file with service metadata including name, description, owner, tags, and links.</p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className={styles.errorBox}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className={styles.spinner}></span>
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Register Repository
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
