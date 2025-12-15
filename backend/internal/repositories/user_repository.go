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

// UserRepository handles user database operations
type UserRepository struct{}

// FindByEmail finds a user by email
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT id, name, email, role, avatar, github_id, github_username, avatar_url, password_hash, created_at
		FROM users
		WHERE email = $1
	`

	var user models.User
	var avatar *string // New nullable pointer for the 'avatar' column
	var githubID *int64
	var githubUsername, avatarURL, passwordHash *string

	err := database.DB.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Role,
		&avatar, // Scan into the nullable pointer
		&githubID,
		&githubUsername,
		&avatarURL,
		&passwordHash,
		&user.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	// Assign from nullable pointers
	if avatar != nil {
		user.Avatar = *avatar
	}
	if githubID != nil {
		user.GithubID = *githubID
	}
	if githubUsername != nil {
		user.GithubUsername = *githubUsername
	}
	if avatarURL != nil {
		user.Avatar = *avatarURL
	}
	if passwordHash != nil {
		user.PasswordHash = *passwordHash
	}

	// Load team IDs
	teamIDs, err := r.GetUserTeamIDs(ctx, user.ID)
	if err == nil {
		user.TeamIDs = teamIDs
	}

	return &user, nil
}

// FindByGithubID finds a user by GitHub ID
func (r *UserRepository) FindByGithubID(ctx context.Context, githubID int64) (*models.User, error) {
	query := `
		SELECT id, name, email, role, avatar, github_id, github_username, avatar_url, password_hash, created_at
		FROM users
		WHERE github_id = $1
	`

	var user models.User
	var email, avatar *string
	var githubUsername, avatarURL, passwordHash *string

	err := database.DB.QueryRow(ctx, query, githubID).Scan(
		&user.ID,
		&user.Name,
		&email,
		&user.Role,
		&avatar,
		&user.GithubID,
		&githubUsername,
		&avatarURL,
		&passwordHash,
		&user.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	if email != nil {
		user.Email = *email
	}
	if avatar != nil {
		user.Avatar = *avatar
	}
	if githubUsername != nil {
		user.GithubUsername = *githubUsername
	}
	if avatarURL != nil {
		user.Avatar = *avatarURL
	}
	if passwordHash != nil {
		user.PasswordHash = *passwordHash
	}

	// Load team IDs
	teamIDs, err := r.GetUserTeamIDs(ctx, user.ID)
	if err == nil {
		user.TeamIDs = teamIDs
	}

	return &user, nil
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	if user.CreatedAt.IsZero() {
		user.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO users (id, name, email, role, avatar, github_id, github_username, avatar_url, password_hash, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	var email *string
	if user.Email != "" {
		email = &user.Email
	}

	var githubID *int64
	if user.GithubID != 0 {
		githubID = &user.GithubID
	}

	var githubUsername *string
	if user.GithubUsername != "" {
		githubUsername = &user.GithubUsername
	}

	var avatarURL *string
	if user.Avatar != "" {
		avatarURL = &user.Avatar
	}

	var passwordHash *string
	if user.PasswordHash != "" {
		passwordHash = &user.PasswordHash
	}

	_, err := database.DB.Exec(ctx, query,
		user.ID,
		user.Name,
		email,
		user.Role,
		user.Avatar,
		githubID,
		githubUsername,
		avatarURL,
		passwordHash,
		user.CreatedAt,
		time.Now(),
	)

	return err
}

// Update updates an existing user
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users
		SET name = $1, email = $2, role = $3, avatar = $4, github_username = $5, avatar_url = $6, updated_at = $7
		WHERE id = $8
	`

	var email *string
	if user.Email != "" {
		email = &user.Email
	}

	var githubUsername *string
	if user.GithubUsername != "" {
		githubUsername = &user.GithubUsername
	}

	var avatarURL *string
	if user.Avatar != "" {
		avatarURL = &user.Avatar
	}

	_, err := database.DB.Exec(ctx, query,
		user.Name,
		email,
		user.Role,
		user.Avatar,
		githubUsername,
		avatarURL,
		time.Now(),
		user.ID,
	)

	return err
}

// GetUserTeamIDs retrieves team IDs for a user
func (r *UserRepository) GetUserTeamIDs(ctx context.Context, userID string) ([]string, error) {
	query := `
		SELECT team_id::text
		FROM team_members
		WHERE user_id = $1::uuid
	`

	rows, err := database.DB.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teamIDs []string
	for rows.Next() {
		var teamID string
		if err := rows.Scan(&teamID); err != nil {
			return nil, err
		}
		teamIDs = append(teamIDs, teamID)
	}

	return teamIDs, rows.Err()
}

// GetAll retrieves all users
func (r *UserRepository) GetAll(ctx context.Context) ([]models.User, error) {
	query := `
		SELECT id, name, email, role, avatar, github_id, github_username, avatar_url, created_at
		FROM users
		ORDER BY created_at DESC
	`

	rows, err := database.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		var email, avatar *string
		var githubID *int64
		var githubUsername, avatarURL *string

		err := rows.Scan(
			&user.ID,
			&user.Name,
			&email,
			&user.Role,
			&avatar,
			&githubID,
			&githubUsername,
			&avatarURL,
			&user.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if email != nil {
			user.Email = *email
		}
		if avatar != nil {
			user.Avatar = *avatar
		}
		if githubID != nil {
			user.GithubID = *githubID
		}
		if githubUsername != nil {
			user.GithubUsername = *githubUsername
		}
		if avatarURL != nil {
			user.Avatar = *avatarURL
		}

		// Load team IDs
		teamIDs, _ := r.GetUserTeamIDs(ctx, user.ID)
		if teamIDs == nil {
			user.TeamIDs = []string{}
		} else {
			user.TeamIDs = teamIDs
		}

		users = append(users, user)
	}

	return users, rows.Err()
}

// FindByID finds a user by ID
func (r *UserRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	query := `
		SELECT id, name, email, role, avatar, github_id, github_username, avatar_url, password_hash, created_at
		FROM users
		WHERE id = $1::uuid
	`

	var user models.User
	var email, avatar *string
	var githubID *int64
	var githubUsername, avatarURL, passwordHash *string

	err := database.DB.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Name,
		&email,
		&user.Role,
		&avatar,
		&githubID,
		&githubUsername,
		&avatarURL,
		&passwordHash,
		&user.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	if email != nil {
		user.Email = *email
	}
	if avatar != nil {
		user.Avatar = *avatar
	}
	if githubID != nil {
		user.GithubID = *githubID
	}
	if githubUsername != nil {
		user.GithubUsername = *githubUsername
	}
	if avatarURL != nil {
		user.Avatar = *avatarURL
	}
	if passwordHash != nil {
		user.PasswordHash = *passwordHash
	}

	// Load team IDs
	teamIDs, err := r.GetUserTeamIDs(ctx, user.ID)
	if err == nil {
		user.TeamIDs = teamIDs
	}

	return &user, nil
}
