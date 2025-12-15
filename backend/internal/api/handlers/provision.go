package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

type ProvisionHandler struct{}

func NewProvisionHandler() *ProvisionHandler {
	return &ProvisionHandler{}
}

// ProvisionResource handles resource provisioning requests
func (h *ProvisionHandler) ProvisionResource(w http.ResponseWriter, r *http.Request) {
	var req models.ProvisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// In production, this would:
	// 1. Validate the secret_id
	// 2. Retrieve credentials from secret store
	// 3. Use cloud provider SDK to create resources
	// 4. Return resource details

	response := map[string]interface{}{
		"status":        "provisioning",
		"resource_type": req.ResourceType,
		"secret_id":     req.SecretID,
		"message":       "Resource provisioning initiated",
	}

	// Create audit log entry
	detailsJSON, _ := json.Marshal(map[string]interface{}{
		"resource_type": req.ResourceType,
		"secret_id":     req.SecretID,
		"parameters":    req.Parameters,
	})

	resourceName := ""
	if name, ok := req.Parameters["name"].(string); ok {
		resourceName = name
	}

	// Get authenticated user from context
	userEmail := middleware.GetUserEmail(r.Context())
	userName := userEmail // Default to username if we can't find the full name

	if userEmail != "" {
		// Try to find the user's name from database
		// Match by either Email or GithubUsername
		ctx := context.Background()
		userRepo := &repositories.UserRepository{}

		user, err := userRepo.FindByEmail(ctx, userEmail)
		if err != nil {
			// Try finding by GitHub username
			users, _ := userRepo.GetAll(ctx)
			for _, u := range users {
				if u.GithubUsername == userEmail {
					userName = u.Name
					break
				}
			}
		} else {
			userName = user.Name
		}
	} else {
		userEmail = "unknown@user.com"
		userName = "Unknown User"
	}

	auditLog := models.AuditLog{
		UserEmail:    userEmail,
		UserName:     userName,
		Action:       "provision_resource",
		ResourceType: req.ResourceType,
		ResourceName: resourceName,
		Details:      string(detailsJSON),
		Status:       "success",
	}
	CreateAuditLogEntry(auditLog)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(response)
}
