package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/portalight/backend/internal/repositories"
)

// GetServices returns all services from the database
func GetServices(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	serviceRepo := &repositories.ServiceRepository{}

	services, err := serviceRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch services: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}
