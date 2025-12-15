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

// TeamRepository handles team database operations
type TeamRepository struct{}

// GetAll retrieves all teams
func (r *TeamRepository) GetAll(ctx context.Context) ([]models.Team, error) {
	query := `
		SELECT id, name, description, created_at
		FROM teams
		ORDER BY created_at DESC
	`

	rows, err := database.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []models.Team
	for rows.Next() {
		var team models.Team
		err := rows.Scan(
			&team.ID,
			&team.Name,
			&team.Description,
			&team.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Load member IDs
		memberIDs, _ := r.GetTeamMemberIDs(ctx, team.ID)
		team.MemberIDs = memberIDs

		// Load service IDs (if needed, currently empty)
		team.ServiceIDs = []string{}

		teams = append(teams, team)
	}

	return teams, rows.Err()
}

// FindByID finds a team by ID
func (r *TeamRepository) FindByID(ctx context.Context, id string) (*models.Team, error) {
	query := `
		SELECT id, name, description, created_at
		FROM teams
		WHERE id = $1::uuid
	`

	var team models.Team
	err := database.DB.QueryRow(ctx, query, id).Scan(
		&team.ID,
		&team.Name,
		&team.Description,
		&team.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("team not found")
	}
	if err != nil {
		return nil, err
	}

	// Load member IDs
	memberIDs, _ := r.GetTeamMemberIDs(ctx, team.ID)
	team.MemberIDs = memberIDs

	// Load service IDs
	team.ServiceIDs = []string{}

	return &team, nil
}

// Create creates a new team
func (r *TeamRepository) Create(ctx context.Context, team *models.Team) error {
	if team.ID == "" {
		team.ID = uuid.New().String()
	}
	if team.CreatedAt.IsZero() {
		team.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO teams (id, name, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err := database.DB.Exec(ctx, query,
		team.ID,
		team.Name,
		team.Description,
		team.CreatedAt,
		time.Now(),
	)

	return err
}

// Update updates a team
func (r *TeamRepository) Update(ctx context.Context, team *models.Team) error {
	query := `
		UPDATE teams
		SET name = $1, description = $2, updated_at = $3
		WHERE id = $4::uuid
	`

	_, err := database.DB.Exec(ctx, query,
		team.Name,
		team.Description,
		time.Now(),
		team.ID,
	)

	return err
}

// Delete deletes a team
func (r *TeamRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM teams WHERE id = $1::uuid`
	_, err := database.DB.Exec(ctx, query, id)
	return err
}

// GetTeamMemberIDs retrieves member IDs for a team
func (r *TeamRepository) GetTeamMemberIDs(ctx context.Context, teamID string) ([]string, error) {
	query := `
		SELECT user_id::text
		FROM team_members
		WHERE team_id = $1::uuid
	`

	rows, err := database.DB.Query(ctx, query, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memberIDs []string
	for rows.Next() {
		var memberID string
		if err := rows.Scan(&memberID); err != nil {
			return nil, err
		}
		memberIDs = append(memberIDs, memberID)
	}

	return memberIDs, rows.Err()
}

// UpdateTeamMembers updates the members of a team
func (r *TeamRepository) UpdateTeamMembers(ctx context.Context, teamID string, memberIDs []string) error {
	// Start transaction
	tx, err := database.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete existing members
	_, err = tx.Exec(ctx, "DELETE FROM team_members WHERE team_id = $1::uuid", teamID)
	if err != nil {
		return err
	}

	// Add new members
	for _, memberID := range memberIDs {
		_, err = tx.Exec(ctx,
			"INSERT INTO team_members (team_id, user_id) VALUES ($1::uuid, $2::uuid)",
			teamID, memberID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
