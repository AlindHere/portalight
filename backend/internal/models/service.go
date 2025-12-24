package models

import "time"

// Service represents a service in the catalog
type Service struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Team          string   `json:"team"`
	ProjectID     string   `json:"project_id,omitempty"` // Added
	Description   string   `json:"description"`
	Environment   string   `json:"environment"` // Production, Staging, Experimental
	Language      string   `json:"language"`    // Go, React, Python, etc.
	Tags          []string `json:"tags"`
	Repository    string   `json:"repository"`
	Owner         string   `json:"owner"`
	GrafanaURL    string   `json:"grafana_url,omitempty"`
	ConfluenceURL string   `json:"confluence_url,omitempty"`

	// GitHub Integration Fields
	CatalogSource   string `json:"catalog_source,omitempty"`
	AutoSynced      bool   `json:"auto_synced"`
	CatalogMetadata any    `json:"catalog_metadata,omitempty"` // JSONB

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvisionRequest represents a resource provisioning request
type ProvisionRequest struct {
	SecretID     string                 `json:"secret_id"`
	ResourceType string                 `json:"resource_type"` // EC2, S3, VM, etc.
	Parameters   map[string]interface{} `json:"parameters"`
}
