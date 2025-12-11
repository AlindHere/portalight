'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import StatsCard from '@/components/dashboard/StatsCard';
import RegisterModal from '@/components/modals/RegisterModal';
import ProjectAccessModal from '@/components/ProjectAccessModal';
import { fetchProjects, fetchTeams, fetchServices, fetchUsers, fetchCurrentUser, updateProjectAccess } from '@/lib/api';
import { Project, Team, Service, User } from '@/lib/types';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [managingAccessFor, setManagingAccessFor] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsData, teamsData, servicesData, usersData, currentUserData] = await Promise.all([
        fetchProjects(),
        fetchTeams(),
        fetchServices(),
        fetchUsers(),
        fetchCurrentUser(),
      ]);
      setProjects(projectsData);
      setTeams(teamsData);
      setServices(servicesData);
      setUsers(usersData);
      setCurrentUser(currentUserData.user);
    } catch (error) {
      console.error('Failed to load data:', error);
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
          <div className={styles.hero}>
            <div className={styles.heroContent}>
              <h1 className={styles.title}>Internal Developer Portal</h1>
              <p className={styles.subtitle}>
                Centralize your services, documentation, and cloud provisioning
              </p>
              <div className={styles.actions}>
                <button className={styles.primaryButton} onClick={() => setShowRegisterModal(true)}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Register New Project
                </button>
                <button className={styles.secondaryButton} onClick={() => router.push('/provision')}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Provision Resources
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
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

          {/* Search Bar */}
          <div className={styles.searchSection}>
            <div className={styles.searchBar}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search projects and services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

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
                            📊 {getTeamName(project.owner_team_id)}
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
                            📊 {getTeamName(project.owner_team_id)}
                          </span>
                          {project.confluence_url && (
                            <span className={styles.hasDoc}>📚 Docs</span>
                          )}
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
                          <span className={styles.team}>{service.team}</span>
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
