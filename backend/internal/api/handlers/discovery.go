package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/repositories"
	"github.com/portalight/backend/internal/services"
)

// DiscoveryHandler handles AWS resource discovery endpoints
type DiscoveryHandler struct {
	discovery              *services.AWSDiscovery
	secretRepo             *repositories.SecretRepository
	discoveredResourceRepo *repositories.DiscoveredResourceRepository
}

// NewDiscoveryHandler creates a new discovery handler
func NewDiscoveryHandler() *DiscoveryHandler {
	return &DiscoveryHandler{
		discovery:              services.NewAWSDiscovery(),
		secretRepo:             &repositories.SecretRepository{},
		discoveredResourceRepo: repositories.NewDiscoveredResourceRepository(),
	}
}

// DiscoverResourcesRequest is the request body for discovery
type DiscoverResourcesRequest struct {
	SecretID string   `json:"secret_id"`
	Region   string   `json:"region"`
	Types    []string `json:"types"` // Optional: specific types to discover (s3, sqs, sns, rds, lambda)
}

// DiscoverResources discovers AWS resources using the provided credentials
func (h *DiscoveryHandler) DiscoverResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check if user is authenticated
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can discover resources", http.StatusForbidden)
		return
	}

	var req DiscoverResourcesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SecretID == "" {
		http.Error(w, "secret_id is required", http.StatusBadRequest)
		return
	}

	// Get the secret credentials
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

	// Get existing discovered resources for this secret to filter duplicates
	existingResources, err := h.discoveredResourceRepo.GetBySecretID(r.Context(), req.SecretID)
	if err != nil {
		log.Printf("Failed to get existing resources: %v", err)
		// Continue even if we fail to get existing resources, just don't filter
	}

	log.Printf("DEBUG: DiscoverResources - SecretID: %s", req.SecretID)
	log.Printf("DEBUG: Found %d existing resources in DB for this secret", len(existingResources))

	existingARNs := make(map[string]bool)
	for _, res := range existingResources {
		existingARNs[res.ARN] = true
		log.Printf("DEBUG: Existing ARN in DB: %s", res.ARN)
	}

	// Discover resources based on requested types
	var allResources []services.DiscoveredResource

	typesToDiscover := req.Types
	if len(typesToDiscover) == 0 {
		// Default to all types
		typesToDiscover = []string{"s3", "sqs", "sns", "rds", "lambda"}
	}

	for _, resourceType := range typesToDiscover {
		var resources []services.DiscoveredResource
		var discoverErr error

		switch strings.ToLower(resourceType) {
		case "s3":
			resources, discoverErr = h.discovery.DiscoverS3(r.Context(), credentials, region)
		case "sqs":
			resources, discoverErr = h.discovery.DiscoverSQS(r.Context(), credentials, region)
		case "sns":
			resources, discoverErr = h.discovery.DiscoverSNS(r.Context(), credentials, region)
		case "rds":
			resources, discoverErr = h.discovery.DiscoverRDS(r.Context(), credentials, region)
		case "lambda":
			resources, discoverErr = h.discovery.DiscoverLambda(r.Context(), credentials, region)
		}

		if discoverErr != nil {
			log.Printf("Failed to discover %s resources: %v", resourceType, discoverErr)
			// Continue with other types even if one fails
		} else {
			// Filter out existing resources
			for _, res := range resources {
				if !existingARNs[res.ARN] {
					allResources = append(allResources, res)
				} else {
					log.Printf("DEBUG: Filtering out existing resource: %s", res.ARN)
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"resources": allResources,
		"region":    region,
		"count":     len(allResources),
	})
}
