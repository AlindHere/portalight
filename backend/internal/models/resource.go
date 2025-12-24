package models

import (
	"encoding/json"
	"time"
)

type Resource struct {
	ID        string          `json:"id"`
	ProjectID string          `json:"project_id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`
	Status    string          `json:"status"`
	Config    json.RawMessage `json:"config"`
	ARN       string          `json:"arn,omitempty"`
	ErrorMsg  string          `json:"error_message,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type CreateResourceRequest struct {
	ProjectID string          `json:"project_id"`
	SecretID  string          `json:"secret_id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`
	Config    json.RawMessage `json:"config"`
}

// S3Config represents S3 bucket configuration
type S3Config struct {
	Region              string `json:"region"`
	Versioning          bool   `json:"versioning"`
	PublicAccessBlocked bool   `json:"public_access_blocked"`
	Encryption          string `json:"encryption"` // "AES256" or "aws:kms"
}

// SQSConfig represents SQS queue configuration
type SQSConfig struct {
	Region               string `json:"region"`
	QueueType            string `json:"queue_type"` // "standard" or "fifo"
	VisibilityTimeout    int    `json:"visibility_timeout"`
	MessageRetentionDays int    `json:"message_retention_days"`
	DelaySeconds         int    `json:"delay_seconds"`
}

// SNSConfig represents SNS topic configuration
type SNSConfig struct {
	Region    string `json:"region"`
	TopicType string `json:"topic_type"` // "standard" or "fifo"
}

// ProvisionResult contains the result of a provisioning operation
type ProvisionResult struct {
	Success bool   `json:"success"`
	ARN     string `json:"arn,omitempty"`
	Region  string `json:"region,omitempty"`
	Error   string `json:"error,omitempty"`
}
