package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
	"github.com/portalight/backend/internal/services"
)

// SyncHandler handles resource sync endpoints
type SyncHandler struct {
	syncService  *services.ResourceSyncService
	resourceRepo *repositories.DiscoveredResourceRepository
}

// NewSyncHandler creates a new sync handler
func NewSyncHandler() *SyncHandler {
	return &SyncHandler{
		syncService:  services.NewResourceSyncService(),
		resourceRepo: repositories.NewDiscoveredResourceRepository(),
	}
}

// SyncProjectRequest is the request for syncing a project
type SyncProjectRequest struct {
	ProjectID string `json:"project_id"`
	SecretID  string `json:"secret_id"`
	Region    string `json:"region"`
}

// SyncProjectResources syncs resources for a project
func (h *SyncHandler) SyncProjectResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can sync resources", http.StatusForbidden)
		return
	}

	var req SyncProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ProjectID == "" || req.SecretID == "" {
		http.Error(w, "project_id and secret_id are required", http.StatusBadRequest)
		return
	}

	region := req.Region
	if region == "" {
		region = "us-east-1"
	}

	result, err := h.syncService.SyncProject(r.Context(), req.ProjectID, req.SecretID, region)
	if err != nil {
		log.Printf("Sync failed: %v", err)
		// Still return the result with error info
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// AssociateResources associates discovered resources with a project
func (h *SyncHandler) AssociateResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can associate resources", http.StatusForbidden)
		return
	}

	var req models.AssociateResourcesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ProjectID == "" || req.SecretID == "" {
		http.Error(w, "project_id and secret_id are required", http.StatusBadRequest)
		return
	}

	added := 0
	for _, res := range req.Resources {
		resource := &models.DiscoveredResource{
			ProjectID:    req.ProjectID,
			SecretID:     req.SecretID,
			ARN:          res.ARN,
			ResourceType: res.ResourceType,
			Name:         res.Name,
			Region:       res.Region,
			Status:       models.ResourceStatusActive,
			Metadata:     res.Metadata,
		}

		err := h.resourceRepo.Create(r.Context(), resource)
		if err != nil {
			log.Printf("Failed to associate resource %s: %v", res.ARN, err)
			continue
		}
		added++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":         true,
		"resources_added": added,
	})
}

// GetProjectDiscoveredResources gets all discovered resources for a project
func (h *SyncHandler) GetProjectDiscoveredResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	projectID := r.URL.Query().Get("project_id")
	if projectID == "" {
		http.Error(w, "project_id is required", http.StatusBadRequest)
		return
	}

	resources, err := h.resourceRepo.GetByProjectID(r.Context(), projectID)
	if err != nil {
		log.Printf("Failed to get discovered resources: %v", err)
		http.Error(w, "Failed to get resources", http.StatusInternalServerError)
		return
	}

	if resources == nil {
		resources = []models.DiscoveredResource{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resources)
}
