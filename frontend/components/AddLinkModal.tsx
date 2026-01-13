'use client';

import { useState, useEffect } from 'react';
import { ServiceLink } from '@/lib/types';
import styles from './ConfirmationModal.module.css';
import Image from 'next/image';

interface AddLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (label: string, url: string, icon?: string) => Promise<void>;
    editLink?: ServiceLink | null;
    onUpdate?: (linkId: string, label: string, url: string, icon?: string) => Promise<void>;
}

// Service icons with their brand colors (for the SVG fill) and icon path
const SERVICE_ICONS = [
    { id: 'swagger', label: 'Swagger', color: '#85EA2D' },
    { id: 'confluence', label: 'Confluence', color: '#0052CC' },
    { id: 'argo', label: 'Argo CD', color: '#EF7B4D' },
    { id: 'grafana', label: 'Grafana', color: '#F46800' },
    { id: 'newrelic', label: 'New Relic', color: '#008C99' },
    { id: 'sentry', label: 'Sentry', color: '#362D59' },
    { id: 'datadog', label: 'Datadog', color: '#632CA6' },
    { id: 'postman', label: 'Postman', color: '#FF6C37' },
    { id: 'slack', label: 'Slack', color: '#4A154B' },
    { id: 'jira', label: 'Jira', color: '#0052CC' },
    { id: 'github', label: 'GitHub', color: '#24292F' },
    { id: 'kibana', label: 'Kibana', color: '#005571' },
    { id: 'jenkins', label: 'Jenkins', color: '#D33833' },
    { id: 'k8s', label: 'K8s Cluster', color: '#326CE5' },
    { id: 'pagerduty', label: 'PagerDuty', color: '#06AC38' },
    { id: 'runbook', label: 'Runbook', color: '#374151' },
    { id: 'apidocs', label: 'API Docs', color: '#059669' },
    { id: 'custom', label: 'Custom', color: '#6b7280' },
];

// Icon component that uses the SVG files
const ServiceIconImage = ({ type, size = 18 }: { type: string; size?: number }) => {
    const service = SERVICE_ICONS.find(s => s.id === type);
    return (
        <Image
            src={`/icons/${type}.svg`}
            alt={service?.label || type}
            width={size}
            height={size}
            style={{
                filter: type === 'custom' ? 'none' : 'none',
            }}
        />
    );
};

export default function AddLinkModal({ isOpen, onClose, onAdd, editLink, onUpdate }: AddLinkModalProps) {
    const [selectedIcon, setSelectedIcon] = useState<string>('custom');
    const [label, setLabel] = useState('');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isEditMode = !!editLink;

    // Reset form when modal opens or edit link changes
    useEffect(() => {
        if (isOpen) {
            if (editLink) {
                setLabel(editLink.label);
                setUrl(editLink.url);
                // Try to match icon from label
                const lower = editLink.label.toLowerCase();
                const matchedIcon = SERVICE_ICONS.find(s => lower.includes(s.id) || lower.includes(s.label.toLowerCase()));
                setSelectedIcon(matchedIcon?.id || 'custom');
            } else {
                setLabel('');
                setUrl('');
                setSelectedIcon('custom');
            }
            setError('');
        }
    }, [isOpen, editLink]);

    if (!isOpen) return null;

    const handleIconSelect = (iconId: string) => {
        setSelectedIcon(iconId);
        const service = SERVICE_ICONS.find(s => s.id === iconId);
        if (service && iconId !== 'custom') {
            setLabel(service.label);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!label.trim() || !url.trim()) {
            setError('Label and URL are required');
            return;
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch {
            setError('Please enter a valid URL');
            return;
        }

        setLoading(true);
        try {
            if (isEditMode && editLink && onUpdate) {
                await onUpdate(editLink.id, label, url, selectedIcon);
            } else {
                await onAdd(label, url, selectedIcon);
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save link');
        } finally {
            setLoading(false);
        }
    };

    const selectedService = SERVICE_ICONS.find(s => s.id === selectedIcon);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                <div className={styles.header}>
                    <div className={`${styles.iconWrapper} ${styles.info}`}>
                        <svg className={`${styles.icon} ${styles.info}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <h3 className={styles.title}>{isEditMode ? 'Edit Link' : 'Add Link'}</h3>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.body}>
                        {error && (
                            <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.5rem', background: '#fef2f2', borderRadius: '0.375rem' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.625rem' }}>
                                Choose Icon
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                                {SERVICE_ICONS.map((service) => (
                                    <button
                                        key={service.id}
                                        type="button"
                                        onClick={() => handleIconSelect(service.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.375rem',
                                            padding: '0.625rem 0.25rem',
                                            border: selectedIcon === service.id ? '2px solid #10b981' : '1px solid #e5e7eb',
                                            borderRadius: '0.5rem',
                                            background: selectedIcon === service.id ? '#ecfdf5' : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }}
                                        title={service.label}
                                    >
                                        {/* White rounded box with colored logo inside */}
                                        <div style={{
                                            width: '2.25rem',
                                            height: '2.25rem',
                                            background: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                        }}>
                                            <ServiceIconImage type={service.id} size={20} />
                                        </div>
                                        <span style={{ fontSize: '0.625rem', color: '#6b7280', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {service.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                Label
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {selectedService && (
                                    <div style={{
                                        width: '2.5rem',
                                        height: '2.5rem',
                                        background: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    }}>
                                        <ServiceIconImage type={selectedService.id} size={22} />
                                    </div>
                                )}
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="e.g., Swagger Prod"
                                    style={{
                                        flex: 1,
                                        padding: '0.625rem 0.875rem',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.938rem',
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                URL
                            </label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://..."
                                style={{
                                    width: '100%',
                                    padding: '0.625rem 0.875rem',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.938rem',
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.footer}>
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
                            className={`${styles.confirmButton} ${styles.primary}`}
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : (isEditMode ? 'Update Link' : 'Add Link')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Export for use in other components
export { SERVICE_ICONS, ServiceIconImage };
