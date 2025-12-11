package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/portalight/backend/internal/models"
)

var mockTeams = []models.Team{
	{
		ID:          "team-fintech",
		Name:        "Team Fintech",
		Description: "Responsible for all payment and billing services.",
		MemberIDs:   []string{"user-1", "user-2"},
		ServiceIDs:  []string{"payments-service-go"},
		CreatedAt:   time.Now().AddDate(0, -6, 0),
	},
	{
		ID:          "team-ux",
		Name:        "Team UX",
		Description: "Frontend engineering and user experience.",
		MemberIDs:   []string{"user-3"},
		ServiceIDs:  []string{"customer-dashboard-ui"},
		CreatedAt:   time.Now().AddDate(0, -3, 0),
	},
	{
		ID:          "team-data",
		Name:        "Team Data Eng",
		Description: "Big data processing and analytics.",
		MemberIDs:   []string{"user-4"},
		ServiceIDs:  []string{"analytics-aggregator"},
		CreatedAt:   time.Now().AddDate(0, -1, 0),
	},
}

// GetTeams returns all teams
func GetTeams(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockTeams)
}

// CreateTeam creates a new team
func CreateTeam(w http.ResponseWriter, r *http.Request) {
	var team models.Team
	if err := json.NewDecoder(r.Body).Decode(&team); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	team.ID = "team-" + time.Now().Format("20060102150405")
	team.CreatedAt = time.Now()
	mockTeams = append(mockTeams, team)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}

// DeleteTeam deletes a team
func DeleteTeam(w http.ResponseWriter, r *http.Request) {
	// Mock implementation
	w.WriteHeader(http.StatusOK)
}

// UpdateTeamMembers updates members of a team
func UpdateTeamMembers(w http.ResponseWriter, r *http.Request) {
	// Mock implementation
	w.WriteHeader(http.StatusOK)
}
