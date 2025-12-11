'use client';

import { useState } from 'react';
import styles from './RegisterModal.module.css';

interface RegisterModalProps {
    onClose: () => void;
    onRegister: () => void;
}

export default function RegisterModal({ onClose, onRegister }: RegisterModalProps) {
    const [name, setName] = useState('');
    const [repoUrl, setRepoUrl] = useState('');
    const [pat, setPat] = useState('');
    const [branch, setBranch] = useState('main');
    const [path, setPath] = useState('catalog-info.yaml');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8080/api/v1/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    repo_url: repoUrl,
                    pat,
                    branch,
                    path,
                }),
            });

            if (!response.ok) throw new Error('Failed to register catalog');

            onRegister();
            onClose();
        } catch (err) {
            console.error('Registration failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to register catalog');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Register Component</h2>
                        <p className={styles.subtitle}>Add a GitHub repository containing catalog-info.yaml</p>
                    </div>
                    <button
                        className={styles.closeButton}
                        onClick={onClose}
                        disabled={loading}
                        aria-label="Close modal"
                    >
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Name Field */}
                    <div className={styles.formGroup}>
                        <label htmlFor="name" className={styles.label}>
                            Name
                            <span className={styles.required}>*</span>
                        </label>
                        <input
                            id="name"
                            type="text"
                            className={styles.input}
                            placeholder="e.g., Factory, Payments Platform"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={loading}
                        />
                        <p className={styles.hint}>
                            Friendly name for this component/project
                        </p>
                    </div>

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

                    {/* Path */}
                    <div className={styles.formGroup}>
                        <label htmlFor="path" className={styles.label}>
                            Path to catalog-info.yaml
                        </label>
                        <input
                            id="path"
                            type="text"
                            className={styles.input}
                            placeholder="catalog-info.yaml"
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            disabled={loading}
                        />
                        <p className={styles.hint}>
                            Path within repository (e.g., <code>docs/catalog-info.yaml</code>)
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
                            onClick={onClose}
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
