package repositories

import (
	"context"
	"time"

	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// ServiceLinkRepository handles service link database operations
type ServiceLinkRepository struct{}

// NewServiceLinkRepository creates a new ServiceLinkRepository
func NewServiceLinkRepository() *ServiceLinkRepository {
	return &ServiceLinkRepository{}
}

// GetByServiceID retrieves all links for a service
func (r *ServiceLinkRepository) GetByServiceID(ctx context.Context, serviceID string) ([]models.ServiceLink, error) {
	query := `
		SELECT id, service_id, label, url, icon, created_at, updated_at
		FROM service_links
		WHERE service_id = $1
		ORDER BY label
	`

	rows, err := database.DB.Query(ctx, query, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []models.ServiceLink
	for rows.Next() {
		var link models.ServiceLink
		var icon *string

		err := rows.Scan(
			&link.ID,
			&link.ServiceID,
			&link.Label,
			&link.URL,
			&icon,
			&link.CreatedAt,
			&link.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if icon != nil {
			link.Icon = *icon
		}

		links = append(links, link)
	}

	return links, rows.Err()
}

// Create creates a new service link
func (r *ServiceLinkRepository) Create(ctx context.Context, link *models.ServiceLink) error {
	query := `
		INSERT INTO service_links (service_id, label, url, icon, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	now := time.Now()
	var icon *string
	if link.Icon != "" {
		icon = &link.Icon
	}

	err := database.DB.QueryRow(ctx, query,
		link.ServiceID,
		link.Label,
		link.URL,
		icon,
		now,
		now,
	).Scan(&link.ID)

	if err != nil {
		return err
	}

	link.CreatedAt = now
	link.UpdatedAt = now
	return nil
}

// Update updates an existing service link
func (r *ServiceLinkRepository) Update(ctx context.Context, link *models.ServiceLink) error {
	query := `
		UPDATE service_links
		SET label = $1, url = $2, icon = $3, updated_at = $4
		WHERE id = $5
	`

	now := time.Now()
	var icon *string
	if link.Icon != "" {
		icon = &link.Icon
	}

	_, err := database.DB.Exec(ctx, query,
		link.Label,
		link.URL,
		icon,
		now,
		link.ID,
	)

	if err != nil {
		return err
	}

	link.UpdatedAt = now
	return nil
}

// Delete deletes a service link
func (r *ServiceLinkRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM service_links WHERE id = $1`
	_, err := database.DB.Exec(ctx, query, id)
	return err
}

// DeleteByServiceID deletes all links for a service
func (r *ServiceLinkRepository) DeleteByServiceID(ctx context.Context, serviceID string) error {
	query := `DELETE FROM service_links WHERE service_id = $1`
	_, err := database.DB.Exec(ctx, query, serviceID)
	return err
}
