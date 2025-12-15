package repositories

import (
	"context"

	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// SecretRepository handles secret database operations
type SecretRepository struct{}

// GetAll retrieves all secrets
func (r *SecretRepository) GetAll(ctx context.Context) ([]models.Secret, error) {
	query := `
		SELECT id, name, provider, region, created_by, created_at
		FROM secrets
		ORDER BY name
	`

	rows, err := database.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []models.Secret
	for rows.Next() {
		var secret models.Secret
		var region, createdBy *string

		err := rows.Scan(
			&secret.ID,
			&secret.Name,
			&secret.Provider,
			&region,
			&createdBy,
			&secret.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if region != nil {
			secret.Region = *region
		}
		if createdBy != nil {
			secret.CreatedBy = *createdBy
		}

		secrets = append(secrets, secret)
	}

	return secrets, rows.Err()
}
