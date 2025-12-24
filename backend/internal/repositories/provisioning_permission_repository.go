package repositories

import (
	"context"

	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// ProvisioningPermissionRepository handles provisioning permission database operations
type ProvisioningPermissionRepository struct{}

// GetUserPermissions retrieves all provisioning permissions for a user
func (r *ProvisioningPermissionRepository) GetUserPermissions(ctx context.Context, userID string) (*models.UserProvisioningPermissions, error) {
	query := `
		SELECT resource_type
		FROM user_provisioning_permissions
		WHERE user_id = $1
	`

	rows, err := database.DB.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permissions := &models.UserProvisioningPermissions{
		UserID:       userID,
		AllowedTypes: []string{},
	}

	for rows.Next() {
		var resourceType string
		if err := rows.Scan(&resourceType); err != nil {
			return nil, err
		}

		permissions.AllowedTypes = append(permissions.AllowedTypes, resourceType)

		switch resourceType {
		case "s3":
			permissions.S3Enabled = true
		case "sqs":
			permissions.SQSEnabled = true
		case "sns":
			permissions.SNSEnabled = true
		}
	}

	return permissions, rows.Err()
}

// SetUserPermissions updates a user's provisioning permissions
func (r *ProvisioningPermissionRepository) SetUserPermissions(ctx context.Context, userID string, req *models.UpdateProvisioningPermissionsRequest, grantedBy string) error {
	// Start a transaction
	tx, err := database.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete existing permissions for this user
	deleteQuery := `DELETE FROM user_provisioning_permissions WHERE user_id = $1`
	_, err = tx.Exec(ctx, deleteQuery, userID)
	if err != nil {
		return err
	}

	// Insert new permissions
	insertQuery := `
		INSERT INTO user_provisioning_permissions (user_id, resource_type, granted_by)
		VALUES ($1, $2, $3)
	`

	if req.S3Enabled {
		_, err = tx.Exec(ctx, insertQuery, userID, "s3", grantedBy)
		if err != nil {
			return err
		}
	}

	if req.SQSEnabled {
		_, err = tx.Exec(ctx, insertQuery, userID, "sqs", grantedBy)
		if err != nil {
			return err
		}
	}

	if req.SNSEnabled {
		_, err = tx.Exec(ctx, insertQuery, userID, "sns", grantedBy)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// CanUserProvision checks if a user can provision a specific resource type
func (r *ProvisioningPermissionRepository) CanUserProvision(ctx context.Context, userID string, resourceType string) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM user_provisioning_permissions
			WHERE user_id = $1 AND resource_type = $2
		)
	`

	var exists bool
	err := database.DB.QueryRow(ctx, query, userID, resourceType).Scan(&exists)
	if err != nil {
		return false, err
	}

	return exists, nil
}
