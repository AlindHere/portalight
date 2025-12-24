package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/portalight/backend/internal/models"
)

type ResourceRepository struct {
	db *pgxpool.Pool
}

func NewResourceRepository(db *pgxpool.Pool) *ResourceRepository {
	return &ResourceRepository{db: db}
}

func (r *ResourceRepository) Create(ctx context.Context, resource *models.Resource) error {
	query := `
		INSERT INTO resources (project_id, name, type, status, config, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	resource.CreatedAt = time.Now()
	resource.UpdatedAt = time.Now()

	err := r.db.QueryRow(ctx, query,
		resource.ProjectID,
		resource.Name,
		resource.Type,
		resource.Status,
		resource.Config,
		resource.CreatedAt,
		resource.UpdatedAt,
	).Scan(&resource.ID)

	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}
	return nil
}

func (r *ResourceRepository) FindByProjectID(ctx context.Context, projectID string) ([]models.Resource, error) {
	query := `
		SELECT id, project_id, name, type, status, config, arn, error_message, created_at, updated_at
		FROM resources
		WHERE project_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to query resources: %w", err)
	}
	defer rows.Close()

	resources := []models.Resource{}
	for rows.Next() {
		var res models.Resource
		var arn, errorMsg *string
		err := rows.Scan(
			&res.ID,
			&res.ProjectID,
			&res.Name,
			&res.Type,
			&res.Status,
			&res.Config,
			&arn,
			&errorMsg,
			&res.CreatedAt,
			&res.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan resource: %w", err)
		}
		if arn != nil {
			res.ARN = *arn
		}
		if errorMsg != nil {
			res.ErrorMsg = *errorMsg
		}
		resources = append(resources, res)
	}

	return resources, nil
}

func (r *ResourceRepository) UpdateStatus(ctx context.Context, id string, status string) error {
	query := `
		UPDATE resources
		SET status = $1, updated_at = $2
		WHERE id = $3
	`
	_, err := r.db.Exec(ctx, query, status, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update resource status: %w", err)
	}
	return nil
}

func (r *ResourceRepository) UpdateStatusWithError(ctx context.Context, id string, status string, errorMsg string) error {
	query := `
		UPDATE resources
		SET status = $1, error_message = $2, updated_at = $3
		WHERE id = $4
	`
	_, err := r.db.Exec(ctx, query, status, errorMsg, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update resource status: %w", err)
	}
	return nil
}

func (r *ResourceRepository) UpdateStatusWithARN(ctx context.Context, id string, status string, arn string) error {
	query := `
		UPDATE resources
		SET status = $1, arn = $2, updated_at = $3
		WHERE id = $4
	`
	_, err := r.db.Exec(ctx, query, status, arn, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update resource status: %w", err)
	}
	return nil
}
