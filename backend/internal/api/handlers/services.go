package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/portalight/backend/internal/models"
)

type ServiceHandler struct {
	// In a real implementation, this would use a repository/database
}

func NewServiceHandler() *ServiceHandler {
	return &ServiceHandler{}
}

// GetServices returns all services
func (h *ServiceHandler) GetServices(w http.ResponseWriter, r *http.Request) {
	// Mock data for demonstration - would come from metadata repo
	services := []models.Service{
		{
			ID:            "payments-service-go",
			Name:          "payments-service-go",
			Team:          "Team Fintech",
			Description:   "Core payment processing microservice handling Stripe and PayPal webhooks.",
			Environment:   "Production",
			Language:      "Go",
			Tags:          []string{"go", "payments", "critical"},
			Repository:    "https://github.com/company/payments-service",
			Owner:         "fintech-team",
			GrafanaURL:    "https://grafana.company.com/d/payments",
			ConfluenceURL: "https://confluence.company.com/payments",
			CreatedAt:     time.Now().AddDate(0, -6, 0),
			UpdatedAt:     time.Now(),
		},
		{
			ID:            "customer-dashboard-ui",
			Name:          "customer-dashboard-ui",
			Team:          "Team UX",
			Description:   "React-based dashboard for customers to view orders and manage subscriptions.",
			Environment:   "Production",
			Language:      "React",
			Tags:          []string{"react", "frontend", "dashboard"},
			Repository:    "https://github.com/company/customer-dashboard",
			Owner:         "ux-team",
			GrafanaURL:    "https://grafana.company.com/d/customer-dash",
			ConfluenceURL: "https://confluence.company.com/customer-ui",
			CreatedAt:     time.Now().AddDate(0, -3, 0),
			UpdatedAt:     time.Now(),
		},
		{
			ID:            "analytics-aggregator",
			Name:          "analytics-aggregator",
			Team:          "Team Data Eng",
			Description:   "Spark jobs for aggregating daily user activity logs.",
			Environment:   "Experimental",
			Language:      "Python",
			Tags:          []string{"data", "spark", "python"},
			Repository:    "https://github.com/company/analytics-aggregator",
			Owner:         "data-team",
			GrafanaURL:    "https://grafana.company.com/d/analytics",
			ConfluenceURL: "https://confluence.company.com/analytics",
			CreatedAt:     time.Now().AddDate(0, -1, 0),
			UpdatedAt:     time.Now(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

// GetServiceByID returns a specific service
func (h *ServiceHandler) GetServiceByID(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path
	// Implementation would fetch from repository
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// CreateService registers a new service
func (h *ServiceHandler) CreateService(w http.ResponseWriter, r *http.Request) {
	var service models.Service
	if err := json.NewDecoder(r.Body).Decode(&service); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Set timestamps
	service.CreatedAt = time.Now()
	service.UpdatedAt = time.Now()

	// In real implementation, save to metadata repository
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(service)
}
