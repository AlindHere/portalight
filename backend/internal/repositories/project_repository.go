package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// ProjectRepository handles project database operations
type ProjectRepository struct{}

// GetAll retrieves all projects
func (r *ProjectRepository) GetAll(ctx context.Context) ([]models.Project, error) {
	query := `
		SELECT id, name, description, confluence_url, avatar, owner_team_id, created_at, updated_at
		FROM projects
		ORDER BY created_at DESC
	`

	rows, err := database.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var project models.Project
		var confluenceURL, avatar, ownerTeamID *string

		err := rows.Scan(
			&project.ID,
			&project.Name,
			&project.Description,
			&confluenceURL,
			&avatar,
			&ownerTeamID,
			&project.CreatedAt,
			&project.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if confluenceURL != nil {
			project.ConfluenceURL = *confluenceURL
		}
		if avatar != nil {
			project.Avatar = *avatar
		}
		if ownerTeamID != nil {
			project.OwnerTeamID = *ownerTeamID
		}

		// Load team IDs and user IDs from project_access table
		teamIDs, userIDs, _ := r.GetProjectAccess(ctx, project.ID)
		project.TeamIDs = teamIDs
		project.UserIDs = userIDs

		projects = append(projects, project)
	}

	return projects, rows.Err()
}

// FindByID finds a project by ID
func (r *ProjectRepository) FindByID(ctx context.Context, id string) (*models.Project, error) {
	query := `
		SELECT id, name, description, confluence_url, avatar, owner_team_id, created_at, updated_at
		FROM projects
		WHERE id = $1::uuid
	`

	var project models.Project
	var confluenceURL, avatar, ownerTeamID *string

	err := database.DB.QueryRow(ctx, query, id).Scan(
		&project.ID,
		&project.Name,
		&project.Description,
		&confluenceURL,
		&avatar,
		&ownerTeamID,
		&project.CreatedAt,
		&project.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("project not found")
	}
	if err != nil {
		return nil, err
	}

	if confluenceURL != nil {
		project.ConfluenceURL = *confluenceURL
	}
	if avatar != nil {
		project.Avatar = *avatar
	}
	if ownerTeamID != nil {
		project.OwnerTeamID = *ownerTeamID
	}

	// Load team IDs and user IDs
	teamIDs, userIDs, _ := r.GetProjectAccess(ctx, project.ID)
	project.TeamIDs = teamIDs
	project.UserIDs = userIDs

	return &project, nil
}

// Create creates a new project
func (r *ProjectRepository) Create(ctx context.Context, project *models.Project) error {
	if project.ID == "" {
		project.ID = uuid.New().String()
	}
	if project.CreatedAt.IsZero() {
		project.CreatedAt = time.Now()
	}
	project.UpdatedAt = time.Now()

	query := `
		INSERT INTO projects (id, name, description, confluence_url, avatar, owner_team_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	var confluenceURL, avatar, ownerTeamID *string
	if project.ConfluenceURL != "" {
		confluenceURL = &project.ConfluenceURL
	}
	if project.Avatar != "" {
		avatar = &project.Avatar
	}
	if project.OwnerTeamID != "" {
		ownerTeamID = &project.OwnerTeamID
	}

	_, err := database.DB.Exec(ctx, query,
		project.ID,
		project.Name,
		project.Description,
		confluenceURL,
		avatar,
		ownerTeamID,
		project.CreatedAt,
		project.UpdatedAt,
	)

	return err
}

// Update updates a project
func (r *ProjectRepository) Update(ctx context.Context, project *models.Project) error {
	project.UpdatedAt = time.Now()

	query := `
		UPDATE projects
		SET name = $1, description = $2, confluence_url = $3, avatar = $4, owner_team_id = $5, updated_at = $6
		WHERE id = $7::uuid
	`

	var confluenceURL, avatar, ownerTeamID *string
	if project.ConfluenceURL != "" {
		confluenceURL = &project.ConfluenceURL
	}
	if project.Avatar != "" {
		avatar = &project.Avatar
	}
	if project.OwnerTeamID != "" {
		ownerTeamID = &project.OwnerTeamID
	}

	_, err := database.DB.Exec(ctx, query,
		project.Name,
		project.Description,
		confluenceURL,
		avatar,
		ownerTeamID,
		project.UpdatedAt,
		project.ID,
	)

	return err
}

// Delete deletes a project
func (r *ProjectRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM projects WHERE id = $1::uuid`
	_, err := database.DB.Exec(ctx, query, id)
	return err
}

// GetProjectAccess retrieves team and user IDs that have access to a project
func (r *ProjectRepository) GetProjectAccess(ctx context.Context, projectID string) ([]string, []string, error) {
	query := `
		SELECT team_id::text, user_id::text
		FROM project_access
		WHERE project_id = $1::uuid
	`

	rows, err := database.DB.Query(ctx, query, projectID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var teamIDs, userIDs []string
	for rows.Next() {
		var teamID, userID *string
		if err := rows.Scan(&teamID, &userID); err != nil {
			return nil, nil, err
		}
		if teamID != nil {
			teamIDs = append(teamIDs, *teamID)
		}
		if userID != nil {
			userIDs = append(userIDs, *userID)
		}
	}

	return teamIDs, userIDs, rows.Err()
}

// UpdateProjectAccess updates who has access to a project
func (r *ProjectRepository) UpdateProjectAccess(ctx context.Context, projectID string, teamIDs, userIDs []string) error {
	// Start transaction
	tx, err := database.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete existing access
	_, err = tx.Exec(ctx, "DELETE FROM project_access WHERE project_id = $1::uuid", projectID)
	if err != nil {
		return err
	}

	// Add team access
	for _, teamID := range teamIDs {
		_, err = tx.Exec(ctx,
			"INSERT INTO project_access (project_id, team_id) VALUES ($1::uuid, $2::uuid)",
			projectID, teamID)
		if err != nil {
			return err
		}
	}

	// Add user access
	for _, userID := range userIDs {
		_, err = tx.Exec(ctx,
			"INSERT INTO project_access (project_id, user_id) VALUES ($1::uuid, $2::uuid)",
			projectID, userID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
