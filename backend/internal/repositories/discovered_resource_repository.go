package repositories

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// DiscoveredResourceRepository handles discovered resource database operations
type DiscoveredResourceRepository struct{}

// NewDiscoveredResourceRepository creates a new repository
func NewDiscoveredResourceRepository() *DiscoveredResourceRepository {
	return &DiscoveredResourceRepository{}
}

// Create creates a new discovered resource
func (r *DiscoveredResourceRepository) Create(ctx context.Context, res *models.DiscoveredResource) error {
	query := `
		INSERT INTO discovered_resources (project_id, secret_id, arn, resource_type, name, region, status, metadata, last_synced_at, discovered_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (project_id, arn) DO UPDATE SET
			status = EXCLUDED.status,
			metadata = EXCLUDED.metadata,
			last_synced_at = EXCLUDED.last_synced_at,
			updated_at = NOW()
		RETURNING id
	`

	now := time.Now()
	metadata := res.Metadata
	if metadata == nil {
		metadata = json.RawMessage("{}")
	}

	err := database.DB.QueryRow(ctx, query,
		res.ProjectID,
		res.SecretID,
		res.ARN,
		res.ResourceType,
		res.Name,
		res.Region,
		res.Status,
		metadata,
		&now,
		now,
	).Scan(&res.ID)

	return err
}

// GetByProjectID retrieves all discovered resources for a project
func (r *DiscoveredResourceRepository) GetByProjectID(ctx context.Context, projectID string) ([]models.DiscoveredResource, error) {
	query := `
		SELECT id, project_id, secret_id, arn, resource_type, name, region, status, metadata, last_synced_at, discovered_at, created_at, updated_at
		FROM discovered_resources
		WHERE project_id = $1
		ORDER BY resource_type, name
	`

	rows, err := database.DB.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var resources []models.DiscoveredResource
	for rows.Next() {
		var res models.DiscoveredResource
		var secretID, metadata *string
		var lastSyncedAt *time.Time

		err := rows.Scan(
			&res.ID,
			&res.ProjectID,
			&secretID,
			&res.ARN,
			&res.ResourceType,
			&res.Name,
			&res.Region,
			&res.Status,
			&metadata,
			&lastSyncedAt,
			&res.DiscoveredAt,
			&res.CreatedAt,
			&res.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if secretID != nil {
			res.SecretID = *secretID
		}
		if metadata != nil {
			res.Metadata = json.RawMessage(*metadata)
		}
		if lastSyncedAt != nil {
			res.LastSyncedAt = lastSyncedAt
		}

		resources = append(resources, res)
	}

	return resources, rows.Err()
}

// GetBySecretID retrieves all discovered resources for a secret
func (r *DiscoveredResourceRepository) GetBySecretID(ctx context.Context, secretID string) ([]models.DiscoveredResource, error) {
	query := `
		SELECT id, project_id, secret_id, arn, resource_type, name, region, status, metadata, last_synced_at, discovered_at, created_at, updated_at
		FROM discovered_resources
		WHERE secret_id = $1
	`

	rows, err := database.DB.Query(ctx, query, secretID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var resources []models.DiscoveredResource
	for rows.Next() {
		var res models.DiscoveredResource
		var secretID, metadata *string
		var lastSyncedAt *time.Time

		err := rows.Scan(
			&res.ID,
			&res.ProjectID,
			&secretID,
			&res.ARN,
			&res.ResourceType,
			&res.Name,
			&res.Region,
			&res.Status,
			&metadata,
			&lastSyncedAt,
			&res.DiscoveredAt,
			&res.CreatedAt,
			&res.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if secretID != nil {
			res.SecretID = *secretID
		}
		if metadata != nil {
			res.Metadata = json.RawMessage(*metadata)
		}
		if lastSyncedAt != nil {
			res.LastSyncedAt = lastSyncedAt
		}

		resources = append(resources, res)
	}

	return resources, rows.Err()
}

// GetByARN retrieves a discovered resource by ARN for a project
func (r *DiscoveredResourceRepository) GetByARN(ctx context.Context, projectID, arn string) (*models.DiscoveredResource, error) {
	query := `
		SELECT id, project_id, secret_id, arn, resource_type, name, region, status, metadata, last_synced_at, discovered_at, created_at, updated_at
		FROM discovered_resources
		WHERE project_id = $1 AND arn = $2
	`

	var res models.DiscoveredResource
	var secretID, metadata *string
	var lastSyncedAt *time.Time

	err := database.DB.QueryRow(ctx, query, projectID, arn).Scan(
		&res.ID,
		&res.ProjectID,
		&secretID,
		&res.ARN,
		&res.ResourceType,
		&res.Name,
		&res.Region,
		&res.Status,
		&metadata,
		&lastSyncedAt,
		&res.DiscoveredAt,
		&res.CreatedAt,
		&res.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if secretID != nil {
		res.SecretID = *secretID
	}
	if metadata != nil {
		res.Metadata = json.RawMessage(*metadata)
	}
	if lastSyncedAt != nil {
		res.LastSyncedAt = lastSyncedAt
	}

	return &res, nil
}

// UpdateStatus updates the status of a discovered resource
func (r *DiscoveredResourceRepository) UpdateStatus(ctx context.Context, id string, status models.DiscoveredResourceStatus) error {
	query := `
		UPDATE discovered_resources 
		SET status = $1, last_synced_at = NOW(), updated_at = NOW()
		WHERE id = $2
	`

	result, err := database.DB.Exec(ctx, query, status, id)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("resource not found")
	}

	return nil
}

// MarkAllAsUnknown marks all resources for a project as unknown (before sync)
func (r *DiscoveredResourceRepository) MarkAllAsUnknown(ctx context.Context, projectID, secretID string) error {
	query := `
		UPDATE discovered_resources 
		SET status = 'unknown', updated_at = NOW()
		WHERE project_id = $1 AND secret_id = $2
	`

	_, err := database.DB.Exec(ctx, query, projectID, secretID)
	return err
}

// MarkUnknownAsDeleted marks all unknown resources as deleted (after sync)
func (r *DiscoveredResourceRepository) MarkUnknownAsDeleted(ctx context.Context, projectID, secretID string) (int64, error) {
	query := `
		UPDATE discovered_resources 
		SET status = 'deleted', updated_at = NOW()
		WHERE project_id = $1 AND secret_id = $2 AND status = 'unknown'
	`

	result, err := database.DB.Exec(ctx, query, projectID, secretID)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected(), nil
}

// Delete removes a discovered resource
func (r *DiscoveredResourceRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM discovered_resources WHERE id = $1`

	result, err := database.DB.Exec(ctx, query, id)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("resource not found")
	}

	return nil
}
