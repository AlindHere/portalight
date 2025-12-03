package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/portalight/backend/internal/api/handlers"
	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/config"
	"github.com/portalight/backend/internal/database"
)

func main() {
	cfg := config.Load()

	// Initialize database connection
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Initialize handlers
	serviceHandler := handlers.NewServiceHandler()
	secretHandler := handlers.NewSecretHandler()
	provisionHandler := handlers.NewProvisionHandler()

	// Setup routes
	mux := http.NewServeMux()

	// Service catalog endpoints
	mux.HandleFunc("/api/v1/services", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			serviceHandler.GetServices(w, r)
		} else if r.Method == http.MethodPost {
			serviceHandler.CreateService(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/services/", serviceHandler.GetServiceByID)

	// Secret management endpoints
	mux.HandleFunc("/api/v1/secrets", secretHandler.GetSecrets)

	// Provisioning endpoints
	mux.HandleFunc("/api/v1/provision", provisionHandler.ProvisionResource)

	// Repository management endpoints
	mux.HandleFunc("/api/v1/register", handlers.RegisterRepository)

	// User management endpoints
	mux.HandleFunc("/api/v1/users/me", handlers.GetCurrentUser)
	mux.HandleFunc("/api/v1/users", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.GetUsers(w, r)
		case http.MethodPost:
			handlers.CreateUser(w, r)
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
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/teams/members", handlers.UpdateTeamMembers)

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	})

	// Apply CORS middleware
	handler := middleware.CORS(cfg.CORSAllowedOrigins)(mux)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 Portalight backend starting on %s", addr)
	log.Printf("📡 CORS allowed origins: %v", cfg.CORSAllowedOrigins)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
