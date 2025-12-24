package repositories

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/portalight/backend/internal/crypto"
	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// SecretRepository handles secret database operations
type SecretRepository struct{}

// Create creates a new secret with encrypted credentials
func (r *SecretRepository) Create(ctx context.Context, secret *models.Secret, credentials *models.AWSCredentials) error {
	// Serialize credentials to JSON
	credJSON, err := json.Marshal(credentials)
	if err != nil {
		return fmt.Errorf("failed to marshal credentials: %w", err)
	}

	// Encrypt credentials
	encrypted, err := crypto.Encrypt(string(credJSON))
	if err != nil {
		return fmt.Errorf("failed to encrypt credentials: %w", err)
	}

	query := `
		INSERT INTO secrets (name, provider, region, account_id, access_type, credentials_encrypted, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`

	now := time.Now()
	accessType := secret.AccessType
	if accessType == "" {
		accessType = models.AccessTypeWrite
	}
	err = database.DB.QueryRow(ctx, query,
		secret.Name,
		secret.Provider,
		secret.Region,
		secret.AccountID,
		accessType,
		encrypted,
		secret.CreatedBy,
		now,
		now,
	).Scan(&secret.ID)

	if err != nil {
		return fmt.Errorf("failed to create secret: %w", err)
	}

	secret.CreatedAt = now
	secret.UpdatedAt = now

	return nil
}

// GetAll retrieves all secrets (without credentials)
func (r *SecretRepository) GetAll(ctx context.Context) ([]models.Secret, error) {
	query := `
		SELECT id, name, provider, region, account_id, access_type, created_by, created_at, updated_at
		FROM secrets
		ORDER BY name
	`

	rows, err := database.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	secrets := []models.Secret{}
	for rows.Next() {
		var secret models.Secret
		var region, accountID, accessType, createdBy *string

		err := rows.Scan(
			&secret.ID,
			&secret.Name,
			&secret.Provider,
			&region,
			&accountID,
			&accessType,
			&createdBy,
			&secret.CreatedAt,
			&secret.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if region != nil {
			secret.Region = *region
		}
		if accountID != nil {
			secret.AccountID = *accountID
		}
		if accessType != nil {
			secret.AccessType = models.AccessType(*accessType)
		} else {
			secret.AccessType = models.AccessTypeWrite
		}
		if createdBy != nil {
			secret.CreatedBy = *createdBy
		}

		secrets = append(secrets, secret)
	}

	return secrets, rows.Err()
}

// FindByID retrieves a secret by ID (without credentials)
func (r *SecretRepository) FindByID(ctx context.Context, id string) (*models.Secret, error) {
	query := `
		SELECT id, name, provider, region, created_by, created_at, updated_at
		FROM secrets
		WHERE id = $1
	`

	var secret models.Secret
	var region, createdBy *string

	err := database.DB.QueryRow(ctx, query, id).Scan(
		&secret.ID,
		&secret.Name,
		&secret.Provider,
		&region,
		&createdBy,
		&secret.CreatedAt,
		&secret.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("secret not found: %w", err)
	}

	if region != nil {
		secret.Region = *region
	}
	if createdBy != nil {
		secret.CreatedBy = *createdBy
	}

	return &secret, nil
}

// GetCredentials retrieves and decrypts credentials for a secret
func (r *SecretRepository) GetCredentials(ctx context.Context, secretID string) (*models.AWSCredentials, error) {
	query := `
		SELECT credentials_encrypted
		FROM secrets
		WHERE id = $1
	`

	var encrypted string
	err := database.DB.QueryRow(ctx, query, secretID).Scan(&encrypted)
	if err != nil {
		return nil, fmt.Errorf("secret not found: %w", err)
	}

	// Decrypt credentials
	decrypted, err := crypto.Decrypt(encrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	// Unmarshal credentials
	var credentials models.AWSCredentials
	if err := json.Unmarshal([]byte(decrypted), &credentials); err != nil {
		return nil, fmt.Errorf("failed to unmarshal credentials: %w", err)
	}

	return &credentials, nil
}

// Delete removes a secret by ID
func (r *SecretRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM secrets WHERE id = $1`
	result, err := database.DB.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("secret not found")
	}

	return nil
}

// GetByIDWithCredentials retrieves a secret and its decrypted credentials
func (r *SecretRepository) GetByIDWithCredentials(ctx context.Context, id string) (*models.Secret, *models.AWSCredentials, error) {
	query := `
		SELECT id, name, provider, region, account_id, access_type, credentials_encrypted, created_by, created_at, updated_at
		FROM secrets
		WHERE id = $1
	`

	var secret models.Secret
	var region, accountID, accessType, createdBy *string
	var encrypted string

	err := database.DB.QueryRow(ctx, query, id).Scan(
		&secret.ID,
		&secret.Name,
		&secret.Provider,
		&region,
		&accountID,
		&accessType,
		&encrypted,
		&createdBy,
		&secret.CreatedAt,
		&secret.UpdatedAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("secret not found: %w", err)
	}

	if region != nil {
		secret.Region = *region
	}
	if accountID != nil {
		secret.AccountID = *accountID
	}
	if accessType != nil {
		secret.AccessType = models.AccessType(*accessType)
	} else {
		secret.AccessType = models.AccessTypeWrite
	}
	if createdBy != nil {
		secret.CreatedBy = *createdBy
	}

	// Decrypt credentials
	decrypted, err := crypto.Decrypt(encrypted)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	// Unmarshal credentials
	var credentials models.AWSCredentials
	if err := json.Unmarshal([]byte(decrypted), &credentials); err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal credentials: %w", err)
	}

	return &secret, &credentials, nil
}
