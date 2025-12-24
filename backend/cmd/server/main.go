package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/handlers"
	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/catalog"
	"github.com/portalight/backend/internal/config"
	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/repositories"
)

func main() {
	cfg := config.Load()

	// Initialize database connection
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Initialize repositories
	projectRepo := &repositories.ProjectRepository{}
	serviceRepo := &repositories.ServiceRepository{}
	teamRepo := &repositories.TeamRepository{}
	githubConfigRepo := repositories.NewGitHubConfigRepository(database.DB)
	syncHistoryRepo := repositories.NewSyncHistoryRepository(database.DB)
	resourceRepo := repositories.NewResourceRepository(database.DB)

	// Initialize Syncer
	syncer := catalog.NewSyncer(projectRepo, serviceRepo, teamRepo, syncHistoryRepo, githubConfigRepo)

	// Initialize handlers
	secretHandler := handlers.NewSecretHandler()
	provisionHandler := handlers.NewProvisionHandler(resourceRepo)
	authHandler := handlers.NewAuthHandler(cfg)
	catalogHandler := handlers.NewCatalogHandler(githubConfigRepo, syncer)
	webhookHandler := handlers.NewGitHubWebhookHandler(syncer, githubConfigRepo)
	projectSyncHandler := handlers.NewProjectSyncHandler(syncer, projectRepo)
	credentialsHandler := handlers.NewCredentialsHandler()

	// Setup routes
	mux := http.NewServeMux()

	// Auth endpoints
	mux.HandleFunc("/auth/login", authHandler.HandleLogin) // Username/password login
	mux.HandleFunc("/auth/github/login", authHandler.HandleGithubLogin)
	mux.HandleFunc("/auth/github/callback", authHandler.HandleGithubCallback)

	// Services API
	mux.HandleFunc("/api/v1/services", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handlers.GetServices(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Secret management endpoints (legacy)
	mux.HandleFunc("/api/v1/secrets", secretHandler.GetSecrets)

	// AWS Credentials management (superadmin only)
	mux.HandleFunc("/api/v1/credentials", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			credentialsHandler.ListCredentials(w, r)
		case http.MethodPost:
			credentialsHandler.CreateCredential(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/credentials/", credentialsHandler.DeleteCredential)

	// Provisioning endpoints
	mux.HandleFunc("/api/v1/provision", provisionHandler.ProvisionResource)

	// Discovery endpoints
	discoveryHandler := handlers.NewDiscoveryHandler()
	mux.HandleFunc("/api/v1/discover", discoveryHandler.DiscoverResources)

	// Resource metrics endpoints
	resourceDetailsHandler := handlers.NewResourceDetailsHandler()
	mux.HandleFunc("/api/v1/resources/metrics", resourceDetailsHandler.GetResourceMetrics)

	// Sync endpoints
	syncHandler := handlers.NewSyncHandler()
	mux.HandleFunc("/api/v1/resources/sync", syncHandler.SyncProjectResources)
	mux.HandleFunc("/api/v1/resources/associate", syncHandler.AssociateResources)
	mux.HandleFunc("/api/v1/resources/discovered", syncHandler.GetProjectDiscoveredResources)

	// Repository management endpoints
	mux.HandleFunc("/api/v1/register", handlers.RegisterRepository)

	// User routes
	mux.HandleFunc("/api/v1/users/current", handlers.GetCurrentUser)
	mux.HandleFunc("/api/v1/users", handlers.GetUsers)
	mux.HandleFunc("/api/v1/users/create", handlers.CreateUser)

	// Dev provisioning permissions endpoints
	devPermissionsHandler := handlers.NewDevPermissionsHandler()
	mux.HandleFunc("/api/v1/users/", func(w http.ResponseWriter, r *http.Request) {
		// Check if this is a provisioning-permissions request
		if strings.Contains(r.URL.Path, "provisioning-permissions") {
			switch r.Method {
			case http.MethodGet:
				devPermissionsHandler.GetDevPermissions(w, r)
			case http.MethodPut:
				devPermissionsHandler.UpdateDevPermissions(w, r)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}
		// Otherwise handle user update/delete
		switch r.Method {
		case http.MethodPut, http.MethodPatch:
			handlers.UpdateUser(w, r)
		case http.MethodDelete:
			handlers.DeleteUser(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Team management endpoints
	mux.HandleFunc("/api/v1/teams", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.GetTeams(w, r)
		case http.MethodPost:
			handlers.CreateTeam(w, r)
		case http.MethodDelete:
			handlers.DeleteTeam(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/teams/members", handlers.UpdateTeamMembers)

	// Project management endpoints
	mux.HandleFunc("/api/v1/projects", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.GetProjects(w, r)
		case http.MethodPost:
			handlers.CreateProject(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	// Project sync endpoint
	mux.HandleFunc("/api/v1/projects/", func(w http.ResponseWriter, r *http.Request) {
		// Check if it's a sync request
		if strings.HasSuffix(r.URL.Path, "/sync") && r.Method == http.MethodPost {
			projectSyncHandler.SyncProject(w, r)
			return
		}

		// Check if it's a resources request
		if strings.HasSuffix(r.URL.Path, "/resources") && r.Method == http.MethodGet {
			provisionHandler.GetProjectResources(w, r)
			return
		}

		// Otherwise handle normal project operations
		switch r.Method {
		case http.MethodGet:
			handlers.GetProjectByID(w, r)
		case http.MethodPut, http.MethodPatch:
			handlers.UpdateProject(w, r)
		case http.MethodDelete:
			handlers.DeleteProject(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/projects/access", handlers.UpdateProjectAccess)

	// Catalog endpoints
	mux.HandleFunc("/api/v1/catalog/config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			catalogHandler.GetConfig(w, r)
		case http.MethodPost, http.MethodPut:
			catalogHandler.UpdateConfig(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/catalog/scan", catalogHandler.Scan)
	mux.HandleFunc("/api/v1/catalog/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		catalogHandler.Sync(w, r)
	})

	// GitHub Webhook endpoint (no auth required - validated by signature)
	mux.HandleFunc("/api/v1/webhook/github", webhookHandler.HandleWebhook)

	// Audit log endpoints
	mux.HandleFunc("/api/v1/audit-logs", handlers.GetAuditLogs)

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	})

	// Apply Auth middleware to all /api/* routes, then CORS
	handler := applyMiddleware(
		mux,
		cfg,
		[]string{"/health", "/auth/login", "/auth/github/login", "/auth/github/callback", "/api/v1/webhook/github"},
	)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 Portalight backend starting on %s", addr)
	log.Printf("📡 CORS allowed origins: %v", cfg.CORSAllowedOrigins)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}

// applyMiddleware applies auth middleware to all routes except excluded ones
func applyMiddleware(handler http.Handler, cfg *config.Config, excludedPaths []string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if path should be excluded from auth
		isExcluded := false
		for _, path := range excludedPaths {
			if r.URL.Path == path || r.URL.Path == path+"/" {
				isExcluded = true
				break
			}
			if strings.Contains(path, "*") {
				parts := strings.Split(path, "*")
				if len(parts) == 2 && strings.HasPrefix(r.URL.Path, parts[0]) && strings.HasSuffix(r.URL.Path, parts[1]) {
					isExcluded = true
					break
				}
			}
		}

		if isExcluded {
			// Apply CORS only
			middleware.CORS(cfg.CORSAllowedOrigins)(handler).ServeHTTP(w, r)
			return
		}

		// Apply both Auth and CORS middleware for protected routes
		middleware.CORS(cfg.CORSAllowedOrigins)(
			middleware.AuthMiddleware(cfg)(handler),
		).ServeHTTP(w, r)
	})
}
