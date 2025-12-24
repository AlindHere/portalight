package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/portalight/backend/internal/catalog"
	"github.com/portalight/backend/internal/repositories"
)

type CatalogHandler struct {
	configRepo *repositories.GitHubConfigRepository
	syncer     *catalog.Syncer
}

func NewCatalogHandler(configRepo *repositories.GitHubConfigRepository, syncer *catalog.Syncer) *CatalogHandler {
	return &CatalogHandler{
		configRepo: configRepo,
		syncer:     syncer,
	}
}

// GetConfig returns the current GitHub configuration
func (h *CatalogHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.configRepo.GetConfig(r.Context())
	if err != nil {
		http.Error(w, "Failed to get config", http.StatusInternalServerError)
		return
	}
	if config == nil {
		// Return empty default config
		json.NewEncoder(w).Encode(map[string]interface{}{
			"enabled": false,
		})
		return
	}

	// Don't expose secrets
	config.GitHubAppPrivateKeyEncrypted = nil
	if config.PATEncrypted != nil && *config.PATEncrypted != "" {
		masked := "****************"
		config.PATEncrypted = &masked
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

type UpdateConfigRequest struct {
	RepoOwner           string `json:"repo_owner"`
	RepoName            string `json:"repo_name"`
	Branch              string `json:"branch"`
	ProjectsPath        string `json:"projects_path"`
	AuthType            string `json:"auth_type"`
	PersonalAccessToken string `json:"personal_access_token"`
	Enabled             bool   `json:"enabled"`
}

// UpdateConfig updates the GitHub configuration
func (h *CatalogHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.RepoOwner == "" || req.RepoName == "" || req.Branch == "" {
		http.Error(w, "Repo owner, name, and branch are required", http.StatusBadRequest)
		return
	}

	if req.AuthType != "pat" && req.AuthType != "github_app" {
		http.Error(w, "Invalid auth type", http.StatusBadRequest)
		return
	}

	config := &repositories.GitHubConfig{
		RepoOwner:    req.RepoOwner,
		RepoName:     req.RepoName,
		Branch:       req.Branch,
		ProjectsPath: req.ProjectsPath,
		AuthType:     req.AuthType,
		Enabled:      req.Enabled,
	}

	if req.PersonalAccessToken != "" {
		// In real app, encrypt here
		config.PATEncrypted = &req.PersonalAccessToken
	}

	if err := h.configRepo.SaveConfig(r.Context(), config); err != nil {
		http.Error(w, "Failed to save config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Scan lists available project files
func (h *CatalogHandler) Scan(w http.ResponseWriter, r *http.Request) {
	files, err := h.syncer.Scan(r.Context())
	if err != nil {
		http.Error(w, "Failed to scan repository: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"files": files,
	})
}

type FileTeamMapping struct {
	File   string `json:"file"`
	TeamID string `json:"team_id"`
}

type SyncRequest struct {
	Mappings []FileTeamMapping `json:"mappings"`
}

// Sync triggers synchronization for selected files
func (h *CatalogHandler) Sync(w http.ResponseWriter, r *http.Request) {
	fmt.Println("================================")
	fmt.Println("SYNC HANDLER CALLED")
	fmt.Println("================================")
	log.Println("📥 [Sync] Received sync request")

	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("ERROR DECODING: %v\n", err)
		log.Printf("❌ [Sync] Failed to decode request: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	fmt.Printf("DECODED %d MAPPINGS\n", len(req.Mappings))
	log.Printf("✅ [Sync] Decoded request with %d mappings", len(req.Mappings))

	// Validate mappings
	if len(req.Mappings) == 0 {
		log.Println("❌ [Sync] No mappings provided")
		http.Error(w, "at least one file-team mapping is required", http.StatusBadRequest)
		return
	}

	// Get current user from context (assuming auth middleware sets it)
	// For now, use empty string since we don't have proper user context yet
	userID := "" // Will be stored as NULL in database
	userName := "System"
	// TODO: Get actual user from context

	results := make([]map[string]interface{}, 0)
	for i, mapping := range req.Mappings {
		log.Printf("🔄 [Sync] Processing mapping %d/%d: file=%s, teamID=%s", i+1, len(req.Mappings), mapping.File, mapping.TeamID)

		if mapping.TeamID == "" {
			log.Printf("❌ [Sync] Missing teamID for file: %s", mapping.File)
			results = append(results, map[string]interface{}{
				"file":   mapping.File,
				"status": "failed",
				"error":  "team_id is required for file " + mapping.File,
			})
			continue
		}

		history, err := h.syncer.SyncProject(r.Context(), mapping.File, mapping.TeamID, userID, userName)
		result := map[string]interface{}{
			"file": mapping.File,
		}
		if err != nil {
			log.Printf("❌ [Sync] Failed to sync file %s: %v", mapping.File, err)
			result["status"] = "failed"
			result["error"] = err.Error()
		} else {
			log.Printf("✅ [Sync] Successfully synced file %s -> project %s", mapping.File, history.ProjectName)
			result["status"] = history.Status
			result["project_name"] = history.ProjectName
		}
		results = append(results, result)
	}

	log.Printf("📤 [Sync] Returning %d results", len(results))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"results": results,
	})
}
