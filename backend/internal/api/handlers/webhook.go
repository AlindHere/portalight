package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/catalog"
	"github.com/portalight/backend/internal/repositories"
)

type GitHubWebhookHandler struct {
	syncer     *catalog.Syncer
	configRepo *repositories.GitHubConfigRepository
}

func NewGitHubWebhookHandler(syncer *catalog.Syncer, configRepo *repositories.GitHubConfigRepository) *GitHubWebhookHandler {
	return &GitHubWebhookHandler{
		syncer:     syncer,
		configRepo: configRepo,
	}
}

// GitHubPushEvent represents the relevant parts of a GitHub push webhook
type GitHubPushEvent struct {
	Ref     string `json:"ref"`
	Commits []struct {
		Added    []string `json:"added"`
		Modified []string `json:"modified"`
		Removed  []string `json:"removed"`
	} `json:"commits"`
	Repository struct {
		Name     string `json:"name"`
		FullName string `json:"full_name"`
	} `json:"repository"`
}

// HandleWebhook processes incoming GitHub webhook events
func (h *GitHubWebhookHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("❌ [Webhook] Failed to read body: %v", err)
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Get GitHub config to validate webhook
	config, err := h.configRepo.GetConfig(context.Background())
	if err != nil || config == nil {
		log.Printf("❌ [Webhook] No GitHub config found")
		http.Error(w, "GitHub not configured", http.StatusInternalServerError)
		return
	}

	// Validate webhook signature if secret is configured
	signature := r.Header.Get("X-Hub-Signature-256")
	if signature != "" && config.WebhookSecret != "" {
		if !validateSignature(body, signature, config.WebhookSecret) {
			log.Printf("❌ [Webhook] Invalid signature")
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
			return
		}
	}

	// Get event type
	eventType := r.Header.Get("X-GitHub-Event")
	log.Printf("📥 [Webhook] Received %s event from GitHub", eventType)

	// Only process push events
	if eventType != "push" {
		log.Printf("ℹ️ [Webhook] Ignoring %s event", eventType)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Event type not processed"})
		return
	}

	// Parse push event
	var pushEvent GitHubPushEvent
	if err := json.Unmarshal(body, &pushEvent); err != nil {
		log.Printf("❌ [Webhook] Failed to parse push event: %v", err)
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Check if push is to the configured branch
	branchRef := fmt.Sprintf("refs/heads/%s", config.Branch)
	if pushEvent.Ref != branchRef {
		log.Printf("ℹ️ [Webhook] Ignoring push to branch %s (configured: %s)", pushEvent.Ref, config.Branch)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Branch not monitored"})
		return
	}

	// Collect all changed files in the projects path
	changedFiles := make(map[string]bool)
	for _, commit := range pushEvent.Commits {
		for _, file := range commit.Added {
			if isYAMLInProjectsPath(file, config.ProjectsPath) {
				changedFiles[file] = true
			}
		}
		for _, file := range commit.Modified {
			if isYAMLInProjectsPath(file, config.ProjectsPath) {
				changedFiles[file] = true
			}
		}
		// Note: We don't handle removed files yet - projects remain in DB
	}

	if len(changedFiles) == 0 {
		log.Printf("ℹ️ [Webhook] No catalog YAML files changed in %s", config.ProjectsPath)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "No catalog files changed"})
		return
	}

	log.Printf("🔄 [Webhook] Found %d changed catalog files, triggering sync", len(changedFiles))

	// Need project repository to look up existing projects
	projectRepo := &repositories.ProjectRepository{}

	// Trigger sync for each changed file
	results := make([]map[string]interface{}, 0)
	for file := range changedFiles {
		log.Printf("🔄 [Webhook] Checking if project exists for %s", file)

		result := map[string]interface{}{
			"file": file,
		}

		// Look up existing project by catalog_file_path
		existingProject, err := projectRepo.FindByCatalogPath(context.Background(), file)
		if err != nil || existingProject == nil {
			// Project doesn't exist yet - skip (must be manually imported)
			log.Printf("ℹ️ [Webhook] No existing project for %s, skipping (new projects must be manually imported)", file)
			result["status"] = "skipped"
			result["message"] = "New project - must be manually imported via UI to select team"
			results = append(results, result)
			continue
		}

		// Project exists! Re-sync it using its existing team_id
		log.Printf("✅ [Webhook] Found existing project '%s' (team: %s), syncing...", existingProject.Name, existingProject.OwnerTeamID)

		// Sync the project (empty user ID is fine for webhook)
		history, err := h.syncer.SyncProject(context.Background(), file, existingProject.OwnerTeamID, "", "GitHub Webhook")
		if err != nil {
			log.Printf("❌ [Webhook] Failed to sync %s: %v", file, err)
			result["status"] = "failed"
			result["error"] = err.Error()
		} else {
			log.Printf("✅ [Webhook] Successfully synced %s -> %s", file, history.ProjectName)
			result["status"] = history.Status
			result["project_name"] = history.ProjectName
		}

		results = append(results, result)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Webhook processed",
		"results": results,
	})
}

// validateSignature validates the GitHub webhook signature
func validateSignature(payload []byte, signature string, secret string) bool {
	// GitHub sends signatures in format: sha256=<hash>
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}

	expectedMAC := signature[7:] // Remove "sha256=" prefix

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	actualMAC := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(actualMAC), []byte(expectedMAC))
}

// isYAMLInProjectsPath checks if a file is a YAML file in the projects path
func isYAMLInProjectsPath(file string, projectsPath string) bool {
	// Normalize paths
	if !strings.HasSuffix(projectsPath, "/") {
		projectsPath += "/"
	}

	// Check if file is in projects path
	if !strings.HasPrefix(file, projectsPath) {
		return false
	}

	// Check if it's a YAML file
	return strings.HasSuffix(strings.ToLower(file), ".yaml") ||
		strings.HasSuffix(strings.ToLower(file), ".yml")
}
