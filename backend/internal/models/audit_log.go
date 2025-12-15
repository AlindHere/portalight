package models

import "time"

// AuditLog represents an audit trail entry for user actions
type AuditLog struct {
	ID           string    `json:"id"`
	UserEmail    string    `json:"user_email"`
	UserName     string    `json:"user_name,omitempty"`
	Action       string    `json:"action"`        // e.g., "provision_resource", "register_project", "update_project", "delete_project"
	ResourceType string    `json:"resource_type"` // e.g., "S3", "SQS", "SNS", "project"
	ResourceID   string    `json:"resource_id,omitempty"`
	ResourceName string    `json:"resource_name,omitempty"`
	Details      string    `json:"details"` // JSON string with action details
	IPAddress    string    `json:"ip_address,omitempty"`
	Status       string    `json:"status"`    // "success" or "failure"
	Timestamp    time.Time `json:"timestamp"` // Changed from string to time.Time
	CreatedAt    time.Time `json:"created_at"`
}
