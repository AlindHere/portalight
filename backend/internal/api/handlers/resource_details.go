package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
	"github.com/portalight/backend/internal/services"
)

// ResourceDetailsHandler handles resource details and metrics endpoints
type ResourceDetailsHandler struct {
	metrics      *services.AWSMetrics
	secretRepo   *repositories.SecretRepository
	resourceRepo *repositories.DiscoveredResourceRepository
}

// NewResourceDetailsHandler creates a new resource details handler
func NewResourceDetailsHandler() *ResourceDetailsHandler {
	return &ResourceDetailsHandler{
		metrics:      services.NewAWSMetrics(),
		secretRepo:   &repositories.SecretRepository{},
		resourceRepo: repositories.NewDiscoveredResourceRepository(),
	}
}

// GetResourceByID returns a single discovered resource by ID or name
func (h *ResourceDetailsHandler) GetResourceByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify authentication
	userRole := middleware.GetUserRole(ctx)
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract identifier from URL: /api/v1/resources/discovered/{id}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/resources/discovered/")
	identifier := strings.Split(path, "/")[0]

	if identifier == "" {
		http.Error(w, "Resource identifier required", http.StatusBadRequest)
		return
	}

	// Determine if it's a UUID or a name
	var resource *models.DiscoveredResource
	var err error

	// Simple UUID check: 36 characters with hyphens in right places
	if len(identifier) == 36 && strings.Count(identifier, "-") == 4 {
		resource, err = h.resourceRepo.FindByID(ctx, identifier)
	} else {
		resource, err = h.resourceRepo.FindByName(ctx, identifier)
	}

	if err != nil {
		http.Error(w, "Resource not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resource)
}

// GetResourceMetricsRequest is the request body for fetching metrics
type GetResourceMetricsRequest struct {
	SecretID     string `json:"secret_id"`
	ResourceType string `json:"resource_type"` // rds, lambda, s3, sqs
	ResourceName string `json:"resource_name"`
	Region       string `json:"region"`
	Period       string `json:"period"` // 1h, 6h, 24h, 7d
}

// GetResourceMetrics fetches CloudWatch metrics for a resource
func (h *ResourceDetailsHandler) GetResourceMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Verify authentication
	userRole := middleware.GetUserRole(r.Context())
	if userRole == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req GetResourceMetricsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SecretID == "" || req.ResourceType == "" || req.ResourceName == "" {
		http.Error(w, "secret_id, resource_type, and resource_name are required", http.StatusBadRequest)
		return
	}

	// Get credentials
	secret, credentials, err := h.secretRepo.GetByIDWithCredentials(r.Context(), req.SecretID)
	if err != nil {
		log.Printf("Failed to get secret: %v", err)
		http.Error(w, "Failed to get credentials", http.StatusInternalServerError)
		return
	}

	region := req.Region
	if region == "" {
		region = secret.Region
	}
	if region == "" {
		region = "ap-south-1"
	}

	period := req.Period
	if period == "" {
		period = "24h"
	}

	var metrics *services.ResourceMetrics

	switch strings.ToLower(req.ResourceType) {
	case "rds":
		metrics, err = h.metrics.GetRDSMetrics(r.Context(), credentials, region, req.ResourceName, period)
	case "lambda":
		metrics, err = h.metrics.GetLambdaMetrics(r.Context(), credentials, region, req.ResourceName, period)
	case "s3":
		metrics, err = h.metrics.GetS3Metrics(r.Context(), credentials, region, req.ResourceName, period)
	case "sqs":
		metrics, err = h.metrics.GetSQSMetrics(r.Context(), credentials, region, req.ResourceName, period)
	case "sns":
		metrics, err = h.metrics.GetSNSMetrics(r.Context(), credentials, region, req.ResourceName, period)
	default:
		http.Error(w, "Unsupported resource type. Supported: rds, lambda, s3, sqs, sns", http.StatusBadRequest)
		return
	}

	if err != nil {
		log.Printf("Failed to fetch metrics: %v", err)
		http.Error(w, "Failed to fetch metrics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}
