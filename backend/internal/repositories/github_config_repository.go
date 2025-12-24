package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GitHubConfig struct {
	ID                           string     `json:"id"`
	RepoOwner                    string     `json:"repo_owner"`
	RepoName                     string     `json:"repo_name"`
	Branch                       string     `json:"branch"`
	ProjectsPath                 string     `json:"projects_path"`
	AuthType                     string     `json:"auth_type"`
	GitHubAppID                  *int64     `json:"github_app_id"`
	GitHubAppInstallationID      *int64     `json:"github_app_installation_id"`
	GitHubAppPrivateKeyEncrypted *string    `json:"-"`
	PATEncrypted                 *string    `json:"-"`
	WebhookSecret                string     `json:"webhook_secret,omitempty"`
	Enabled                      bool       `json:"enabled"`
	LastScanAt                   *time.Time `json:"last_scan_at"`
	LastScanStatus               *string    `json:"last_scan_status"`
	LastScanError                *string    `json:"last_scan_error"`
	CreatedAt                    time.Time  `json:"created_at"`
	UpdatedAt                    time.Time  `json:"updated_at"`
}

type GitHubConfigRepository struct {
	db *pgxpool.Pool
}

func NewGitHubConfigRepository(db *pgxpool.Pool) *GitHubConfigRepository {
	return &GitHubConfigRepository{db: db}
}

// GetConfig retrieves the singleton configuration
func (r *GitHubConfigRepository) GetConfig(ctx context.Context) (*GitHubConfig, error) {
	query := `
		SELECT id, repo_owner, repo_name, branch, projects_path, auth_type,
		       github_app_id, github_app_installation_id, github_app_private_key_encrypted,
		       personal_access_token_encrypted, enabled, last_scan_at, last_scan_status,
		       last_scan_error, created_at, updated_at
		FROM github_metadata_config
		LIMIT 1
	`
	row := r.db.QueryRow(ctx, query)

	var config GitHubConfig
	err := row.Scan(
		&config.ID, &config.RepoOwner, &config.RepoName, &config.Branch, &config.ProjectsPath, &config.AuthType,
		&config.GitHubAppID, &config.GitHubAppInstallationID, &config.GitHubAppPrivateKeyEncrypted,
		&config.PATEncrypted, &config.Enabled, &config.LastScanAt, &config.LastScanStatus,
		&config.LastScanError, &config.CreatedAt, &config.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get github config: %w", err)
	}

	return &config, nil
}

// SaveConfig creates or updates the singleton configuration
func (r *GitHubConfigRepository) SaveConfig(ctx context.Context, config *GitHubConfig) error {
	// We use a fixed ID for the singleton row to ensure only one exists
	singletonID := "00000000-0000-0000-0000-000000000001"

	query := `
		INSERT INTO github_metadata_config (
			id, repo_owner, repo_name, branch, projects_path, auth_type,
			github_app_id, github_app_installation_id, github_app_private_key_encrypted,
			personal_access_token_encrypted, enabled, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
		)
		ON CONFLICT (id) DO UPDATE SET
			repo_owner = EXCLUDED.repo_owner,
			repo_name = EXCLUDED.repo_name,
			branch = EXCLUDED.branch,
			projects_path = EXCLUDED.projects_path,
			auth_type = EXCLUDED.auth_type,
			github_app_id = EXCLUDED.github_app_id,
			github_app_installation_id = EXCLUDED.github_app_installation_id,
			github_app_private_key_encrypted = COALESCE(EXCLUDED.github_app_private_key_encrypted, github_metadata_config.github_app_private_key_encrypted),
			personal_access_token_encrypted = COALESCE(EXCLUDED.personal_access_token_encrypted, github_metadata_config.personal_access_token_encrypted),
			enabled = EXCLUDED.enabled,
			updated_at = NOW()
	`

	_, err := r.db.Exec(ctx, query,
		singletonID, config.RepoOwner, config.RepoName, config.Branch, config.ProjectsPath, config.AuthType,
		config.GitHubAppID, config.GitHubAppInstallationID, config.GitHubAppPrivateKeyEncrypted,
		config.PATEncrypted, config.Enabled,
	)

	if err != nil {
		return fmt.Errorf("failed to save github config: %w", err)
	}

	return nil
}

// UpdateScanStatus updates the last scan status
func (r *GitHubConfigRepository) UpdateScanStatus(ctx context.Context, status string, errMessage *string) error {
	singletonID := "00000000-0000-0000-0000-000000000001"
	query := `
		UPDATE github_metadata_config
		SET last_scan_at = NOW(),
		    last_scan_status = $2,
		    last_scan_error = $3
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, singletonID, status, errMessage)
	if err != nil {
		return fmt.Errorf("failed to update scan status: %w", err)
	}
	return nil
}
