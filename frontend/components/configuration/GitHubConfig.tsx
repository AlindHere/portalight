import { useState, useEffect } from 'react';
import { fetchGitHubConfig, updateGitHubConfig } from '@/lib/api';
import styles from '../../app/configuration/page.module.css';

export default function GitHubConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        repo_owner: '',
        repo_name: '',
        branch: 'main',
        projects_path: 'projects',
        auth_type: 'pat',
        personal_access_token: '',
        enabled: true,
        last_scan_at: null as string | null,
        last_scan_status: null as string | null,
        last_scan_error: null as string | null,
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await fetchGitHubConfig();
            if (data) {
                setConfig(prev => ({
                    ...prev,
                    ...data,
                    personal_access_token: data.personal_access_token_encrypted || '',
                }));
            }
        } catch (error) {
            console.error('Failed to load config:', error);
            setMessage({ type: 'error', text: 'Failed to load configuration' });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await updateGitHubConfig(config);
            setMessage({ type: 'success', text: 'Configuration saved successfully' });
        } catch (error: any) {
            console.error('Failed to save config:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to save configuration' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className={styles.loading}>Loading configuration...</div>;

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <div>
                    <h2>GitHub Integration</h2>
                    <p>Configure the centralized metadata repository to sync projects and services.</p>
                </div>
            </div>

            {message && (
                <div className={`${styles.messageBox} ${message.type === 'success' ? styles.messageSuccess : styles.messageError}`}>
                    {message.text}
                </div>
            )}

            {config.last_scan_at && (
                <div className={styles.statusSection}>
                    <h3 className={styles.statusTitle}>Sync Status</h3>
                    <div className={styles.statusGrid}>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>Last Scan</span>
                            <span className={styles.statusValue}>
                                {new Date(config.last_scan_at).toLocaleString()}
                            </span>
                        </div>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>Status</span>
                            <span className={`${styles.statusBadge} ${config.last_scan_status === 'success' ? styles.statusSuccess : styles.statusFailed}`}>
                                {config.last_scan_status === 'success' ? 'Success' : 'Failed'}
                            </span>
                        </div>
                        {config.last_scan_error && (
                            <div className={styles.errorDetails}>
                                <span className={styles.errorLabel}>Error Details:</span>
                                <code className={styles.errorCode}>{config.last_scan_error}</code>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Repository Owner</label>
                        <input
                            type="text"
                            required
                            className={styles.formInput}
                            value={config.repo_owner}
                            onChange={e => setConfig({ ...config, repo_owner: e.target.value })}
                            placeholder="e.g. myorg"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Repository Name</label>
                        <input
                            type="text"
                            required
                            className={styles.formInput}
                            value={config.repo_name}
                            onChange={e => setConfig({ ...config, repo_name: e.target.value })}
                            placeholder="e.g. service-catalog"
                        />
                    </div>
                </div>

                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Branch</label>
                        <input
                            type="text"
                            required
                            className={styles.formInput}
                            value={config.branch}
                            onChange={e => setConfig({ ...config, branch: e.target.value })}
                            placeholder="main"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Projects Path</label>
                        <input
                            type="text"
                            required
                            className={styles.formInput}
                            value={config.projects_path}
                            onChange={e => setConfig({ ...config, projects_path: e.target.value })}
                            placeholder="projects"
                        />
                    </div>
                </div>

                <div className={styles.formDivider}>
                    <h3 className={styles.formSectionTitle}>Authentication</h3>

                    <div className={styles.radioGroup}>
                        <label className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="auth_type"
                                value="pat"
                                checked={config.auth_type === 'pat'}
                                onChange={() => setConfig({ ...config, auth_type: 'pat' })}
                            />
                            <span>Personal Access Token (PAT)</span>
                        </label>
                        <label className={`${styles.radioLabel} ${styles.radioLabelDisabled}`}>
                            <input
                                type="radio"
                                name="auth_type"
                                value="github_app"
                                checked={config.auth_type === 'github_app'}
                                onChange={() => setConfig({ ...config, auth_type: 'github_app' })}
                                disabled
                            />
                            <span>GitHub App (Coming Soon)</span>
                        </label>
                    </div>

                    {config.auth_type === 'pat' && (
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Personal Access Token</label>
                            <input
                                type="password"
                                className={styles.formInput}
                                value={config.personal_access_token}
                                onChange={e => setConfig({ ...config, personal_access_token: e.target.value })}
                                placeholder="ghp_..."
                            />
                            <p className={styles.helperText}>
                                Token must have <code>repo</code> scope (or <code>contents:read</code> for fine-grained tokens).
                            </p>
                        </div>
                    )}
                </div>

                <div className={styles.formFooter}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={e => setConfig({ ...config, enabled: e.target.checked })}
                        />
                        <span className={styles.checkboxText}>Enable Integration</span>
                    </label>

                    <button
                        type="submit"
                        disabled={saving}
                        className={styles.saveButton}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
}
