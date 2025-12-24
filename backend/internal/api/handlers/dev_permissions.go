package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

type DevPermissionsHandler struct {
	permissionRepo *repositories.ProvisioningPermissionRepository
	userRepo       *repositories.UserRepository
}

func NewDevPermissionsHandler() *DevPermissionsHandler {
	return &DevPermissionsHandler{
		permissionRepo: &repositories.ProvisioningPermissionRepository{},
		userRepo:       &repositories.UserRepository{},
	}
}

// GetDevPermissions handles GET /api/v1/users/:id/provisioning-permissions
func (h *DevPermissionsHandler) GetDevPermissions(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	var userID string
	for i, part := range pathParts {
		if part == "users" && i+1 < len(pathParts) {
			userID = pathParts[i+1]
			break
		}
	}

	if userID == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	permissions, err := h.permissionRepo.GetUserPermissions(ctx, userID)
	if err != nil {
		log.Printf("Failed to get provisioning permissions: %v", err)
		http.Error(w, "Failed to get permissions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(permissions)
}

// UpdateDevPermissions handles PUT /api/v1/users/:id/provisioning-permissions
// Only lead and superadmin can update permissions
func (h *DevPermissionsHandler) UpdateDevPermissions(w http.ResponseWriter, r *http.Request) {
	// Check role - only lead and superadmin can update
	userRole := middleware.GetUserRole(r.Context())
	if userRole == "dev" {
		http.Error(w, "Forbidden: Only leads and superadmins can update provisioning permissions", http.StatusForbidden)
		return
	}

	// Extract user ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	var userID string
	for i, part := range pathParts {
		if part == "users" && i+1 < len(pathParts) {
			userID = pathParts[i+1]
			break
		}
	}

	if userID == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	var req models.UpdateProvisioningPermissionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Verify the target user is a dev (only devs need explicit permissions)
	targetUser, err := h.userRepo.FindByID(ctx, userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if targetUser.Role != models.RoleDev {
		http.Error(w, "Provisioning permissions can only be set for dev users", http.StatusBadRequest)
		return
	}

	// Get the granting user's ID
	grantedBy := middleware.GetUserID(r.Context())

	// Update permissions
	if err := h.permissionRepo.SetUserPermissions(ctx, userID, &req, grantedBy); err != nil {
		log.Printf("Failed to update provisioning permissions: %v", err)
		http.Error(w, "Failed to update permissions", http.StatusInternalServerError)
		return
	}

	// Audit log
	allowedTypes := []string{}
	if req.S3Enabled {
		allowedTypes = append(allowedTypes, "s3")
	}
	if req.SQSEnabled {
		allowedTypes = append(allowedTypes, "sqs")
	}
	if req.SNSEnabled {
		allowedTypes = append(allowedTypes, "sns")
	}

	auditLog := models.AuditLog{
		UserEmail:    middleware.GetUserEmail(r.Context()),
		Action:       "update_dev_provisioning_permissions",
		ResourceType: "user",
		ResourceName: targetUser.Name,
		Status:       "success",
		Details:      "Allowed types: " + strings.Join(allowedTypes, ", "),
	}
	CreateAuditLogEntry(auditLog)

	// Return updated permissions
	permissions, _ := h.permissionRepo.GetUserPermissions(ctx, userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(permissions)
}
