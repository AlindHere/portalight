'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { fetchCurrentUser } from '@/lib/api';
import { User } from '@/lib/types';
import styles from './Header.module.css';

export default function Header() {
    return (
        <Suspense fallback={<header className={styles.header}><div className={styles.container}></div></header>}>
            <HeaderContent />
        </Suspense>
    );
}

function HeaderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync search query with URL
    useEffect(() => {
        const q = searchParams.get('q');
        if (q !== null) {
            setSearchQuery(q);
        } else {
            setSearchQuery('');
        }
    }, [searchParams]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);

        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set('q', value);
        } else {
            params.delete('q');
        }

        // If not on home page, navigate to home with search query
        if (pathname !== '/') {
            router.push(`/?${params.toString()}`);
        } else {
            // On home page, just update the URL without full navigation
            window.history.replaceState(null, '', `?${params.toString()}`);
            // Dispatch a custom event so the home page can listen to it if needed, 
            // but since we'll update the home page to use useSearchParams, it will react automatically.
            window.dispatchEvent(new Event('popstate'));
        }
    };

    useEffect(() => {
        loadCurrentUser();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    const loadCurrentUser = async () => {
        try {
            const data = await fetchCurrentUser();
            setCurrentUser(data.user);
        } catch (error) {
            // Silently handle - authentication errors are expected on login/public pages
            // Don't redirect or log errors, just leave currentUser as null
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.left}>
                    <Link href="/" className={styles.logo}>
                        <div className={styles.logoIcon}>P</div>
                        <span className={styles.logoText}>Portalight</span>
                    </Link>
                </div>

                <div className={styles.center}>
                    <div className={styles.searchBar}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search projects and services..."
                            value={searchQuery}
                            onChange={handleSearch}
                        />
                    </div>
                </div>

                <div className={styles.right}>
                    <span className={styles.version}>v0.1.0-alpha</span>
                    <Link href="/docs" className={styles.link}>Docs</Link>

                    {/* Audit Logs - available to all users */}
                    <Link href="/audit-logs" className={styles.link}>
                        Audit Logs
                    </Link>

                    <Link href="/users-teams" className={styles.link}>Users & Teams</Link>

                    {/* User Avatar Dropdown */}
                    <div className={styles.userMenu} ref={dropdownRef}>
                        <button
                            className={styles.avatar}
                            onClick={() => setShowDropdown(!showDropdown)}
                            aria-label="User menu"
                        >
                            {currentUser?.avatar ? (
                                <img src={currentUser.avatar} alt={currentUser.name} />
                            ) : (
                                currentUser?.name?.substring(0, 2).toUpperCase() || 'U'
                            )}
                        </button>

                        {showDropdown && (
                            <div className={styles.dropdown}>
                                <div className={styles.dropdownHeader}>
                                    <div className={styles.dropdownAvatar}>
                                        {currentUser?.avatar ? (
                                            <img src={currentUser.avatar} alt={currentUser.name} />
                                        ) : (
                                            currentUser?.name?.substring(0, 2).toUpperCase() || 'U'
                                        )}
                                    </div>
                                    <div className={styles.dropdownUserInfo}>
                                        <div className={styles.dropdownName}>
                                            {currentUser?.name || 'John Doe'}
                                        </div>
                                        <div className={styles.dropdownEmail}>
                                            {currentUser?.email || 'john.doe@company.com'}
                                        </div>
                                        <div className={styles.dropdownRole}>
                                            {currentUser?.role === 'superadmin' ? '👑 Superadmin' : currentUser?.role === 'lead' ? '👔 Lead' : '👨‍💻 Developer'}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.dropdownDivider}></div>

                                <div className={styles.dropdownMenu}>
                                    <Link
                                        href="/account"
                                        className={styles.dropdownItem}
                                        onClick={() => setShowDropdown(false)}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        My Account
                                    </Link>

                                    {currentUser?.role === 'superadmin' && (
                                        <Link
                                            href="/configuration"
                                            className={styles.dropdownItem}
                                            onClick={() => setShowDropdown(false)}
                                        >
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Configuration
                                        </Link>
                                    )}

                                    {currentUser?.role === 'superadmin' && (
                                        <>
                                            <button
                                                className={styles.dropdownItem}
                                                onClick={() => {
                                                    router.push('/members');
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                </svg>
                                                Add Members
                                            </button>

                                            <button
                                                className={styles.dropdownItem}
                                                onClick={() => {
                                                    router.push('/teams');
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                Manage Teams
                                            </button>
                                        </>
                                    )}

                                    <div className={styles.dropdownDivider}></div>

                                    <button
                                        className={`${styles.dropdownItem} ${styles.logoutButton}`}
                                        onClick={handleLogout}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
