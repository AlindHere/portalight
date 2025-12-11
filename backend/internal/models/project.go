package models

import "time"

// Project represents a collection of related services
type Project struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	ConfluenceURL string    `json:"confluence_url,omitempty"`
	Avatar        string    `json:"avatar,omitempty"`
	OwnerTeamID   string    `json:"owner_team_id,omitempty"`
	TeamIDs       []string  `json:"team_ids,omitempty"`
	UserIDs       []string  `json:"user_ids,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ProjectWithServices includes the project and all its associated services
type ProjectWithServices struct {
	Project
	Services []Service `json:"services"`
	TeamName string    `json:"team_name,omitempty"`
}
