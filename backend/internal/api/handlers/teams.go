package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// GetTeams returns all teams
func GetTeams(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	teamRepo := &repositories.TeamRepository{}

	teams, err := teamRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, "Failed to fetch teams", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

// CreateTeam creates a new team
func CreateTeam(w http.ResponseWriter, r *http.Request) {
	var team models.Team
	if err := json.NewDecoder(r.Body).Decode(&team); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	team.CreatedAt = time.Now()

	ctx := context.Background()
	teamRepo := &repositories.TeamRepository{}

	if err := teamRepo.Create(ctx, &team); err != nil {
		http.Error(w, "Failed to create team", http.StatusInternalServerError)
		return
	}

	// Create audit log
	userEmail := middleware.GetUserEmail(r.Context())
	userName := userEmail
	if userEmail != "" {
		userRepo := &repositories.UserRepository{}
		user, err := userRepo.FindByEmail(ctx, userEmail)
		if err == nil {
			userName = user.Name
		}
	}

	detailsJSON, _ := json.Marshal(map[string]interface{}{
		"team_id":     team.ID,
		"team_name":   team.Name,
		"description": team.Description,
	})

	auditLog := models.AuditLog{
		UserEmail:    userEmail,
		UserName:     userName,
		Action:       "create_team",
		ResourceType: "team",
		ResourceID:   team.ID,
		ResourceName: team.Name,
		Details:      string(detailsJSON),
		Status:       "success",
	}
	CreateAuditLogEntry(auditLog)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}

// DeleteTeam deletes a team
func DeleteTeam(w http.ResponseWriter, r *http.Request) {
	// Extract team ID from URL
	teamID := r.URL.Path[len("/api/v1/teams/"):]
	if len(teamID) > 0 && teamID[len(teamID)-1] == '/' {
		teamID = teamID[:len(teamID)-1]
	}

	ctx := context.Background()
	teamRepo := &repositories.TeamRepository{}

	if err := teamRepo.Delete(ctx, teamID); err != nil {
		http.Error(w, "Failed to delete team", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// UpdateTeamMembers updates members of a team
func UpdateTeamMembers(w http.ResponseWriter, r *http.Request) {
	var updateData struct {
		TeamID    string   `json:"team_id"`
		MemberIDs []string `json:"member_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	teamRepo := &repositories.TeamRepository{}

	// Update team members
	if err := teamRepo.UpdateTeamMembers(ctx, updateData.TeamID, updateData.MemberIDs); err != nil {
		http.Error(w, "Failed to update team members", http.StatusInternalServerError)
		return
	}

	// Return updated team
	team, err := teamRepo.FindByID(ctx, updateData.TeamID)
	if err != nil {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(team)
}
