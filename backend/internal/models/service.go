package models

import "time"

// Service represents a service in the catalog
type Service struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Team          string    `json:"team"`
	Description   string    `json:"description"`
	Environment   string    `json:"environment"` // Production, Staging, Experimental
	Language      string    `json:"language"`    // Go, React, Python, etc.
	Tags          []string  `json:"tags"`
	Repository    string    `json:"repository"`
	Owner         string    `json:"owner"`
	GrafanaURL    string    `json:"grafana_url,omitempty"`
	ConfluenceURL string    `json:"confluence_url,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ProvisionRequest represents a resource provisioning request
type ProvisionRequest struct {
	SecretID     string                 `json:"secret_id"`
	ResourceType string                 `json:"resource_type"` // EC2, S3, VM, etc.
	Parameters   map[string]interface{} `json:"parameters"`
}
