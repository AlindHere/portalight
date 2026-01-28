'use client';

import { useState, useEffect } from 'react';
import styles from './ConfirmationModal.module.css';
import { ServiceResourceMapping, DiscoveredResourceDB } from '@/lib/types';

interface MapResourceModalProps {
    isOpen: boolean;
    serviceId: string;
    projectId: string;
    existingMappings: ServiceResourceMapping[];
    onClose: () => void;
    onMap: (resourceIds: string[]) => Promise<void>;
    fetchProjectResources: (projectId: string) => Promise<DiscoveredResourceDB[]>;
}

const RESOURCE_ICONS: Record<string, string> = {
    s3: '🪣',
    sqs: '📨',
    sns: '🔔',
    rds: '🗄️',
    lambda: '⚡',
    dynamodb: '📊',
    ec2: '💻',
};

export default function MapResourceModal({
    isOpen,
    serviceId,
    projectId,
    existingMappings,
    onClose,
    onMap,
    fetchProjectResources,
}: MapResourceModalProps) {
    const [availableResources, setAvailableResources] = useState<DiscoveredResourceDB[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (isOpen && projectId) {
            loadResources();
        }
    }, [isOpen, projectId]);

    const loadResources = async () => {
        setFetching(true);
        try {
            const resources = await fetchProjectResources(projectId);
            // Filter out already mapped resources
            const existingIds = new Set(existingMappings.map(m => m.discovered_resource_id));
            const available = resources.filter(r => !existingIds.has(r.id));
            setAvailableResources(available);
        } catch (err) {
            console.error('Failed to load resources:', err);
        } finally {
            setFetching(false);
        }
    };

    if (!isOpen) return null;

    const toggleResource = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        if (selectedIds.length === 0) return;

        setLoading(true);
        try {
            await onMap(selectedIds);
            setSelectedIds([]);
            onClose();
        } catch (err) {
            console.error('Failed to map resources:', err);
        } finally {
            setLoading(false);
        }
    };

    const uniqueTypes = Array.from(new Set(availableResources.map(r => r.resource_type)));
    const filteredResources = filter === 'all'
        ? availableResources
        : availableResources.filter(r => r.resource_type === filter);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className={styles.header}>
                    <div className={`${styles.iconWrapper} ${styles.info}`}>
                        <svg className={`${styles.icon} ${styles.info}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                    </div>
                    <h3 className={styles.title}>Map AWS Resources</h3>
                </div>

                <div className={styles.body} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Filter tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setFilter('all')}
                            style={{
                                padding: '0.375rem 0.75rem',
                                border: filter === 'all' ? '2px solid #10b981' : '1px solid #e5e7eb',
                                borderRadius: '0.5rem',
                                background: filter === 'all' ? '#ecfdf5' : 'white',
                                cursor: 'pointer',
                                fontSize: '0.813rem',
                            }}
                        >
                            All ({availableResources.length})
                        </button>
                        {uniqueTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => setFilter(type)}
                                style={{
                                    padding: '0.375rem 0.75rem',
                                    border: filter === type ? '2px solid #10b981' : '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    background: filter === type ? '#ecfdf5' : 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.813rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                }}
                            >
                                <span>{RESOURCE_ICONS[type] || '📦'}</span>
                                <span style={{ textTransform: 'uppercase' }}>{type}</span>
                                <span>({availableResources.filter(r => r.resource_type === type).length})</span>
                            </button>
                        ))}
                    </div>

                    {/* Resource list */}
                    <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                        {fetching ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                Loading resources...
                            </div>
                        ) : filteredResources.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                No unmapped resources available
                            </div>
                        ) : (
                            filteredResources.map(resource => (
                                <div
                                    key={resource.id}
                                    onClick={() => toggleResource(resource.id)}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        borderBottom: '1px solid #f3f4f6',
                                        cursor: 'pointer',
                                        background: selectedIds.includes(resource.id) ? '#ecfdf5' : 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(resource.id)}
                                        onChange={() => { }}
                                        style={{ width: '1rem', height: '1rem' }}
                                    />
                                    <span style={{ fontSize: '1.25rem' }}>
                                        {RESOURCE_ICONS[resource.resource_type] || '📦'}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, color: '#111827' }}>
                                            {resource.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            {resource.resource_type.toUpperCase()} • {resource.region}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {selectedIds.length > 0 && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#10b981' }}>
                            {selectedIds.length} resource(s) selected
                        </div>
                    )}
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
                        type="button"
                        className={`${styles.confirmButton} ${styles.primary}`}
                        onClick={handleSubmit}
                        disabled={loading || selectedIds.length === 0}
                    >
                        {loading ? 'Mapping...' : `Map ${selectedIds.length} Resource(s)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
