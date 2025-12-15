package models

import "time"

// Secret represents cloud provider credentials
type Secret struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Provider  string    `json:"provider"` // AWS, Azure, GCP
	Region    string    `json:"region"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
