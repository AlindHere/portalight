package repositories

import (
	"context"
	"time"

	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// ServiceResourceMappingRepository handles service-to-resource mapping database operations
type ServiceResourceMappingRepository struct{}

// NewServiceResourceMappingRepository creates a new ServiceResourceMappingRepository
func NewServiceResourceMappingRepository() *ServiceResourceMappingRepository {
	return &ServiceResourceMappingRepository{}
}

// GetByServiceID retrieves all resource mappings for a service with joined resource details
func (r *ServiceResourceMappingRepository) GetByServiceID(ctx context.Context, serviceID string) ([]models.ServiceResourceMapping, error) {
	query := `
		SELECT 
			srm.id, 
			srm.service_id, 
			srm.discovered_resource_id, 
			srm.created_at,
			dr.name,
			dr.resource_type,
			dr.arn,
			dr.region
		FROM service_resource_mappings srm
		LEFT JOIN discovered_resources dr ON srm.discovered_resource_id = dr.id
		WHERE srm.service_id = $1
		ORDER BY dr.resource_type, dr.name
	`

	rows, err := database.DB.Query(ctx, query, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mappings []models.ServiceResourceMapping
	for rows.Next() {
		var m models.ServiceResourceMapping
		var resourceName, resourceType, resourceARN, region *string

		err := rows.Scan(
			&m.ID,
			&m.ServiceID,
			&m.DiscoveredResourceID,
			&m.CreatedAt,
			&resourceName,
			&resourceType,
			&resourceARN,
			&region,
		)
		if err != nil {
			return nil, err
		}

		if resourceName != nil {
			m.ResourceName = *resourceName
		}
		if resourceType != nil {
			m.ResourceType = *resourceType
		}
		if resourceARN != nil {
			m.ResourceARN = *resourceARN
		}
		if region != nil {
			m.Region = *region
		}

		mappings = append(mappings, m)
	}

	return mappings, rows.Err()
}

// Create creates a new service-to-resource mapping
func (r *ServiceResourceMappingRepository) Create(ctx context.Context, mapping *models.ServiceResourceMapping) error {
	query := `
		INSERT INTO service_resource_mappings (service_id, discovered_resource_id, created_at)
		VALUES ($1, $2, $3)
		RETURNING id
	`

	now := time.Now()
	err := database.DB.QueryRow(ctx, query,
		mapping.ServiceID,
		mapping.DiscoveredResourceID,
		now,
	).Scan(&mapping.ID)

	if err != nil {
		return err
	}

	mapping.CreatedAt = now
	return nil
}

// Delete deletes a service-to-resource mapping
func (r *ServiceResourceMappingRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM service_resource_mappings WHERE id = $1`
	_, err := database.DB.Exec(ctx, query, id)
	return err
}

// DeleteByServiceAndResource deletes a specific mapping
func (r *ServiceResourceMappingRepository) DeleteByServiceAndResource(ctx context.Context, serviceID, resourceID string) error {
	query := `DELETE FROM service_resource_mappings WHERE service_id = $1 AND discovered_resource_id = $2`
	_, err := database.DB.Exec(ctx, query, serviceID, resourceID)
	return err
}

// DeleteByServiceID deletes all mappings for a service
func (r *ServiceResourceMappingRepository) DeleteByServiceID(ctx context.Context, serviceID string) error {
	query := `DELETE FROM service_resource_mappings WHERE service_id = $1`
	_, err := database.DB.Exec(ctx, query, serviceID)
	return err
}

// Exists checks if a mapping already exists
func (r *ServiceResourceMappingRepository) Exists(ctx context.Context, serviceID, resourceID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM service_resource_mappings WHERE service_id = $1 AND discovered_resource_id = $2)`
	var exists bool
	err := database.DB.QueryRow(ctx, query, serviceID, resourceID).Scan(&exists)
	return exists, err
}
