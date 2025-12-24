'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/dashboard/StatsCard';
import RegisterModal from '@/components/modals/RegisterModal';
import ProjectAccessModal from '@/components/ProjectAccessModal';
import { fetchProjects, fetchTeams, fetchServices, fetchUsers, fetchCurrentUser, updateProjectAccess, fetchDevProvisioningPermissions } from '@/lib/api';
import { Project, Team, Service, User } from '@/lib/types';
import styles from './page.module.css';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [managingAccessFor, setManagingAccessFor] = useState<string | null>(null);
  const [hasProvisioningAccess, setHasProvisioningAccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Sync search query with URL
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const loadData = async () => {
    try {
      const [projectsData, teamsData, servicesData, usersData, currentUserData] = await Promise.all([
        fetchProjects(),
        fetchTeams(),
        fetchServices(),
        fetchUsers(),
        fetchCurrentUser(),
      ]);
      setProjects(projectsData || []);
      setTeams(teamsData || []);
      setServices(servicesData || []);
      setUsers(usersData || []);
      setCurrentUser(currentUserData.user);

      // If user is a dev, check their provisioning permissions
      if (currentUserData.user?.role === 'dev') {
        try {
          const permissions = await fetchDevProvisioningPermissions(currentUserData.user.id);
          const hasAccess = permissions.s3_enabled || permissions.sqs_enabled || permissions.sns_enabled;
          setHasProvisioningAccess(hasAccess);
        } catch {
          // No permissions yet - that's okay
          setHasProvisioningAccess(false);
        }
      } else {
        // Lead and superadmin always have access
        setHasProvisioningAccess(true);
      }
    } catch (error) {
      // Check if user has a token
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (!token) {
          // No token - redirect to login (expected behavior, no error logging needed)
          router.push('/login');
        } else {
          // Has token but fetch failed - log error
          console.error('Dashboard data load failed:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = searchQuery
    ? projects.filter(project =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : projects;

  const filteredServices = searchQuery
    ? services.filter(service =>
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.team.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  const hasSearchResults = searchQuery && (filteredProjects.length > 0 || filteredServices.length > 0);
  const hasNoResults = searchQuery && filteredProjects.length === 0 && filteredServices.length === 0;

  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'No team';
    const team = teams.find(t => t.id === teamId);
    return team?.name || 'Unknown Team';
  };

  const stats = {
    totalServices: projects.length,
    productionServices: projects.filter(p => p.owner_team_id).length,
    avgUptime: '99.9%',
    totalOwners: teams.length,
  };

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Hero Section */}
          {!searchQuery && (
            <div className={styles.hero}>
              <div className={styles.heroContent}>
                <h1 className={styles.title}>Internal Developer Portal</h1>
                <p className={styles.subtitle}>
                  Centralize your services, documentation, and cloud provisioning
                </p>
                <div className={styles.actions}>
                  {/* Register button - only for lead and superadmin */}
                  {currentUser?.role !== 'dev' && (
                    <button className={styles.primaryButton} onClick={() => setShowRegisterModal(true)}>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Register New Project
                    </button>
                  )}
                  {/* Provision button - for lead/superadmin OR dev users with permissions */}
                  {(currentUser?.role !== 'dev' || hasProvisioningAccess) && (
                    <button className={styles.secondaryButton} onClick={() => router.push('/provision')}>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                      Provision Resources
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          {!searchQuery && (
            <div className={styles.statsGrid}>
              <StatsCard
                title="Total Projects"
                value={stats.totalServices.toString()}
                icon="📦"
              />
              <StatsCard
                title="Active Projects"
                value={stats.productionServices.toString()}
                icon="✅"
              />
              <StatsCard
                title="Avg Uptime"
                value={stats.avgUptime}
                icon="⏱️"
              />
              <StatsCard
                title="Teams"
                value={stats.totalOwners.toString()}
                icon="👥"
              />
            </div>
          )}

          {/* Projects Section */}
          {!searchQuery && (
            <div className={styles.projectsSection}>
              <div className={styles.sectionHeader}>
                <h2>Projects ({projects.length})</h2>
                <p>Organize your services by project for better management</p>
              </div>

              {loading ? (
                <div className={styles.loading}>Loading projects...</div>
              ) : (
                <div className={styles.projectsGrid}>
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className={styles.projectCard}
                    >
                      <div
                        className={styles.projectCardContent}
                        onClick={() => router.push(`/projects/${project.id}`)}
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
                            <h3>{project.name}</h3>
                            <p>{project.description}</p>
                          </div>
                        </div>
                        <div className={styles.projectFooter}>
                          <span className={styles.teamBadge}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {getTeamName(project.owner_team_id)}
                          </span>
                          {project.confluence_url && (
                            <span className={styles.hasDoc}>📚 Docs</span>
                          )}
                        </div>
                      </div>
                      {(currentUser?.role === 'superadmin' || currentUser?.role === 'lead') && (
                        <button
                          className={styles.manageAccessButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            setManagingAccessFor(project.id);
                          }}
                          title="Manage Access"
                        >
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <div className={styles.searchResults}>
              <div className={styles.searchHeader}>
                <div className={styles.searchTitle}>
                  <h1>Search Results</h1>
                  <p>Showing results for "{searchQuery}"</p>
                </div>
                <button className={styles.clearSearch} onClick={() => router.push('/')}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Search
                </button>
              </div>
              {/* Projects Results */}
              {filteredProjects.length > 0 && (
                <div className={styles.resultsSection}>
                  <div className={styles.sectionHeader}>
                    <h2>Projects ({filteredProjects.length})</h2>
                  </div>
                  <div className={styles.projectsGrid}>
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        className={styles.projectCard}
                      >
                        <div
                          className={styles.projectCardContent}
                          onClick={() => router.push(`/projects/${project.id}`)}
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
                              <h3>{project.name}</h3>
                              <p>{project.description}</p>
                            </div>
                          </div>
                          <div className={styles.projectFooter}>
                            <span className={styles.teamBadge}>
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              {getTeamName(project.owner_team_id)}
                            </span>
                            {project.confluence_url && (
                              <span className={styles.hasDoc}>📚 Docs</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services Results */}
              {filteredServices.length > 0 && (
                <div className={styles.resultsSection}>
                  <div className={styles.sectionHeader}>
                    <h2>Services ({filteredServices.length})</h2>
                  </div>
                  <div className={styles.servicesGrid}>
                    {filteredServices.map((service) => (
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {hasNoResults && (
                <div className={styles.emptyState}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3>No Results Found</h3>
                  <p>Try adjusting your search or register a new project</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showRegisterModal && (
        <RegisterModal
          onClose={() => setShowRegisterModal(false)}
          onRegister={loadData}
        />
      )}

      {managingAccessFor && (
        <ProjectAccessModal
          project={projects.find(p => p.id === managingAccessFor)!}
          allTeams={teams}
          allUsers={users}
          onClose={() => setManagingAccessFor(null)}
          onSave={async (teamIds, userIds) => {
            await updateProjectAccess(managingAccessFor, teamIds, userIds);
            loadData();
          }}
        />
      )}
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
