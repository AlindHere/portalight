package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/portalight/backend/internal/models"
)

type SecretHandler struct{}

func NewSecretHandler() *SecretHandler {
	return &SecretHandler{}
}

// GetSecrets returns available cloud provider credentials
func (h *SecretHandler) GetSecrets(w http.ResponseWriter, r *http.Request) {
	// Mock data - in production, fetch from secret store
	secrets := []models.Secret{
		{
			ID:         "aws-prod-east",
			Name:       "AWS Production (us-east-1)",
			Provider:   "AWS",
			Region:     "us-east-1",
			AWSAccount: "Production",
		},
		{
			ID:         "aws-dev-west",
			Name:       "AWS Development (us-west-2)",
			Provider:   "AWS",
			Region:     "us-west-2",
			AWSAccount: "Development",
		},
		{
			ID:       "azure-prod-central",
			Name:     "Azure Production (Central US)",
			Provider: "Azure",
			Region:   "centralus",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(secrets)
}
