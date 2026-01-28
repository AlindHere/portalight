package repositories

import (
	"context"
	"errors"
	"time"

	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// ErrNotFound is returned when a record is not found
var ErrNotFound = errors.New("record not found")

// ArgoCDRepository handles ArgoCD-related database operations
type ArgoCDRepository struct{}

// NewArgoCDRepository creates a new ArgoCD repository
func NewArgoCDRepository() *ArgoCDRepository {
	return &ArgoCDRepository{}
}

// GetByServiceID retrieves all ArgoCD apps linked to a service
func (r *ArgoCDRepository) GetByServiceID(ctx context.Context, serviceID string) ([]models.ServiceArgoCDApp, error) {
	query := `
		SELECT id, service_id, argocd_app_name, environment_name, created_at, updated_at
		FROM service_argocd_apps
		WHERE service_id = $1
		ORDER BY environment_name
	`

	rows, err := database.DB.Query(ctx, query, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []models.ServiceArgoCDApp
	for rows.Next() {
		var app models.ServiceArgoCDApp
		err := rows.Scan(
			&app.ID,
			&app.ServiceID,
			&app.ArgoCDAppName,
			&app.EnvironmentName,
			&app.CreatedAt,
			&app.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		apps = append(apps, app)
	}

	return apps, rows.Err()
}

// Create links an ArgoCD app to a service
func (r *ArgoCDRepository) Create(ctx context.Context, app *models.ServiceArgoCDApp) error {
	query := `
		INSERT INTO service_argocd_apps (service_id, argocd_app_name, environment_name)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`

	return database.DB.QueryRow(ctx, query,
		app.ServiceID,
		app.ArgoCDAppName,
		app.EnvironmentName,
	).Scan(&app.ID, &app.CreatedAt, &app.UpdatedAt)
}

// Delete removes an ArgoCD app link from a service
func (r *ArgoCDRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM service_argocd_apps WHERE id = $1`

	result, err := database.DB.Exec(ctx, query, id)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// DeleteByServiceID removes all ArgoCD app links for a service
func (r *ArgoCDRepository) DeleteByServiceID(ctx context.Context, serviceID string) error {
	query := `DELETE FROM service_argocd_apps WHERE service_id = $1`
	_, err := database.DB.Exec(ctx, query, serviceID)
	return err
}

// Update updates an existing ArgoCD app link
func (r *ArgoCDRepository) Update(ctx context.Context, app *models.ServiceArgoCDApp) error {
	query := `
		UPDATE service_argocd_apps
		SET argocd_app_name = $1, environment_name = $2, updated_at = $3
		WHERE id = $4
	`

	now := time.Now()
	result, err := database.DB.Exec(ctx, query,
		app.ArgoCDAppName,
		app.EnvironmentName,
		now,
		app.ID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	app.UpdatedAt = now
	return nil
}

// FindByID finds a specific ArgoCD app link
func (r *ArgoCDRepository) FindByID(ctx context.Context, id string) (*models.ServiceArgoCDApp, error) {
	query := `
		SELECT id, service_id, argocd_app_name, environment_name, created_at, updated_at
		FROM service_argocd_apps
		WHERE id = $1
	`

	var app models.ServiceArgoCDApp
	err := database.DB.QueryRow(ctx, query, id).Scan(
		&app.ID,
		&app.ServiceID,
		&app.ArgoCDAppName,
		&app.EnvironmentName,
		&app.CreatedAt,
		&app.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &app, nil
}
