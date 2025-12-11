package handlers

import (
	"encoding/json"
	"net/http"
)

// CurrentUserResponse represents the current logged-in user
type CurrentUserResponse struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	Role      string   `json:"role"` // superadmin, admin, dev
	TeamIDs   []string `json:"team_ids"`
	Avatar    string   `json:"avatar,omitempty"`
	CreatedAt string   `json:"created_at"`
}

// GetCurrentUser returns the currently logged-in user
func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Mock: Always return superadmin user with permissions
	response := map[string]interface{}{
		"user": CurrentUserResponse{
			ID:        "550e8400-e29b-41d4-a716-446655440000",
			Name:      "John Doe",
			Email:     "john.doe@company.com",
			Role:      "superadmin",
			TeamIDs:   []string{"team-1", "team-2"},
			Avatar:    "JD",
			CreatedAt: "2024-06-01T00:00:00Z",
		},
		"permissions": []map[string]interface{}{
			{"resource": "services", "action": "create", "allowed": true},
			{"resource": "services", "action": "read", "allowed": true},
			{"resource": "services", "action": "update", "allowed": true},
			{"resource": "services", "action": "delete", "allowed": true},
			{"resource": "projects", "action": "create", "allowed": true},
			{"resource": "projects", "action": "read", "allowed": true},
			{"resource": "users", "action": "manage", "allowed": true},
			{"resource": "credentials", "action": "manage", "allowed": true},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
