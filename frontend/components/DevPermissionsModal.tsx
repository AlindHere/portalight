'use client';

import { useState, useEffect } from 'react';
import { fetchDevProvisioningPermissions, updateDevProvisioningPermissions, UserProvisioningPermissions } from '@/lib/api';
import { User } from '@/lib/types';
import styles from './DevPermissionsModal.module.css';

interface DevPermissionsModalProps {
    user: User;
    onClose: () => void;
    onSave?: () => void;
}

export default function DevPermissionsModal({ user, onClose, onSave }: DevPermissionsModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [s3Enabled, setS3Enabled] = useState(false);
    const [sqsEnabled, setSqsEnabled] = useState(false);
    const [snsEnabled, setSnsEnabled] = useState(false);

    useEffect(() => {
        if (user?.id) {
            loadPermissions();
        }
    }, [user?.id]);

    const loadPermissions = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            const permissions = await fetchDevProvisioningPermissions(user.id);
            setS3Enabled(permissions.s3_enabled || false);
            setSqsEnabled(permissions.sqs_enabled || false);
            setSnsEnabled(permissions.sns_enabled || false);
        } catch (err) {
            // User may not have any permissions yet - this is normal
            console.log('No existing permissions found, defaulting to none');
            setS3Enabled(false);
            setSqsEnabled(false);
            setSnsEnabled(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);

        try {
            await updateDevProvisioningPermissions(user.id, {
                s3_enabled: s3Enabled,
                sqs_enabled: sqsEnabled,
                sns_enabled: snsEnabled,
            });
            onSave?.();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update permissions');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Provisioning Access</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.body}>
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} />
                            ) : (
                                user.name.substring(0, 2).toUpperCase()
                            )}
                        </div>
                        <div className={styles.userDetails}>
                            <h3>{user.name}</h3>
                            <p>{user.email}</p>
                            <span className={styles.roleBadge}>{user.role}</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>Loading permissions...</div>
                    ) : (
                        <>
                            {error && <div className={styles.error}>{error}</div>}

                            <div className={styles.permissionsSection}>
                                <h4>Allow this user to provision:</h4>

                                <div
                                    className={styles.permissionItem}
                                    onClick={() => setS3Enabled(!s3Enabled)}
                                >
                                    <div className={styles.permissionInfo}>
                                        <span className={styles.permissionName}>
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                            S3 Buckets
                                        </span>
                                        <span className={styles.permissionDesc}>Object storage for files and data</span>
                                    </div>
                                    <div className={`${styles.toggle} ${s3Enabled ? styles.toggleActive : ''}`} />
                                </div>

                                <div
                                    className={styles.permissionItem}
                                    onClick={() => setSqsEnabled(!sqsEnabled)}
                                >
                                    <div className={styles.permissionInfo}>
                                        <span className={styles.permissionName}>
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            SQS Queues
                                        </span>
                                        <span className={styles.permissionDesc}>Message queuing service</span>
                                    </div>
                                    <div className={`${styles.toggle} ${sqsEnabled ? styles.toggleActive : ''}`} />
                                </div>

                                <div
                                    className={styles.permissionItem}
                                    onClick={() => setSnsEnabled(!snsEnabled)}
                                >
                                    <div className={styles.permissionInfo}>
                                        <span className={styles.permissionName}>
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                            SNS Topics
                                        </span>
                                        <span className={styles.permissionDesc}>Pub/sub notification service</span>
                                    </div>
                                    <div className={`${styles.toggle} ${snsEnabled ? styles.toggleActive : ''}`} />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelButton} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.saveButton}
                        onClick={handleSave}
                        disabled={loading || saving}
                    >
                        {saving ? 'Saving...' : 'Save Permissions'}
                    </button>
                </div>
            </div>
        </div>
    );
}
