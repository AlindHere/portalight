package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/portalight/backend/internal/models"
)

var mockUsers = []models.User{
	{
		ID:        "user-1",
		Name:      "Alice Engineer",
		Email:     "alice@company.com",
		Role:      models.RoleLead,
		TeamIDs:   []string{"team-fintech"},
		CreatedAt: time.Now().AddDate(0, -12, 0),
	},
	{
		ID:        "user-2",
		Name:      "Bob Developer",
		Email:     "bob@company.com",
		Role:      models.RoleDev,
		TeamIDs:   []string{"team-fintech"},
		CreatedAt: time.Now().AddDate(0, -8, 0),
	},
	{
		ID:        "user-3",
		Name:      "Charlie Designer",
		Email:     "charlie@company.com",
		Role:      models.RoleDev,
		TeamIDs:   []string{"team-ux"},
		CreatedAt: time.Now().AddDate(0, -4, 0),
	},
	{
		ID:        "user-4",
		Name:      "Dave Data",
		Email:     "dave@company.com",
		Role:      models.RoleDev,
		TeamIDs:   []string{"team-data"},
		CreatedAt: time.Now().AddDate(0, -2, 0),
	},
	{
		ID:        "admin-user",
		Name:      "Admin User",
		Email:     "admin@company.com",
		Role:      models.RoleAdmin,
		TeamIDs:   []string{},
		CreatedAt: time.Now().AddDate(-1, 0, 0),
	},
}

// GetUsers returns all users
func GetUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockUsers)
}

// CreateUser creates a new user
func CreateUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user.ID = "user-" + time.Now().Format("20060102150405")
	user.CreatedAt = time.Now()
	mockUsers = append(mockUsers, user)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// UpdateUser updates a user
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	// Mock implementation
	w.WriteHeader(http.StatusOK)
}

// DeleteUser deletes a user
func DeleteUser(w http.ResponseWriter, r *http.Request) {
	// Mock implementation
	w.WriteHeader(http.StatusOK)
}
