package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/portalight/backend/internal/models"
)

// Mock data for demonstration
var mockUsers = []models.User{
	{
		ID:        "user-1",
		Name:      "John Doe",
		Email:     "john.doe@company.com",
		Role:      models.RoleAdmin,
		TeamIDs:   []string{"team-1", "team-2"},
		Avatar:    "JD",
		CreatedAt: time.Now().AddDate(0, -6, 0),
	},
	{
		ID:        "user-2",
		Name:      "Jane Smith",
		Email:     "jane.smith@company.com",
		Role:      models.RoleDev,
		TeamIDs:   []string{"team-1"},
		Avatar:    "JS",
		CreatedAt: time.Now().AddDate(0, -3, 0),
	},
	{
		ID:        "user-3",
		Name:      "Bob Johnson",
		Email:     "bob.johnson@company.com",
		Role:      models.RoleDev,
		TeamIDs:   []string{"team-2"},
		Avatar:    "BJ",
		CreatedAt: time.Now().AddDate(0, -2, 0),
	},
}

var mockTeams = []models.Team{
	{
		ID:          "team-1",
		Name:        "Platform Team",
		Description: "Core platform infrastructure and services",
		MemberIDs:   []string{"user-1", "user-2"},
		ServiceIDs:  []string{"svc-1", "svc-2"},
		CreatedAt:   time.Now().AddDate(0, -6, 0),
	},
	{
		ID:          "team-2",
		Name:        "Product Team",
		Description: "Product features and user-facing applications",
		MemberIDs:   []string{"user-1", "user-3"},
		ServiceIDs:  []string{"svc-3", "svc-4"},
		CreatedAt:   time.Now().AddDate(0, -4, 0),
	},
}

// GetCurrentUser returns the currently logged-in user (mocked as admin)
func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Mock: Always return first user (admin) as logged-in user
	currentUser := mockUsers[0]

	// Get permissions
	permissions := models.GetPermissions(currentUser.Role)

	response := map[string]interface{}{
		"user":        currentUser,
		"permissions": permissions,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetUsers returns all users (admin only)
func GetUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// TODO: Check if user is admin
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockUsers)
}

// CreateUser adds a new user (admin only)
func CreateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var newUser models.User
	if err := json.NewDecoder(r.Body).Decode(&newUser); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate ID and timestamp
	newUser.ID = "user-" + time.Now().Format("20060102150405")
	newUser.CreatedAt = time.Now()

	// Add to mock data
	mockUsers = append(mockUsers, newUser)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newUser)
}

// UpdateUser updates user details (admin only)
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var updateData models.User
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Find and update user
	for i, user := range mockUsers {
		if user.ID == updateData.ID {
			mockUsers[i] = updateData
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(mockUsers[i])
			return
		}
	}

	http.Error(w, "User not found", http.StatusNotFound)
}

// DeleteUser removes a user (admin only)
func DeleteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.URL.Query().Get("id")
	if userID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Remove user from mock data
	for i, user := range mockUsers {
		if user.ID == userID {
			mockUsers = append(mockUsers[:i], mockUsers[i+1:]...)
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	http.Error(w, "User not found", http.StatusNotFound)
}

// GetTeams returns all teams
func GetTeams(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockTeams)
}

// CreateTeam creates a new team (admin only)
func CreateTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var newTeam models.Team
	if err := json.NewDecoder(r.Body).Decode(&newTeam); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate ID and timestamp
	newTeam.ID = "team-" + time.Now().Format("20060102150405")
	newTeam.CreatedAt = time.Now()

	// Add to mock data
	mockTeams = append(mockTeams, newTeam)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newTeam)
}

// UpdateTeamMembers updates team membership (admin only)
func UpdateTeamMembers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		TeamID    string   `json:"team_id"`
		MemberIDs []string `json:"member_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Find and update team
	for i, team := range mockTeams {
		if team.ID == request.TeamID {
			mockTeams[i].MemberIDs = request.MemberIDs
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(mockTeams[i])
			return
		}
	}

	http.Error(w, "Team not found", http.StatusNotFound)
}
