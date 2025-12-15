package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/portalight/backend/internal/database"
	"github.com/portalight/backend/internal/models"
)

// AuditLogRepository handles audit log database operations
type AuditLogRepository struct{}

// GetAll retrieves all audit logs, optionally filtered by user email
func (r *AuditLogRepository) GetAll(ctx context.Context, userEmail string) ([]models.AuditLog, error) {
	var query string
	var args []interface{}

	if userEmail != "" {
		query = `
			SELECT id, user_email, user_name, action, resource_type, resource_id, resource_name, details, status, timestamp, created_at
			FROM audit_logs
			WHERE user_email = $1
			ORDER BY timestamp DESC
		`
		args = append(args, userEmail)
	} else {
		query = `
			SELECT id, user_email, user_name, action, resource_type, resource_id, resource_name, details, status, timestamp, created_at
			FROM audit_logs
			ORDER BY timestamp DESC
		`
	}

	rows, err := database.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var log models.AuditLog
		var resourceType, resourceID, resourceName, details *string

		err := rows.Scan(
			&log.ID,
			&log.UserEmail,
			&log.UserName,
			&log.Action,
			&resourceType,
			&resourceID,
			&resourceName,
			&details,
			&log.Status,
			&log.Timestamp,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if resourceType != nil {
			log.ResourceType = *resourceType
		}
		if resourceID != nil {
			log.ResourceID = *resourceID
		}
		if resourceName != nil {
			log.ResourceName = *resourceName
		}
		if details != nil {
			log.Details = *details
		}

		logs = append(logs, log)
	}

	return logs, rows.Err()
}

// Create creates a new audit log entry
func (r *AuditLogRepository) Create(ctx context.Context, log *models.AuditLog) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.Timestamp.IsZero() {
		log.Timestamp = time.Now()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO audit_logs (id, user_email, user_name, action, resource_type, resource_id, resource_name, details, status, timestamp, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	var resourceType, resourceID, resourceName, details *string
	if log.ResourceType != "" {
		resourceType = &log.ResourceType
	}
	if log.ResourceID != "" {
		resourceID = &log.ResourceID
	}
	if log.ResourceName != "" {
		resourceName = &log.ResourceName
	}
	if log.Details != "" {
		details = &log.Details
	}

	_, err := database.DB.Exec(ctx, query,
		log.ID,
		log.UserEmail,
		log.UserName,
		log.Action,
		resourceType,
		resourceID,
		resourceName,
		details,
		log.Status,
		log.Timestamp,
		log.CreatedAt,
	)

	return err
}

// Count returns the total number of audit logs
func (r *AuditLogRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := database.DB.QueryRow(ctx, "SELECT COUNT(*) FROM audit_logs").Scan(&count)
	return count, err
}
