'use client';

import React, { useState, useEffect } from 'react';
import { Service, ServiceLink, Team, User } from '@/lib/types';
import { updateService, updateServiceLink, addServiceLink, deleteServiceLink, fetchTeams, fetchUsers } from '@/lib/api';

interface EditServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: Service;
    onSave: () => void;
}

export default function EditServiceModal({ isOpen, onClose, service, onSave }: EditServiceModalProps) {
    const [owner, setOwner] = useState(service.owner || '');
    const [links, setLinks] = useState<ServiceLink[]>(service.links || []);
    const [newLinkLabel, setNewLinkLabel] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Data for multi-select
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [availableOwners, setAvailableOwners] = useState<User[]>([]);

    // Edit link state
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [editLinkLabel, setEditLinkLabel] = useState('');
    const [editLinkUrl, setEditLinkUrl] = useState('');

    useEffect(() => {
        setOwner(service.owner || '');
        setLinks(service.links || []);
        if (isOpen) {
            loadData();
        }
    }, [service, isOpen]);

    const loadData = async () => {
        setLoadingData(true);
        try {
            const [teamsData, usersData] = await Promise.all([
                fetchTeams(),
                fetchUsers()
            ]);
            setTeams(teamsData);
            setUsers(usersData);

            // Filter users based on service team
            if (service.team) {
                // service.team is the team ID
                const team = teamsData.find(t => t.id === service.team);
                if (team && team.member_ids) {
                    const teamMembers = usersData.filter(u => team.member_ids.includes(u.id));
                    setAvailableOwners(teamMembers);
                } else {
                    setAvailableOwners([]);
                }
            } else {
                setAvailableOwners([]);
            }
        } catch (err) {
            console.error('Failed to load teams/users:', err);
            // Don't block editing if fetch fails, just fall back to text input
        } finally {
            setLoadingData(false);
        }
    };

    const handleOwnerChange = (selectedOwner: string) => {
        const currentOwners = owner ? owner.split(',').map(s => s.trim()).filter(Boolean) : [];
        let newOwners;
        if (currentOwners.includes(selectedOwner)) {
            newOwners = currentOwners.filter(o => o !== selectedOwner);
        } else {
            newOwners = [...currentOwners, selectedOwner];
        }
        setOwner(newOwners.join(', '));
    };

    const startEditingLink = (link: ServiceLink) => {
        setEditingLinkId(link.id);
        setEditLinkLabel(link.label);
        setEditLinkUrl(link.url);
        setError('');
    };

    const cancelEditingLink = () => {
        setEditingLinkId(null);
        setEditLinkLabel('');
        setEditLinkUrl('');
        setError('');
    };

    const saveEditLink = async () => {
        if (!editingLinkId || !editLinkLabel.trim() || !editLinkUrl.trim()) {
            setError('Link label and URL are required');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await updateServiceLink(service.id, editingLinkId, editLinkLabel, editLinkUrl);
            // Update local state
            setLinks(links.map(l => l.id === editingLinkId ? { ...l, label: editLinkLabel, url: editLinkUrl } : l));
            setEditingLinkId(null);
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update link');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const handleSaveDetails = async () => {
        setSaving(true);
        setError('');
        try {
            await updateService(service.id, { owner });
            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleAddLink = async () => {
        if (!newLinkLabel.trim() || !newLinkUrl.trim()) {
            setError('Link label and URL are required');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await addServiceLink(service.id, newLinkLabel, newLinkUrl);
            setNewLinkLabel('');
            setNewLinkUrl('');
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add link');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLink = async (linkId: string) => {
        setSaving(true);
        try {
            await deleteServiceLink(service.id, linkId);
            setLinks(links.filter(l => l.id !== linkId));
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete link');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateLink = async (linkId: string, label: string, url: string) => {
        setSaving(true);
        try {
            await updateServiceLink(service.id, linkId, label, url);
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update link');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: 'white',
                borderRadius: '0.75rem',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '80vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Edit Service</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            color: '#6b7280',
                        }}
                    >
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '0.5rem',
                            color: '#dc2626',
                            marginBottom: '1rem',
                            fontSize: '0.875rem',
                        }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                                Service Owner
                            </label>

                            {loadingData ? (
                                <div style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                                    Loading team members...
                                </div>
                            ) : availableOwners.length > 0 ? (
                                <div>
                                    <div style={{
                                        border: '1px solid #d1d5db',
                                        borderRadius: '0.5rem',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        background: '#fff'
                                    }}>
                                        {availableOwners.map(user => {
                                            const isChecked = owner.split(',').map(s => s.trim()).includes(user.name);
                                            return (
                                                <label key={user.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '0.625rem 0.75rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #f3f4f6',
                                                    background: isChecked ? '#ecfdf5' : 'transparent'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleOwnerChange(user.name)}
                                                        style={{
                                                            marginRight: '0.75rem',
                                                            width: '1rem',
                                                            height: '1rem',
                                                            accentColor: '#10b981',
                                                            cursor: 'pointer'
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{user.name}</span>
                                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{user.email}</span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                        Select one or more owners from the team.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <input
                                        type="text"
                                        value={owner}
                                        onChange={e => setOwner(e.target.value)}
                                        placeholder="Enter owner name or email"
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.75rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                        }}
                                    />
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                        The person or team responsible for this service.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveDetails}
                        disabled={saving}
                        style={{
                            padding: '0.5rem 1rem',
                            background: saving ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
