'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { fetchProjects, fetchTeams } from '@/lib/api';
import { Project, Team } from '@/lib/types';
import styles from './page.module.css';

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [projectsData, teamsData] = await Promise.all([
                fetchProjects(),
                fetchTeams(),
            ]);
            setProjects(projectsData || []);
            setTeams(teamsData || []);
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTeamName = (teamId?: string) => {
        if (!teamId) return 'No team';
        const team = teams.find(t => t.id === teamId);
        return team?.name || 'Unknown Team';
    };

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                        <div className={styles.headerContent}>
                            <div>
                                <h1 className={styles.title}>Projects</h1>
                                <p className={styles.subtitle}>
                                    Organize and manage your services by project
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className={styles.searchBar}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>

                    {/* Projects Grid */}
                    {loading ? (
                        <div className={styles.loading}>Loading projects...</div>
                    ) : (
                        <div className={styles.projectsGrid}>
                            {filteredProjects.map((project) => (
                                <div
                                    key={project.id}
                                    className={styles.projectCard}
                                    onClick={() => router.push(`/projects/${project.name}`)}
                                >
                                    <div className={styles.projectHeader}>
                                        <div className={styles.projectIcon}>
                                            {project.avatar ? (
                                                <img
                                                    src={project.avatar}
                                                    alt={project.name}
                                                    className={styles.projectAvatar}
                                                />
                                            ) : (
                                                project.name.substring(0, 1)
                                            )}
                                        </div>
                                        <div className={styles.projectInfo}>
                                            <h3 className={styles.projectName}>{project.name}</h3>
                                            <p className={styles.projectDescription}>{project.description}</p>
                                        </div>
                                    </div>
                                    <div className={styles.projectMeta}>
                                        <span className={styles.teamBadge}>
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            {getTeamName(project.owner_team_id)}
                                        </span>
                                        {project.confluence_url && (
                                            <a
                                                href={project.confluence_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.confluenceLink}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Docs
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && filteredProjects.length === 0 && (
                        <div className={styles.emptyState}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <h3>No projects found</h3>
                            <p>Try adjusting your search or create a new project</p>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
