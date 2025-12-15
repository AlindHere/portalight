package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// GetUsers returns all users
func GetUsers(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userRepo := &repositories.UserRepository{}

	users, err := userRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// CreateUser creates a new user
func CreateUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user.CreatedAt = time.Now()

	ctx := context.Background()
	userRepo := &repositories.UserRepository{}

	if err := userRepo.Create(ctx, &user); err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// UpdateUser updates a user
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	var updateData struct {
		Role    *string   `json:"role"`
		TeamIDs *[]string `json:"team_ids"`
		Name    *string   `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Extract user ID from URL path
	userID := r.URL.Path[len("/api/v1/users/"):]

	ctx := context.Background()
	userRepo := &repositories.UserRepository{}

	// Find user
	user, err := userRepo.FindByID(ctx, userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Update fields
	if updateData.Role != nil {
		user.Role = models.Role(*updateData.Role)
	}
	if updateData.TeamIDs != nil {
		user.TeamIDs = *updateData.TeamIDs
	}
	if updateData.Name != nil {
		user.Name = *updateData.Name
	}

	// Save to database
	if err := userRepo.Update(ctx, user); err != nil {
		http.Error(w, "Failed to update user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// DeleteUser deletes a user
func DeleteUser(w http.ResponseWriter, r *http.Request) {
	// Mock implementation
	w.WriteHeader(http.StatusOK)
}
