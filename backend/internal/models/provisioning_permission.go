package models

import "time"

// ProvisioningPermission represents a dev user's permission to provision a specific resource type
type ProvisioningPermission struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	ResourceType string    `json:"resource_type"` // s3, sqs, sns
	GrantedBy    string    `json:"granted_by"`
	GrantedAt    time.Time `json:"granted_at"`
}

// UserProvisioningPermissions represents all provisioning permissions for a user
type UserProvisioningPermissions struct {
	UserID       string   `json:"user_id"`
	AllowedTypes []string `json:"allowed_types"` // ["s3", "sqs", "sns"]
	S3Enabled    bool     `json:"s3_enabled"`
	SQSEnabled   bool     `json:"sqs_enabled"`
	SNSEnabled   bool     `json:"sns_enabled"`
}

// UpdateProvisioningPermissionsRequest is the request to update a user's provisioning permissions
type UpdateProvisioningPermissionsRequest struct {
	S3Enabled  bool `json:"s3_enabled"`
	SQSEnabled bool `json:"sqs_enabled"`
	SNSEnabled bool `json:"sns_enabled"`
}
