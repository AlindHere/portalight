package models

import (
	"encoding/json"
	"time"
)

// Service represents a service in the catalog
type Service struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Team          string   `json:"team"`
	TeamName      string   `json:"team_name,omitempty"`
	ProjectID     string   `json:"project_id,omitempty"`
	Description   string   `json:"description"`
	Environment   string   `json:"environment"`
	Language      string   `json:"language"`
	Tags          []string `json:"tags"`
	Repository    string   `json:"repository"`
	Owner         string   `json:"owner"`
	GrafanaURL    string   `json:"grafana_url,omitempty"`
	ConfluenceURL string   `json:"confluence_url,omitempty"`

	// ArgoCD Integration
	ArgoCDAppName string `json:"argocd_app_name,omitempty"`
	ArgoCDURL     string `json:"argocd_url,omitempty"`

	// Loki Integration
	LokiURL    string          `json:"loki_url,omitempty"`
	LokiLabels json.RawMessage `json:"loki_labels,omitempty"`

	// GitHub Integration Fields
	CatalogSource   string `json:"catalog_source,omitempty"`
	AutoSynced      bool   `json:"auto_synced"`
	CatalogMetadata any    `json:"catalog_metadata,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Joined data (not in DB)
	Links           []ServiceLink            `json:"links,omitempty"`
	MappedResources []ServiceResourceMapping `json:"mapped_resources,omitempty"`
}

// ServiceLink represents a custom link for a service (Sentry, PagerDuty, etc.)
type ServiceLink struct {
	ID        string    `json:"id"`
	ServiceID string    `json:"service_id"`
	Label     string    `json:"label"`
	URL       string    `json:"url"`
	Icon      string    `json:"icon,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ServiceResourceMapping represents a mapping between a service and an AWS resource
type ServiceResourceMapping struct {
	ID                   string    `json:"id"`
	ServiceID            string    `json:"service_id"`
	DiscoveredResourceID string    `json:"discovered_resource_id"`
	CreatedAt            time.Time `json:"created_at"`

	// Joined data
	ResourceName string `json:"resource_name,omitempty"`
	ResourceType string `json:"resource_type,omitempty"`
	ResourceARN  string `json:"resource_arn,omitempty"`
	Region       string `json:"region,omitempty"`
}

// ProvisionRequest represents a resource provisioning request
type ProvisionRequest struct {
	SecretID     string                 `json:"secret_id"`
	ResourceType string                 `json:"resource_type"`
	Parameters   map[string]interface{} `json:"parameters"`
}
