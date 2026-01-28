package models

import "time"

// ServiceArgoCDApp represents a mapping between a service and an ArgoCD application
type ServiceArgoCDApp struct {
	ID              string    `json:"id"`
	ServiceID       string    `json:"service_id"`
	ArgoCDAppName   string    `json:"argocd_app_name"`
	EnvironmentName string    `json:"environment_name"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ArgoCDApplication represents an ArgoCD application from the ArgoCD API
type ArgoCDApplication struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Project    string `json:"project"`
	Health     string `json:"health"`      // Healthy, Degraded, Progressing, Unknown
	SyncStatus string `json:"sync_status"` // Synced, OutOfSync, Unknown
	Revision   string `json:"revision"`    // Git commit SHA or tag (current deployed version)
	CreatedAt  string `json:"created_at,omitempty"`
}

// ArgoCDPod represents a pod from an ArgoCD application
type ArgoCDPod struct {
	Name       string   `json:"name"`
	Namespace  string   `json:"namespace"`
	Status     string   `json:"status"` // Running, Pending, Failed, Succeeded
	Ready      string   `json:"ready"`  // e.g., "1/1"
	Restarts   int      `json:"restarts"`
	Age        string   `json:"age"`
	Containers []string `json:"containers"`
}

// ArgoCDAppStatus represents the full status of an ArgoCD application
type ArgoCDAppStatus struct {
	Application ArgoCDApplication `json:"application"`
	Pods        []ArgoCDPod       `json:"pods"`
}
