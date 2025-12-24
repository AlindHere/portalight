package models

import (
	"encoding/json"
	"time"
)

// DiscoveredResourceStatus represents the sync status of a discovered resource
type DiscoveredResourceStatus string

const (
	ResourceStatusActive  DiscoveredResourceStatus = "active"
	ResourceStatusDeleted DiscoveredResourceStatus = "deleted"
	ResourceStatusUnknown DiscoveredResourceStatus = "unknown"
)

// DiscoveredResource represents an AWS resource discovered and tracked
type DiscoveredResource struct {
	ID           string                   `json:"id"`
	ProjectID    string                   `json:"project_id"`
	SecretID     string                   `json:"secret_id,omitempty"`
	ARN          string                   `json:"arn"`
	ResourceType string                   `json:"resource_type"` // s3, sqs, sns, rds, lambda
	Name         string                   `json:"name"`
	Region       string                   `json:"region"`
	Status       DiscoveredResourceStatus `json:"status"`
	Metadata     json.RawMessage          `json:"metadata"`
	LastSyncedAt *time.Time               `json:"last_synced_at,omitempty"`
	DiscoveredAt time.Time                `json:"discovered_at"`
	CreatedAt    time.Time                `json:"created_at"`
	UpdatedAt    time.Time                `json:"updated_at"`
}

// AssociateResourcesRequest is the request to associate discovered resources with a project
type AssociateResourcesRequest struct {
	ProjectID string   `json:"project_id"`
	SecretID  string   `json:"secret_id"`
	ARNs      []string `json:"arns"`
	Resources []struct {
		ARN          string          `json:"arn"`
		ResourceType string          `json:"resource_type"`
		Name         string          `json:"name"`
		Region       string          `json:"region"`
		Metadata     json.RawMessage `json:"metadata"`
	} `json:"resources"`
}
