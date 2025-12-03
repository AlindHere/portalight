'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchCurrentUser } from '@/lib/api';
import { User } from '@/lib/types';
import styles from './Header.module.css';

export default function Header() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
            console.error('Failed to load current user:', error);
        }
    };

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.left}>
                    <Link href="/" className={styles.logo}>
                        <div className={styles.logoIcon}>P</div>
                        <div>
                            <h1 className={styles.title}>Portalight</h1>
                            <p className={styles.subtitle}>Internal Developer Portal</p>
                        </div>
                    </Link>
                </div>

                <div className={styles.right}>
                    <span className={styles.version}>v0.1.0-alpha</span>
                    <Link href="/docs" className={styles.link}>Docs</Link>
                    <Link href="/users-teams" className={styles.link}>Users & Teams</Link>

                    {/* User Avatar Dropdown */}
                    <div className={styles.userMenu} ref={dropdownRef}>
                        <button
                            className={styles.avatar}
                            onClick={() => setShowDropdown(!showDropdown)}
                            aria-label="User menu"
                        >
                            {currentUser?.avatar || 'JD'}
                        </button>

                        {showDropdown && (
                            <div className={styles.dropdown}>
                                <div className={styles.dropdownHeader}>
                                    <div className={styles.dropdownAvatar}>
                                        {currentUser?.avatar || 'JD'}
                                    </div>
                                    <div className={styles.dropdownUserInfo}>
                                        <div className={styles.dropdownName}>
                                            {currentUser?.name || 'John Doe'}
                                        </div>
                                        <div className={styles.dropdownEmail}>
                                            {currentUser?.email || 'john.doe@company.com'}
                                        </div>
                                        <div className={styles.dropdownRole}>
                                            {currentUser?.role === 'admin' ? '👑 Admin' : '👨‍💻 Developer'}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.dropdownDivider}></div>

                                <div className={styles.dropdownMenu}>
                                    <button
                                        className={styles.dropdownItem}
                                        onClick={() => {
                                            router.push('/account');
                                            setShowDropdown(false);
                                        }}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        My Account
                                    </button>

                                    {currentUser?.role === 'admin' && (
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
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
