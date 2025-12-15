package repositories

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// ServiceRepository handles service database operations
type ServiceRepository struct{}

// GetAll retrieves all services
func (r *ServiceRepository) GetAll(ctx context.Context) ([]models.Service, error) {
	query := `
		SELECT id, name, description, environment, language, tags, github_repo, owner, grafana_url, confluence_url, team_id
		FROM services
		ORDER BY name
	`

	rows, err := database.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var service models.Service
		var environment, language, grafanaURL, confluenceURL, teamID *string
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
