'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchAuditLogs, fetchCurrentUser } from '@/lib/api';
import { AuditLog, User } from '@/lib/types';
import styles from './page.module.css';

export default function AuditLogsPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [filters, setFilters] = useState({
        userEmail: '',
        action: '',
    });
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    useEffect(() => {
        checkAccess();
        loadLogs();

        // Poll for new logs every 30 seconds
        const interval = setInterval(loadLogs, 30000);
        return () => clearInterval(interval);
    }, [filters]);

    const checkAccess = async () => {
        try {
            const data = await fetchCurrentUser();
            setCurrentUser(data.user);

            // Only superadmin and lead can access
            if (data.user.role !== 'superadmin' && data.user.role !== 'lead') {
                router.push('/');
            }
        } catch (error) {
            console.error('Access check failed:', error);
            router.push('/');
        }
    };

    const loadLogs = async () => {
        try {
            const data = await fetchAuditLogs(filters);
            setLogs(data);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionBadgeClass = (action: string) => {
        if (action.includes('provision')) return styles.badgeProvision;
        if (action.includes('create')) return styles.badgeCreate;
        if (action.includes('update')) return styles.badgeUpdate;
        if (action.includes('delete')) return styles.badgeDelete;
        return styles.badgeDefault;
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatDetails = (details: string) => {
        try {
            return JSON.stringify(JSON.parse(details), null, 2);
        } catch {
            return details;
        }
    };

    const exportToCSV = () => {
        const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource Name', 'Status'];
        const rows = logs.map(log => [
            log.timestamp,
            log.user_email,
            log.action,
            log.resource_type,
            log.resource_name || '',
            log.status
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.loading}>Loading audit logs...</div>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    {/* Page Header */}
                    <div className={styles.pageHeader}>
                        <button onClick={() => router.push('/')} className={styles.backButton}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </button>
                        <h1 className={styles.title}>Audit Logs</h1>
                        <p className={styles.subtitle}>Track all write operations and user actions</p>
                    </div>

                    {/* Filters and Actions */}
                    <div className={styles.controls}>
                        <div className={styles.filters}>
                            <input
                                type="text"
                                placeholder="Filter by user email..."
                                className={styles.filterInput}
                                value={filters.userEmail}
                                onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })}
                            />
                            <select
                                className={styles.filterSelect}
                                value={filters.action}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                            >
                                <option value="">All Actions</option>
                                <option value="provision_resource">Provision Resource</option>
                                <option value="create_project">Create Project</option>
                                <option value="update_project">Update Project</option>
                                <option value="delete_project">Delete Project</option>
                            </select>
                        </div>
                        <button onClick={exportToCSV} className={styles.exportButton}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export CSV
                        </button>
                    </div>

                    {/* Logs Table */}
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th>Resource</th>
                                    <th>Resource Name</th>
                                    <th>Status</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className={styles.emptyState}>
                                            No audit logs found. Logs will appear here when users perform actions like provisioning resources or creating projects.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <Fragment key={log.id}>
                                            <tr className={styles.tableRow}>
                                                <td className={styles.timestamp}>
                                                    {formatTimestamp(log.timestamp)}
                                                </td>
                                                <td>
                                                    <div className={styles.userCell}>
                                                        <div className={styles.userName}>{log.user_name}</div>
                                                        <div className={styles.userEmail}>{log.user_email}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`${styles.badge} ${getActionBadgeClass(log.action)}`}>
                                                        {log.action.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td>{log.resource_type}</td>
                                                <td>{log.resource_name || '-'}</td>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${log.status === 'success' ? styles.statusSuccess : styles.statusFailure}`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className={styles.detailsButton}
                                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                                    >
                                                        {expandedLog === log.id ? 'Hide' : 'Show'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedLog === log.id && (
                                                <tr className={styles.detailsRow}>
                                                    <td colSpan={7}>
                                                        <div className={styles.detailsContent}>
                                                            <strong>Details:</strong>
                                                            <pre className={styles.detailsJson}>{formatDetails(log.details)}</pre>
                                                            {log.ip_address && (
                                                                <div className={styles.ipAddress}>
                                                                    <strong>IP Address:</strong> {log.ip_address}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.footer}>
                        <p className={styles.totalCount}>Total Logs: {logs.length}</p>
                        <p className={styles.refreshNote}>Auto-refreshes every 30 seconds</p>
                    </div>
                </div>
            </main>
        </>
    );
}
