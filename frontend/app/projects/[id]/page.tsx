'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import ProjectEditModal from '@/components/ProjectEditModal';
import ProjectAccessModal from '@/components/ProjectAccessModal';
import { fetchProjectById, fetchCurrentUser, updateProject, fetchTeams, fetchUsers, updateProjectAccess } from '@/lib/api';
import { ProjectWithServices, User, Team, Project } from '@/lib/types';
import styles from './page.module.css';

export default function ProjectDetailPage() {
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;

    const [project, setProject] = useState<ProjectWithServices | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingProject, setIsEditingProject] = useState(false);
    const [managingAccess, setManagingAccess] = useState(false);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        try {
            const [projectData, userData, teamsData, usersData] = await Promise.all([
                fetchProjectById(projectId),
                fetchCurrentUser(),
                fetchTeams(),
                fetchUsers(),
            ]);
            setProject(projectData);
            setCurrentUser(userData.user);
            setAllTeams(teamsData);
            setAllUsers(usersData);
        } catch (error) {
            console.error('Failed to load project:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProject = async (data: Partial<Project>) => {
        if (!project) return;

        try {
            const updatedProject = await updateProject(project.id, data);
            setProject({ ...project, ...updatedProject });
            setIsEditingProject(false);
        } catch (error) {
            console.error('Failed to update project:', error);
            alert('Failed to update project');
        }
    };

    const handleSaveAccess = async (teamIds: string[], userIds: string[]) => {
        if (!project) return;

        try {
            await updateProjectAccess(project.id, teamIds, userIds);
            setProject({ ...project, team_ids: teamIds, user_ids: userIds });
        } catch (error) {
            console.error('Failed to update access:', error);
            alert('Failed to update access');
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.loading}>Loading project...</div>
                    </div>
                </main>
            </>
        );
    }

    if (!project) {
        return (
            <>
                <Header />
                <main className={styles.main}>
                    <div className={styles.container}>
                        <div className={styles.error}>Project not found</div>
                    </div>
                </main>
            </>
        );
    }

    const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'lead';

    return (
        <>
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    {/* Back Button */}
                    <button onClick={() => router.push('/projects')} className={styles.backButton}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Projects
                    </button>

                    {/* Project Header */}
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
                        <div className={styles.projectDetails}>
                            <h1 className={styles.projectName}>{project.name}</h1>
                            <p className={styles.projectDescription}>{project.description}</p>
                            {project.team_name && (
                                <div className={styles.teamBadge}>
                                    📊 {project.team_name}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Confluence Documentation & Access Management */}
                    <div className={styles.confluenceSection}>
                        <div className={styles.confluenceDisplay}>
                            {project.confluence_url ? (
                                <a
                                    href={project.confluence_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.confluenceButton}
                                >
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    View Confluence Documentation
                                </a>
                            ) : (
                                isAdmin && (
                                    <button
                                        className={styles.addConfluenceButton}
                                        onClick={() => setIsEditingProject(true)}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Confluence Documentation
                                    </button>
                                )
                            )}

                            {isAdmin && (
                                <div className={styles.adminActions}>
                                    <button
                                        className={styles.editButton}
                                        onClick={() => setIsEditingProject(true)}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit
                                    </button>
                                    <button
                                        className={styles.manageAccessButton}
                                        onClick={() => setManagingAccess(true)}
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        Manage Access
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Services Section */}
                    <div className={styles.servicesSection}>
                        <div className={styles.sectionHeader}>
                            <h2>Services ({project.services?.length || 0})</h2>
                        </div>

                        {(project.services?.length || 0) > 0 ? (
                            <div className={styles.servicesGrid}>
                                {project.services?.map((service) => (
                                    <div
                                        key={service.id}
                                        className={styles.serviceCard}
                                        onClick={() => router.push(`/services/${service.id}`)}
                                    >
                                        <div className={styles.serviceHeader}>
                                            <h3>{service.name}</h3>
                                            <span className={`${styles.envBadge} ${styles[service.environment.toLowerCase()]}`}>
                                                {service.environment}
                                            </span>
                                        </div>
                                        <p className={styles.serviceDescription}>{service.description}</p>
                                        <div className={styles.serviceMeta}>
                                            <span className={styles.language}>{service.language}</span>
                                            <span className={styles.team}>{service.team}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.emptyServices}>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p>No services in this project yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {isEditingProject && project && (
                <ProjectEditModal
                    project={project}
                    onClose={() => setIsEditingProject(false)}
                    onSave={handleSaveProject}
                />
            )}

            {managingAccess && project && (
                <ProjectAccessModal
                    project={project}
                    allTeams={allTeams}
                    allUsers={allUsers}
                    onClose={() => setManagingAccess(false)}
                    onSave={handleSaveAccess}
                />
            )}
        </>
    );
}
