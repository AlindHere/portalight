package models

import "time"

type SyncHistory struct {
	ID               string      `json:"id"`
	SyncType         string      `json:"sync_type"`
	ProjectID        string      `json:"project_id,omitempty"`
	ProjectName      string      `json:"project_name,omitempty"`
	CatalogFilePath  string      `json:"catalog_file_path,omitempty"`
	Status           string      `json:"status"`
	ProjectsCreated  int         `json:"projects_created"`
	ProjectsUpdated  int         `json:"projects_updated"`
	ServicesCreated  int         `json:"services_created"`
	ServicesUpdated  int         `json:"services_updated"`
	ServicesOrphaned int         `json:"services_orphaned"`
	ErrorMessage     string      `json:"error_message,omitempty"`
	ValidationErrors interface{} `json:"validation_errors,omitempty"` // JSONB
	StartedAt        time.Time   `json:"started_at"`
	CompletedAt      *time.Time  `json:"completed_at,omitempty"`
	DurationMs       int64       `json:"duration_ms"`
	SyncedBy         string      `json:"synced_by,omitempty"`
	SyncedByName     string      `json:"synced_by_name,omitempty"`
}
