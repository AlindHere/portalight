package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/portalight/backend/internal/repositories"
)

type SecretHandler struct{}

func NewSecretHandler() *SecretHandler {
	return &SecretHandler{}
}

// GetSecrets returns available cloud provider credentials from the database
func (h *SecretHandler) GetSecrets(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	secretRepo := &repositories.SecretRepository{}

	secrets, err := secretRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, "Failed to fetch secrets", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(secrets)
}
