package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// ServiceResourcesHandler handles service resource mapping endpoints
type ServiceResourcesHandler struct {
	mappingRepo  *repositories.ServiceResourceMappingRepository
	resourceRepo *repositories.DiscoveredResourceRepository
}

// NewServiceResourcesHandler creates a new ServiceResourcesHandler
func NewServiceResourcesHandler() *ServiceResourcesHandler {
	return &ServiceResourcesHandler{
		mappingRepo:  repositories.NewServiceResourceMappingRepository(),
		resourceRepo: repositories.NewDiscoveredResourceRepository(),
	}
}

// GetResources handles GET /api/v1/services/:id/resources
func (h *ServiceResourcesHandler) GetResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract service ID from path: /api/v1/services/{id}/resources
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 5 {
		http.Error(w, "Service ID is required", http.StatusBadRequest)
		return
	}
	serviceID := parts[4]

	mappings, err := h.mappingRepo.GetByServiceID(r.Context(), serviceID)
	if err != nil {
		log.Printf("Failed to get service resources: %v", err)
		http.Error(w, "Failed to get resources", http.StatusInternalServerError)
		return
	}

	if mappings == nil {
		mappings = []models.ServiceResourceMapping{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mappings)
}

// MapResource handles POST /api/v1/services/:id/resources
func (h *ServiceResourcesHandler) MapResource(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check permissions
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can map resources", http.StatusForbidden)
		return
	}

	// Extract service ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 5 {
		http.Error(w, "Service ID is required", http.StatusBadRequest)
		return
	}
	serviceID := parts[4]

	var req struct {
		ResourceID  string   `json:"resource_id"`
		ResourceIDs []string `json:"resource_ids"` // Support bulk mapping
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Handle both single and bulk mapping
	resourceIDs := req.ResourceIDs
	if req.ResourceID != "" {
		resourceIDs = append(resourceIDs, req.ResourceID)
	}

	if len(resourceIDs) == 0 {
		http.Error(w, "At least one resource_id is required", http.StatusBadRequest)
		return
	}

	var created []models.ServiceResourceMapping
	for _, resourceID := range resourceIDs {
		// Check if already exists
		exists, err := h.mappingRepo.Exists(r.Context(), serviceID, resourceID)
		if err != nil {
			log.Printf("Failed to check mapping existence: %v", err)
			continue
		}
		if exists {
			continue
		}

		mapping := &models.ServiceResourceMapping{
			ServiceID:            serviceID,
			DiscoveredResourceID: resourceID,
		}

		if err := h.mappingRepo.Create(r.Context(), mapping); err != nil {
			log.Printf("Failed to create resource mapping: %v", err)
			continue
		}

		created = append(created, *mapping)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"mapped":   len(created),
		"mappings": created,
	})
}

// UnmapResource handles DELETE /api/v1/services/:id/resources/:resourceId
func (h *ServiceResourcesHandler) UnmapResource(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check permissions
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can unmap resources", http.StatusForbidden)
		return
	}

	// Extract service ID and resource ID from path: /api/v1/services/{id}/resources/{resourceId}
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 7 {
		http.Error(w, "Resource ID is required", http.StatusBadRequest)
		return
	}
	serviceID := parts[4]
	resourceID := parts[6]

	if err := h.mappingRepo.DeleteByServiceAndResource(r.Context(), serviceID, resourceID); err != nil {
		log.Printf("Failed to delete resource mapping: %v", err)
		http.Error(w, "Failed to unmap resource", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Resource unmapped successfully",
	})
}

// HandleResources routes service resource requests
func (h *ServiceResourcesHandler) HandleResources(w http.ResponseWriter, r *http.Request) {
	// Check if this is a specific resource operation (has resource ID)
	path := r.URL.Path
	parts := strings.Split(path, "/")

	// /api/v1/services/{id}/resources/{resourceId}
	if len(parts) >= 7 && parts[6] != "" {
		switch r.Method {
		case http.MethodDelete:
			h.UnmapResource(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// /api/v1/services/{id}/resources
	switch r.Method {
	case http.MethodGet:
		h.GetResources(w, r)
	case http.MethodPost:
		h.MapResource(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
