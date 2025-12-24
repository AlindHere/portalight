package models

import "time"

// AccessType defines credential access level
type AccessType string

const (
	AccessTypeWrite AccessType = "write" // Can provision and discover resources
	AccessTypeRead  AccessType = "read"  // Can only discover existing resources
)

// Secret represents cloud provider credentials
type Secret struct {
	ID                   string     `json:"id"`
	Name                 string     `json:"name"`
	Provider             string     `json:"provider"` // AWS, Azure, GCP
	Region               string     `json:"region"`
	AccountID            string     `json:"account_id,omitempty"` // AWS Account ID
	AccessType           AccessType `json:"access_type"`          // read or write
	CredentialsEncrypted string     `json:"-"`                    // Never expose in JSON
	CreatedBy            string     `json:"created_by"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// AWSCredentials represents decrypted AWS access credentials
type AWSCredentials struct {
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
}

// CreateSecretRequest is used when creating a new secret
type CreateSecretRequest struct {
	Name            string     `json:"name"`
	Provider        string     `json:"provider"`
	Region          string     `json:"region"`
	AccountID       string     `json:"account_id"`
	AccessType      AccessType `json:"access_type"` // read or write
	AccessKeyID     string     `json:"access_key_id"`
	SecretAccessKey string     `json:"secret_access_key"`
}
