'use client';

import { useState, useEffect } from 'react';
import { fetchAWSCredentials, discoverResources, associateResources, DiscoveredResource, DiscoveryResponse } from '@/lib/api';
import { Secret } from '@/lib/types';
import styles from './ResourceDiscoveryModal.module.css';
import CustomDropdown from './ui/CustomDropdown';

interface ResourceDiscoveryModalProps {
    projectId: string;
    onClose: () => void;
    onResourcesAssociated?: (resources: DiscoveredResource[]) => void;
}

const RESOURCE_TYPE_INFO: Record<string, { icon: string; label: string; color: string }> = {
    s3: { icon: '🪣', label: 'S3 Bucket', color: '#FF9900' },
    sqs: { icon: '📨', label: 'SQS Queue', color: '#FF4F8B' },
    sns: { icon: '🔔', label: 'SNS Topic', color: '#DD344C' },
    rds: { icon: '🗄️', label: 'RDS Database', color: '#3B48CC' },
    lambda: { icon: '⚡', label: 'Lambda Function', color: '#FA7343' },
};

const AWS_REGIONS = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-east-2', name: 'US East (Ohio)' },
    { id: 'us-west-1', name: 'US West (N. California)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'EU (Ireland)' },
    { id: 'eu-central-1', name: 'EU (Frankfurt)' },
    { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
    { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
];

export default function ResourceDiscoveryModal({ projectId, onClose, onResourcesAssociated }: ResourceDiscoveryModalProps) {
    const [credentials, setCredentials] = useState<Secret[]>([]);
    const [selectedCredential, setSelectedCredential] = useState<string>('');
    const [selectedRegion, setSelectedRegion] = useState<string>('us-east-1');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['s3', 'sqs', 'sns', 'rds', 'lambda']);

    const [loading, setLoading] = useState(true);
    const [discovering, setDiscovering] = useState(false);
    const [associating, setAssociating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [discoveredResources, setDiscoveredResources] = useState<DiscoveredResource[]>([]);
    const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');


    useEffect(() => {
        loadCredentials();
    }, []);

    const loadCredentials = async () => {
        try {
            const creds = await fetchAWSCredentials();
            setCredentials(creds || []);
            if (creds && creds.length > 0) {
                setSelectedCredential(creds[0].id);
            }
        } catch (err) {
            console.error('Failed to load credentials:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDiscover = async () => {
        if (!selectedCredential) {
            setError('Please select an AWS credential');
            return;
        }

        setDiscovering(true);
        setError(null);

        try {
            const response = await discoverResources(selectedCredential, selectedRegion, selectedTypes);
            setDiscoveredResources(response.resources || []);
        } catch (err: any) {
            setError(err.message || 'Failed to discover resources');
        } finally {
            setDiscovering(false);
        }
    };

    const handleToggleResource = (arn: string) => {
        const newSelected = new Set(selectedResources);
        if (newSelected.has(arn)) {
            newSelected.delete(arn);
        } else {
            newSelected.add(arn);
        }
        setSelectedResources(newSelected);
    };

    const handleSelectAll = () => {
        const filtered = filteredResources;
        if (selectedResources.size === filtered.length) {
            setSelectedResources(new Set());
        } else {
            setSelectedResources(new Set(filtered.map(r => r.arn)));
        }
    };

    const handleToggleType = (type: string) => {
        if (selectedTypes.includes(type)) {
            setSelectedTypes(selectedTypes.filter(t => t !== type));
        } else {
            setSelectedTypes([...selectedTypes, type]);
        }
    };

    const handleAssociate = async () => {
        const selected = discoveredResources.filter(r => selectedResources.has(r.arn));
        if (selected.length === 0) return;

        setAssociating(true);
        setError(null);

        try {
            const result = await associateResources(projectId, selectedCredential, selected);
            console.log('Associated resources:', result);
            onResourcesAssociated?.(selected);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to associate resources');
            setAssociating(false);
        }
    };

    const filteredResources = discoveredResources.filter(r => {
        const matchesType = filterType === 'all' || r.type === filterType;
        const matchesSearch = searchQuery === '' || r.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesSearch;
    });

    const resourcesByType = discoveredResources.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);


    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Discover AWS Resources</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loading}>Loading credentials...</div>
                    ) : credentials.length === 0 ? (
                        <div className={styles.empty}>
                            <p>No AWS credentials configured. Please add credentials in Configuration first.</p>
                        </div>
                    ) : discoveredResources.length === 0 ? (
                        <div className={styles.discoveryForm}>
                            {error && <div className={styles.error}>{error}</div>}

                            <div className={styles.formGroup}>
                                <label>AWS Credential</label>
                                <CustomDropdown
                                    options={credentials.map(cred => ({
                                        value: cred.id,
                                        label: `${cred.name} (${cred.account_id || 'No account ID'})`
                                    }))}
                                    value={selectedCredential}
                                    onChange={setSelectedCredential}
                                    placeholder="Select a credential"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Region</label>
                                <CustomDropdown
                                    options={AWS_REGIONS.map(r => ({
                                        value: r.id,
                                        label: r.name
                                    }))}
                                    value={selectedRegion}
                                    onChange={setSelectedRegion}
                                    placeholder="Select a region"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Resource Types</label>
                                <div className={styles.typeSelector}>
                                    {Object.entries(RESOURCE_TYPE_INFO).map(([type, info]) => (
                                        <button
                                            key={type}
                                            className={`${styles.typeBtn} ${selectedTypes.includes(type) ? styles.typeBtnActive : ''}`}
                                            onClick={() => handleToggleType(type)}
                                            style={{ borderColor: selectedTypes.includes(type) ? info.color : undefined }}
                                        >
                                            <span>{info.icon}</span>
                                            <span>{info.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                className={styles.discoverButton}
                                onClick={handleDiscover}
                                disabled={discovering || selectedTypes.length === 0}
                            >
                                {discovering ? 'Discovering...' : 'Discover Resources'}
                            </button>
                        </div>
                    ) : (
                        <div className={styles.resultsView}>
                            <div className={styles.resultsHeader}>
                                <h3>{discoveredResources.length} resources found</h3>
                                <button
                                    className={styles.rediscoverBtn}
                                    onClick={() => setDiscoveredResources([])}
                                >
                                    ← Back to Search
                                </button>
                            </div>

                            <div className={styles.filterTabs}>
                                <button
                                    className={`${styles.filterTab} ${filterType === 'all' ? styles.filterTabActive : ''}`}
                                    onClick={() => setFilterType('all')}
                                >
                                    All ({discoveredResources.length})
                                </button>
                                {Object.entries(resourcesByType).map(([type, count]) => (
                                    <button
                                        key={type}
                                        className={`${styles.filterTab} ${filterType === type ? styles.filterTabActive : ''}`}
                                        onClick={() => setFilterType(type)}
                                    >
                                        {RESOURCE_TYPE_INFO[type]?.icon} {type.toUpperCase()} ({count})
                                    </button>
                                ))}
                            </div>

                            {/* Search Input */}
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem 0.75rem 2.5rem',
                                        fontSize: '0.938rem',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        outline: 'none',
                                    }}
                                />
                                <svg
                                    style={{
                                        position: 'absolute',
                                        left: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '1.25rem',
                                        height: '1.25rem',
                                        color: '#9ca3af',
                                    }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {searchQuery && (
                                    <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#6b7280' }}>
                                        {filteredResources.length} match{filteredResources.length !== 1 ? 'es' : ''}
                                    </span>
                                )}
                            </div>

                            <div className={styles.selectActions}>
                                <button className={styles.selectAllBtn} onClick={handleSelectAll}>
                                    {selectedResources.size === filteredResources.length ? 'Deselect All' : 'Select All'}
                                </button>

                                <span className={styles.selectedCount}>
                                    {selectedResources.size} selected
                                </span>
                            </div>

                            <div className={styles.resourceList}>
                                {filteredResources.map(resource => (
                                    <div
                                        key={resource.arn}
                                        className={`${styles.resourceCard} ${selectedResources.has(resource.arn) ? styles.resourceCardSelected : ''}`}
                                        onClick={() => handleToggleResource(resource.arn)}
                                    >
                                        <div className={styles.resourceCheck}>
                                            <input
                                                type="checkbox"
                                                checked={selectedResources.has(resource.arn)}
                                                onChange={() => { }}
                                            />
                                        </div>
                                        <div
                                            className={styles.resourceIcon}
                                            style={{ background: RESOURCE_TYPE_INFO[resource.type]?.color || '#6b7280' }}
                                        >
                                            {RESOURCE_TYPE_INFO[resource.type]?.icon || '☁️'}
                                        </div>
                                        <div className={styles.resourceInfo}>
                                            <h4>{resource.name}</h4>
                                            <p>{resource.arn}</p>
                                            <span className={styles.resourceStatus}>{resource.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {discoveredResources.length > 0 && (
                    <div className={styles.footer}>
                        <button className={styles.cancelButton} onClick={onClose} disabled={associating}>
                            Cancel
                        </button>
                        <button
                            className={styles.associateButton}
                            onClick={handleAssociate}
                            disabled={selectedResources.size === 0 || associating}
                        >
                            {associating ? 'Associating...' : `Associate ${selectedResources.size} Resources`}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
