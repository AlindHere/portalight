'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchCurrentUser, fetchTeams } from '@/lib/api';
import { CurrentUserResponse, Team } from '@/lib/types';
import styles from './page.module.css';

export default function AccountPage() {
    const router = useRouter();
    const [data, setData] = useState<CurrentUserResponse | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAccountData();
    }, []);

    const loadAccountData = async () => {
        try {
            const [userData, teamsData] = await Promise.all([
                fetchCurrentUser(),
                fetchTeams(),
            ]);
            setData(userData);
            setTeams(teamsData);
        } catch (error) {
            console.error('Failed to load account data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.loading}>Loading account information...</div>
                    </div>
                </main>
            </>
        );
    }

    if (!data) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.error}>Failed to load account data</div>
                    </div>
                </main>
            </>
        );
    }

    const userTeams = teams.filter(t => t.member_ids.includes(data.user.id));

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
                        <h1 className={styles.title}>My Account</h1>
                        <p className={styles.subtitle}>View your profile and permissions</p>
                    </div>

                    <div className={styles.content}>
                        {/* Profile Card */}
                        <div className={styles.card}>
                            <div className={styles.profileHeader}>
                                <div className={styles.avatar}>
                                    {data.user.avatar ? (
                                        <img src={data.user.avatar} alt={data.user.name} />
                                    ) : (
                                        data.user.name.substring(0, 2).toUpperCase()
                                    )}
                                </div>
                                <div className={styles.profileInfo}>
                                    <h2 className={styles.name}>{data.user.name}</h2>
                                    <p className={styles.email}>{data.user.email}</p>
                                    <div className={styles.roleBadge}>
                                        <span className={`${styles.badge} ${data.user.role === 'superadmin' ? styles.badgeAdmin : data.user.role === 'lead' ? styles.badgeLead : styles.badgeDev}`}>
                                            {data.user.role === 'superadmin' ? '👑 Superadmin' : data.user.role === 'lead' ? '👔 Lead' : '👨‍💻 Developer'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Teams Card */}
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                My Teams ({userTeams.length})
                            </h3>
                            <div className={styles.teamsList}>
                                {userTeams.map((team) => (
                                    <div key={team.id} className={styles.teamItem}>
                                        <div className={styles.teamIcon}>
                                            {team.name.substring(0, 1)}
                                        </div>
                                        <div className={styles.teamInfo}>
                                            <h4>{team.name}</h4>
                                            <p>{team.description}</p>
                                            <div className={styles.teamMeta}>
                                                <span>{team.member_ids.length} members</span>
                                                <span>•</span>
                                                <span>{team.service_ids.length} services</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {userTeams.length === 0 && (
                                    <div className={styles.emptyState}>
                                        <p>You are not assigned to any teams yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Permissions Card */}
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Permissions
                            </h3>
                            <div className={styles.permissionsGrid}>
                                {data.permissions.map((perm, index) => (
                                    <div key={index} className={styles.permissionItem}>
                                        <div className={styles.permissionInfo}>
                                            <span className={styles.permissionResource}>
                                                {perm.resource.charAt(0).toUpperCase() + perm.resource.slice(1)}
                                            </span>
                                            <span className={styles.permissionAction}>{perm.action}</span>
                                        </div>
                                        <div className={`${styles.permissionStatus} ${perm.allowed ? styles.allowed : styles.denied}`}>
                                            {perm.allowed ? (
                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
