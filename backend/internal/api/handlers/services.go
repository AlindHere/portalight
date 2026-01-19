package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// GetServices returns all services from the database
func GetServices(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	serviceRepo := &repositories.ServiceRepository{}

	services, err := serviceRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch services: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

// GetServiceByID returns a single service with its links and mapped resources
func GetServiceByID(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	// Extract service ID/name from path: /api/v1/services/{id}
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 5 {
		http.Error(w, "Service identifier is required", http.StatusBadRequest)
		return
	}
	serviceIdentifier := parts[4]

	if serviceIdentifier == "" {
		http.Error(w, "Service identifier is required", http.StatusBadRequest)
		return
	}

	serviceRepo := &repositories.ServiceRepository{}
	linkRepo := repositories.NewServiceLinkRepository()
	mappingRepo := repositories.NewServiceResourceMappingRepository()
	teamRepo := &repositories.TeamRepository{}

	// Determine if it's a UUID or a name
	var service *models.Service
	var err error

	// Simple UUID check: 36 characters with hyphens in right places
	if len(serviceIdentifier) == 36 && strings.Count(serviceIdentifier, "-") == 4 {
		service, err = serviceRepo.FindByID(ctx, serviceIdentifier)
	} else {
		service, err = serviceRepo.FindByName(ctx, serviceIdentifier)
	}

	if err != nil {
		http.Error(w, fmt.Sprintf("Service not found: %v", err), http.StatusNotFound)
		return
	}

	// Use the actual service ID for further queries
	serviceID := service.ID

	// Get team name
	if service.Team != "" {
		team, err := teamRepo.FindByID(ctx, service.Team)
		if err == nil && team != nil {
			service.TeamName = team.Name
		}
	}

	// Get links
	links, err := linkRepo.GetByServiceID(ctx, serviceID)
	if err != nil {
		fmt.Printf("Warning: Failed to get service links: %v\n", err)
		links = nil
	}
	service.Links = links

	// Get mapped resources
	mappings, err := mappingRepo.GetByServiceID(ctx, serviceID)
	if err != nil {
		fmt.Printf("Warning: Failed to get service resources: %v\n", err)
		mappings = nil
	}
	service.MappedResources = mappings

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(service)
}

// UpdateServiceRequest represents the request body for updating a service
type UpdateServiceRequest struct {
	Owner string `json:"owner,omitempty"`
}

// UpdateService updates a service's editable fields
func UpdateService(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	// Extract service ID from path: /api/v1/services/{id}
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 5 {
		http.Error(w, "Service ID is required", http.StatusBadRequest)
		return
	}
	serviceID := parts[4]

	if serviceID == "" {
		http.Error(w, "Service ID is required", http.StatusBadRequest)
		return
	}

	// Check user role from context
	role := middleware.GetUserRole(r.Context())
	if role != "superadmin" && role != "lead" {
		http.Error(w, "Permission denied", http.StatusForbidden)
		return
	}

	// Parse request body
	var req UpdateServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	serviceRepo := &repositories.ServiceRepository{}

	// Get existing service
	service, err := serviceRepo.FindByID(ctx, serviceID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Service not found: %v", err), http.StatusNotFound)
		return
	}

	// Update fields if provided
	if req.Owner != "" {
		service.Owner = req.Owner
	}

	// Save updated service
	err = serviceRepo.Update(ctx, service)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update service: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(service)
}
