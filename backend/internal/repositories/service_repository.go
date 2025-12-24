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

// ServiceRepository handles service database operations
type ServiceRepository struct{}

// GetAll retrieves all services
func (r *ServiceRepository) GetAll(ctx context.Context) ([]models.Service, error) {
	query := `
		SELECT id, name, description, environment, language, tags, github_repo, owner, grafana_url, confluence_url, team_id, project_id,
		       catalog_source, auto_synced, catalog_metadata
		FROM services
		ORDER BY name
	`

	rows, err := database.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	services := []models.Service{}
	for rows.Next() {
		var service models.Service
		var environment, language, grafanaURL, confluenceURL, teamID, projectID *string
		var catalogSource *string
		var tags []string

		err := rows.Scan(
			&service.ID,
			&service.Name,
			&service.Description,
			&environment,
			&language,
			&tags,
			&service.Repository,
			&service.Owner,
			&grafanaURL,
			&confluenceURL,
			&teamID,
			&projectID,
			&catalogSource,
			&service.AutoSynced,
			&service.CatalogMetadata,
		)
		if err != nil {
			return nil, err
		}

		if environment != nil {
			service.Environment = *environment
		}
		if language != nil {
			service.Language = *language
		}
		if tags != nil {
			service.Tags = tags
		} else {
			service.Tags = []string{}
		}
		if grafanaURL != nil {
			service.GrafanaURL = *grafanaURL
		}
		if confluenceURL != nil {
			service.ConfluenceURL = *confluenceURL
		}
		if teamID != nil {
			service.Team = *teamID
		}
		if projectID != nil {
			service.ProjectID = *projectID
		}
		if catalogSource != nil {
			service.CatalogSource = *catalogSource
		}

		services = append(services, service)
	}

	return services, rows.Err()
}

// FindByID finds a service by ID
func (r *ServiceRepository) FindByID(ctx context.Context, id string) (*models.Service, error) {
	query := `
		SELECT id, name, description, environment, language, tags, github_repo, owner, grafana_url, confluence_url, team_id
		FROM services
		WHERE id = $1::uuid
	`

	var service models.Service
	var environment, language, grafanaURL, confluenceURL, teamID *string
	var tags []string

	err := database.DB.QueryRow(ctx, query, id).Scan(
		&service.ID,
		&service.Name,
		&service.Description,
		&environment,
		&language,
		&tags,
		&service.Repository,
		&service.Owner,
		&grafanaURL,
		&confluenceURL,
		&teamID,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("service not found")
	}
	if err != nil {
		return nil, err
	}

	if environment != nil {
		service.Environment = *environment
	}
	if language != nil {
		service.Language = *language
	}
	if tags != nil {
		service.Tags = tags
	} else {
		service.Tags = []string{}
	}
	if grafanaURL != nil {
		service.GrafanaURL = *grafanaURL
	}
	if confluenceURL != nil {
		service.ConfluenceURL = *confluenceURL
	}
	if teamID != nil {
		service.Team = *teamID
	}

	return &service, nil
}

// FindByProjectID returns all services for a specific project
func (r *ServiceRepository) FindByProjectID(ctx context.Context, projectID string) ([]models.Service, error) {
	query := `
		SELECT id, name, description, team_id, project_id, environment, language, tags,
		       github_repo, grafana_url, confluence_url, owner, catalog_source,
		       auto_synced, created_at, updated_at
		FROM services
		WHERE project_id = $1
		ORDER BY name
	`

	rows, err := database.DB.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var service models.Service
		var teamID, grafanaURL, confluenceURL, owner, catalogSource *string

		err := rows.Scan(
			&service.ID,
			&service.Name,
			&service.Description,
			&teamID,
			&service.ProjectID,
			&service.Environment,
			&service.Language,
			&service.Tags,
			&service.Repository,
			&grafanaURL,
			&confluenceURL,
			&owner,
			&catalogSource,
			&service.AutoSynced,
			&service.CreatedAt,
			&service.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if teamID != nil {
			service.Team = *teamID
		}
		if grafanaURL != nil {
			service.GrafanaURL = *grafanaURL
		}
		if confluenceURL != nil {
			service.ConfluenceURL = *confluenceURL
		}
		if owner != nil {
			service.Owner = *owner
		}
		if catalogSource != nil {
			service.CatalogSource = *catalogSource
		}

		services = append(services, service)
	}

	return services, nil
}

// UpsertFromCatalog creates or updates a service from catalog data
func (r *ServiceRepository) UpsertFromCatalog(ctx context.Context, service *models.Service) error {
	if service.ID == "" {
		service.ID = uuid.New().String()
	}
	now := time.Now()
	if service.CreatedAt.IsZero() {
		service.CreatedAt = now
	}
	service.UpdatedAt = now

	query := `
		INSERT INTO services (
			id, name, description, environment, language, tags, github_repo, owner,
			grafana_url, confluence_url, team_id, project_id,
			catalog_source, auto_synced, catalog_metadata,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			$9, $10, $11, $12,
			$13, $14, $15,
			$16, $17
		)
		ON CONFLICT (project_id, name) DO UPDATE SET
			description = EXCLUDED.description,
			environment = EXCLUDED.environment,
			language = EXCLUDED.language,
			tags = EXCLUDED.tags,
			github_repo = EXCLUDED.github_repo,
			owner = EXCLUDED.owner,
			grafana_url = EXCLUDED.grafana_url,
			confluence_url = EXCLUDED.confluence_url,
			team_id = EXCLUDED.team_id,
			catalog_source = EXCLUDED.catalog_source,
			auto_synced = EXCLUDED.auto_synced,
			catalog_metadata = EXCLUDED.catalog_metadata,
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`

	var teamID, projectID *string
	if service.Team != "" {
		teamID = &service.Team
	}
	if service.ProjectID != "" {
		projectID = &service.ProjectID
	}

	err := database.DB.QueryRow(ctx, query,
		service.ID,
		service.Name,
		service.Description,
		service.Environment,
		service.Language,
		service.Tags,
		service.Repository,
		service.Owner,
		service.GrafanaURL,
		service.ConfluenceURL,
		teamID,
		projectID,
		service.CatalogSource,
		service.AutoSynced,
		service.CatalogMetadata,
		service.CreatedAt,
		service.UpdatedAt,
	).Scan(&service.ID)

	return err
}

// DeleteOrphanedServices removes services that belong to a project but are not in the active list
func (r *ServiceRepository) DeleteOrphanedServices(ctx context.Context, projectID string, activeServiceNames []string) error {
	query := `
		DELETE FROM services
		WHERE project_id = $1::uuid
		  AND auto_synced = true
		  AND name != ALL($2)
	`
	_, err := database.DB.Exec(ctx, query, projectID, activeServiceNames)
	if err != nil {
		return fmt.Errorf("failed to delete orphaned services: %w", err)
	}
	return nil
}
