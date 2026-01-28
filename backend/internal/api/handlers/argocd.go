package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
	"github.com/portalight/backend/internal/services"
)

// ArgoCDHandler handles ArgoCD-related HTTP requests
type ArgoCDHandler struct {
	client *services.ArgoCDClient
	repo   *repositories.ArgoCDRepository
}

// NewArgoCDHandler creates a new ArgoCD handler
func NewArgoCDHandler() *ArgoCDHandler {
	return &ArgoCDHandler{
		client: services.NewArgoCDClient(),
		repo:   repositories.NewArgoCDRepository(),
	}
}

// GetConfig returns the ArgoCD configuration (base URL for external links)
func (h *ArgoCDHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication
	userRole := middleware.GetUserRole(ctx)
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	config := map[string]interface{}{
		"configured": h.client.IsConfigured(),
		"base_url":   h.client.GetBaseURL(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// ListApplications returns all ArgoCD applications
func (h *ArgoCDHandler) ListApplications(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication
	userRole := middleware.GetUserRole(ctx)
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if !h.client.IsConfigured() {
		http.Error(w, "ArgoCD is not configured", http.StatusServiceUnavailable)
		return
	}

	apps, err := h.client.ListApplications()
	if err != nil {
		log.Printf("Failed to list ArgoCD applications: %v", err)
		http.Error(w, "Failed to fetch applications from ArgoCD", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

// GetServiceApps returns all ArgoCD apps linked to a service
func (h *ArgoCDHandler) GetServiceApps(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication
	userRole := middleware.GetUserRole(ctx)
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract service ID from URL: /api/v1/argocd/service/{serviceId}/apps
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/service/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[0] == "" {
		http.Error(w, "Service ID required", http.StatusBadRequest)
		return
	}
	serviceID := parts[0]

	apps, err := h.repo.GetByServiceID(ctx, serviceID)
	if err != nil {
		log.Printf("Failed to get service ArgoCD apps: %v", err)
		http.Error(w, "Failed to fetch ArgoCD apps", http.StatusInternalServerError)
		return
	}

	if apps == nil {
		apps = []models.ServiceArgoCDApp{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

// LinkApp links an ArgoCD app to a service
func (h *ArgoCDHandler) LinkApp(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication - must be lead or superadmin
	userRole := middleware.GetUserRole(ctx)
	if userRole != "lead" && userRole != "superadmin" {
		http.Error(w, "Forbidden: requires lead or superadmin role", http.StatusForbidden)
		return
	}

	// Extract service ID from URL
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/service/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[0] == "" {
		http.Error(w, "Service ID required", http.StatusBadRequest)
		return
	}
	serviceID := parts[0]

	var req struct {
		ArgoCDAppName   string `json:"argocd_app_name"`
		EnvironmentName string `json:"environment_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ArgoCDAppName == "" || req.EnvironmentName == "" {
		http.Error(w, "argocd_app_name and environment_name are required", http.StatusBadRequest)
		return
	}

	app := &models.ServiceArgoCDApp{
		ServiceID:       serviceID,
		ArgoCDAppName:   req.ArgoCDAppName,
		EnvironmentName: req.EnvironmentName,
	}

	if err := h.repo.Create(ctx, app); err != nil {
		log.Printf("Failed to link ArgoCD app: %v", err)
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			http.Error(w, "App or environment already linked to this service", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to link ArgoCD app", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(app)
}

// UnlinkApp removes an ArgoCD app link from a service
func (h *ArgoCDHandler) UnlinkApp(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication - must be lead or superadmin
	userRole := middleware.GetUserRole(ctx)
	if userRole != "lead" && userRole != "superadmin" {
		http.Error(w, "Forbidden: requires lead or superadmin role", http.StatusForbidden)
		return
	}

	// Extract app ID from URL: /api/v1/argocd/service/{serviceId}/apps/{appId}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/service/")
	parts := strings.Split(path, "/")
	if len(parts) < 3 || parts[2] == "" {
		http.Error(w, "App ID required", http.StatusBadRequest)
		return
	}
	appID := parts[2]

	if err := h.repo.Delete(ctx, appID); err != nil {
		log.Printf("Failed to unlink ArgoCD app: %v", err)
		http.Error(w, "Failed to unlink ArgoCD app", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetAppStatus returns the status of an ArgoCD application
func (h *ArgoCDHandler) GetAppStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication
	userRole := middleware.GetUserRole(ctx)
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if !h.client.IsConfigured() {
		http.Error(w, "ArgoCD is not configured", http.StatusServiceUnavailable)
		return
	}

	// Extract app name from URL: /api/v1/argocd/apps/{appName}/status
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/apps/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		http.Error(w, "App name required", http.StatusBadRequest)
		return
	}
	appName := parts[0]

	app, err := h.client.GetApplicationStatus(appName)
	if err != nil {
		log.Printf("Failed to get application status: %v", err)
		http.Error(w, "Failed to fetch application status", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(app)
}

// GetAppPods returns all pods for an ArgoCD application
func (h *ArgoCDHandler) GetAppPods(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication
	userRole := middleware.GetUserRole(ctx)
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if !h.client.IsConfigured() {
		http.Error(w, "ArgoCD is not configured", http.StatusServiceUnavailable)
		return
	}

	// Extract app name from URL: /api/v1/argocd/apps/{appName}/pods
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/apps/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		http.Error(w, "App name required", http.StatusBadRequest)
		return
	}
	appName := parts[0]

	pods, err := h.client.GetApplicationPods(appName)
	if err != nil {
		log.Printf("Failed to get application pods: %v", err)
		http.Error(w, "Failed to fetch pods", http.StatusInternalServerError)
		return
	}

	if pods == nil {
		pods = []models.ArgoCDPod{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pods)
}

// GetPodLogs returns logs for a pod
func (h *ArgoCDHandler) GetPodLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication
	userRole := middleware.GetUserRole(ctx)
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if !h.client.IsConfigured() {
		http.Error(w, "ArgoCD is not configured", http.StatusServiceUnavailable)
		return
	}

	// Extract from URL: /api/v1/argocd/apps/{appName}/pods/{podName}/logs
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/apps/")
	parts := strings.Split(path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	appName := parts[0]
	podName := parts[2]

	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	container := r.URL.Query().Get("container")
	tailLines := 500 // Default

	logs, err := h.client.GetPodLogs(appName, podName, namespace, container, tailLines)
	if err != nil {
		log.Printf("Failed to get pod logs: %v", err)
		http.Error(w, "Failed to fetch logs", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(logs))
}

// DeletePod deletes a pod
func (h *ArgoCDHandler) DeletePod(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication - must be lead or superadmin
	userRole := middleware.GetUserRole(ctx)
	if userRole != "lead" && userRole != "superadmin" {
		http.Error(w, "Forbidden: requires lead or superadmin role", http.StatusForbidden)
		return
	}

	if !h.client.IsConfigured() {
		http.Error(w, "ArgoCD is not configured", http.StatusServiceUnavailable)
		return
	}

	// Extract from URL: /api/v1/argocd/apps/{appName}/pods/{podName}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/apps/")
	parts := strings.Split(path, "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	appName := parts[0]
	podName := parts[2]

	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	if err := h.client.DeletePod(appName, podName, namespace); err != nil {
		log.Printf("Failed to delete pod: %v", err)
		http.Error(w, "Failed to delete pod", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SyncApp triggers a sync for an application
func (h *ArgoCDHandler) SyncApp(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication - must be lead or superadmin
	userRole := middleware.GetUserRole(ctx)
	if userRole != "lead" && userRole != "superadmin" {
		http.Error(w, "Forbidden: requires lead or superadmin role", http.StatusForbidden)
		return
	}

	if !h.client.IsConfigured() {
		http.Error(w, "ArgoCD is not configured", http.StatusServiceUnavailable)
		return
	}

	// Extract app name from URL: /api/v1/argocd/apps/{appName}/sync
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/argocd/apps/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		http.Error(w, "App name required", http.StatusBadRequest)
		return
	}
	appName := parts[0]

	if err := h.client.SyncApplication(appName); err != nil {
		log.Printf("Failed to sync application: %v", err)
		http.Error(w, "Failed to sync application", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "sync initiated"})
}
