package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// CurrentUserResponse represents the current logged-in user
type CurrentUserResponse struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	Role      string   `json:"role"` // superadmin, lead, dev
	TeamIDs   []string `json:"team_ids"`
	Avatar    string   `json:"avatar,omitempty"`
	CreatedAt string   `json:"created_at"`
}

// GetCurrentUser returns the currently logged-in user from JWT token
func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from middleware context
	userID := middleware.GetUserID(r.Context())

	if userID == "" {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	ctx := context.Background()
	userRepo := &repositories.UserRepository{}

	// Find user in database
	currentUser, err := userRepo.FindByID(ctx, userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Get permissions for user's role
	permissions := models.GetPermissions(currentUser.Role)
	permissionsJSON := make([]map[string]interface{}, len(permissions))
	for i, p := range permissions {
		permissionsJSON[i] = map[string]interface{}{
			"resource": p.Resource,
			"action":   p.Action,
			"allowed":  p.Allowed,
		}
	}

	response := map[string]interface{}{
		"user": CurrentUserResponse{
			ID:        currentUser.ID,
			Name:      currentUser.Name,
			Email:     currentUser.Email,
			Role:      string(currentUser.Role),
			TeamIDs:   currentUser.TeamIDs,
			Avatar:    currentUser.Avatar,
			CreatedAt: currentUser.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		"permissions": permissionsJSON,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
