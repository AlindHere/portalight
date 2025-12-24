package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/catalog"
	"github.com/portalight/backend/internal/repositories"
)

type ProjectSyncHandler struct {
	syncer      *catalog.Syncer
	projectRepo *repositories.ProjectRepository
}

func NewProjectSyncHandler(syncer *catalog.Syncer, projectRepo *repositories.ProjectRepository) *ProjectSyncHandler {
	return &ProjectSyncHandler{
		syncer:      syncer,
		projectRepo: projectRepo,
	}
}

// SyncProject manually triggers a sync for a specific project
func (h *ProjectSyncHandler) SyncProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract project ID from URL
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[1] != "sync" {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	projectID := parts[0]

	log.Printf("🔄 [Manual Sync] Received sync request for project: %s", projectID)

	// Find the project
	project, err := h.projectRepo.FindByID(context.Background(), projectID)
	if err != nil || project == nil {
		log.Printf("❌ [Manual Sync] Project not found: %s", projectID)
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Check if project has a catalog file path
	if project.CatalogFilePath == "" {
		log.Printf("❌ [Manual Sync] Project has no catalog file: %s", project.Name)
		http.Error(w, "Project is not linked to a catalog file", http.StatusBadRequest)
		return
	}

	log.Printf("✅ [Manual Sync] Syncing project '%s' from %s", project.Name, project.CatalogFilePath)

	// Trigger sync using existing team
	// TODO: Get actual user from context
	userID := ""
	userName := "Manual Sync"

	history, err := h.syncer.SyncProject(
		context.Background(),
		project.CatalogFilePath,
		project.OwnerTeamID,
		userID,
		userName,
	)

	if err != nil {
		log.Printf("❌ [Manual Sync] Failed to sync project: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("✅ [Manual Sync] Successfully synced project: %s", project.Name)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"project_name": history.ProjectName,
		"status":       history.Status,
		"message":      "Project synced successfully",
	})
}
