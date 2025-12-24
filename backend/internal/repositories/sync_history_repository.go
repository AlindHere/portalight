package repositories

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/portalight/backend/internal/models"
)

type SyncHistoryRepository struct {
	db *pgxpool.Pool
}

func NewSyncHistoryRepository(db *pgxpool.Pool) *SyncHistoryRepository {
	return &SyncHistoryRepository{db: db}
}

// Create creates a new sync history record
func (r *SyncHistoryRepository) Create(ctx context.Context, history *models.SyncHistory) error {
	query := `
		INSERT INTO catalog_sync_history (
			id, sync_type, project_id, project_name, catalog_file_path,
			status, projects_created, projects_updated, services_created, services_updated, services_orphaned,
			error_message, validation_errors, started_at, completed_at, duration_ms,
			synced_by, synced_by_name
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16,
			$17, $18
		)
	`

	var projectID *string
	if history.ProjectID != "" {
		projectID = &history.ProjectID
	}

	var syncedBy *string
	if history.SyncedBy != "" {
		syncedBy = &history.SyncedBy
	}

	validationErrorsJSON, _ := json.Marshal(history.ValidationErrors)

	_, err := r.db.Exec(ctx, query,
		history.ID, history.SyncType, projectID, history.ProjectName, history.CatalogFilePath,
		history.Status, history.ProjectsCreated, history.ProjectsUpdated, history.ServicesCreated, history.ServicesUpdated, history.ServicesOrphaned,
		history.ErrorMessage, validationErrorsJSON, history.StartedAt, history.CompletedAt, history.DurationMs,
		syncedBy, history.SyncedByName,
	)

	return err
}

// Update updates an existing sync history record (e.g. to mark completion)
func (r *SyncHistoryRepository) Update(ctx context.Context, history *models.SyncHistory) error {
	query := `
		UPDATE catalog_sync_history
		SET status = $1,
		    projects_created = $2, projects_updated = $3,
		    services_created = $4, services_updated = $5, services_orphaned = $6,
		    error_message = $7, validation_errors = $8,
		    completed_at = $9, duration_ms = $10
		WHERE id = $11
	`

	validationErrorsJSON, _ := json.Marshal(history.ValidationErrors)

	_, err := r.db.Exec(ctx, query,
		history.Status, history.ProjectsCreated, history.ProjectsUpdated,
		history.ServicesCreated, history.ServicesUpdated, history.ServicesOrphaned,
		history.ErrorMessage, validationErrorsJSON,
		history.CompletedAt, history.DurationMs,
		history.ID,
	)

	return err
}
