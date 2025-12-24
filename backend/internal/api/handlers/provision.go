package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
	"github.com/portalight/backend/internal/services"
)

type ProvisionHandler struct {
	resourceRepo           *repositories.ResourceRepository
	secretRepo             *repositories.SecretRepository
	permissionRepo         *repositories.ProvisioningPermissionRepository
	discoveredResourceRepo *repositories.DiscoveredResourceRepository
	provisioner            *services.AWSProvisioner
}

func NewProvisionHandler(resourceRepo *repositories.ResourceRepository) *ProvisionHandler {
	return &ProvisionHandler{
		resourceRepo:           resourceRepo,
		secretRepo:             &repositories.SecretRepository{},
		permissionRepo:         &repositories.ProvisioningPermissionRepository{},
		discoveredResourceRepo: repositories.NewDiscoveredResourceRepository(),
		provisioner:            services.NewAWSProvisioner(),
	}
}

// ProvisionResource handles resource provisioning requests
// Lead and superadmin can provision any resource
// Dev users can only provision resources they have been granted access to
func (h *ProvisionHandler) ProvisionResource(w http.ResponseWriter, r *http.Request) {
	var req models.CreateResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate request
	if req.ProjectID == "" || req.Name == "" || req.Type == "" || req.SecretID == "" {
		http.Error(w, "Missing required fields: project_id, name, type, secret_id", http.StatusBadRequest)
		return
	}

	// Validate resource type
	if req.Type != "s3" && req.Type != "sqs" && req.Type != "sns" {
		http.Error(w, "Invalid resource type. Supported types: s3, sqs, sns", http.StatusBadRequest)
		return
	}

	// Check role and permissions
	userRole := middleware.GetUserRole(r.Context())
	userID := middleware.GetUserID(r.Context())

	if userRole == "dev" {
		// Dev users need explicit permission for the resource type
		canProvision, err := h.permissionRepo.CanUserProvision(r.Context(), userID, req.Type)
		if err != nil {
			log.Printf("Failed to check provisioning permissions: %v", err)
			http.Error(w, "Failed to check permissions", http.StatusInternalServerError)
			return
		}
		if !canProvision {
			http.Error(w, "Forbidden: You don't have permission to provision "+req.Type+" resources", http.StatusForbidden)
			return
		}
	}

	// Create resource in DB with "provisioning" status
	resource := &models.Resource{
		ProjectID: req.ProjectID,
		Name:      req.Name,
		Type:      req.Type,
		Status:    "provisioning",
		Config:    req.Config,
	}

	if err := h.resourceRepo.Create(r.Context(), resource); err != nil {
		log.Printf("Failed to create resource: %v", err)
		http.Error(w, "Failed to create resource", http.StatusInternalServerError)
		return
	}

	// Get AWS credentials
	credentials, err := h.secretRepo.GetCredentials(r.Context(), req.SecretID)
	if err != nil {
		log.Printf("Failed to get credentials: %v", err)
		h.resourceRepo.UpdateStatusWithError(r.Context(), resource.ID, "failed", "Failed to retrieve AWS credentials")
		http.Error(w, "Failed to retrieve AWS credentials", http.StatusInternalServerError)
		return
	}

	// Provision asynchronously
	userEmail := middleware.GetUserEmail(r.Context())
	go h.provisionAsync(resource.ID, req, credentials, userEmail)

	// Audit Log - initial request
	auditLog := models.AuditLog{
		UserEmail:    userEmail,
		Action:       "provision_resource",
		ResourceType: req.Type,
		ResourceName: req.Name,
		Status:       "pending",
		Details:      string(req.Config),
	}
	CreateAuditLogEntry(auditLog)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(resource)
}

// provisionAsync handles the actual AWS provisioning in the background
func (h *ProvisionHandler) provisionAsync(resourceID string, req models.CreateResourceRequest, creds *models.AWSCredentials, userEmail string) {
	ctx := context.Background()
	var result *models.ProvisionResult
	var err error

	switch req.Type {
	case "s3":
		var config models.S3Config
		if err := json.Unmarshal(req.Config, &config); err != nil {
			log.Printf("Failed to parse S3 config: %v", err)
			h.resourceRepo.UpdateStatusWithError(ctx, resourceID, "failed", "Invalid S3 configuration")
			h.createProvisioningAuditLog(userEmail, req.Type, req.Name, "failed", "Invalid S3 configuration")
			return
		}
		result, err = h.provisioner.ProvisionS3(ctx, req.Name, config, creds)

	case "sqs":
		var config models.SQSConfig
		if err := json.Unmarshal(req.Config, &config); err != nil {
			log.Printf("Failed to parse SQS config: %v", err)
			h.resourceRepo.UpdateStatusWithError(ctx, resourceID, "failed", "Invalid SQS configuration")
			h.createProvisioningAuditLog(userEmail, req.Type, req.Name, "failed", "Invalid SQS configuration")
			return
		}
		result, err = h.provisioner.ProvisionSQS(ctx, req.Name, config, creds)

	case "sns":
		var config models.SNSConfig
		if err := json.Unmarshal(req.Config, &config); err != nil {
			log.Printf("Failed to parse SNS config: %v", err)
			h.resourceRepo.UpdateStatusWithError(ctx, resourceID, "failed", "Invalid SNS configuration")
			h.createProvisioningAuditLog(userEmail, req.Type, req.Name, "failed", "Invalid SNS configuration")
			return
		}
		result, err = h.provisioner.ProvisionSNS(ctx, req.Name, config, creds)
	}

	if err != nil {
		log.Printf("Provisioning error: %v", err)
		h.resourceRepo.UpdateStatusWithError(ctx, resourceID, "failed", err.Error())
		h.createProvisioningAuditLog(userEmail, req.Type, req.Name, "failed", err.Error())
		return
	}

	if result != nil && !result.Success {
		log.Printf("Provisioning failed: %s", result.Error)
		h.resourceRepo.UpdateStatusWithError(ctx, resourceID, "failed", result.Error)
		h.createProvisioningAuditLog(userEmail, req.Type, req.Name, "failed", result.Error)
		return
	}

	// Update status to active with ARN
	if err := h.resourceRepo.UpdateStatusWithARN(ctx, resourceID, "active", result.ARN); err != nil {
		log.Printf("Failed to update resource status: %v", err)
	} else {
		log.Printf("Resource %s provisioned successfully! ARN: %s", resourceID, result.ARN)
		h.createProvisioningAuditLog(userEmail, req.Type, req.Name, "success", "ARN: "+result.ARN)

		// Auto-add provisioned resource to discovered_resources so it appears in Cloud Resources
		discoveredResource := &models.DiscoveredResource{
			ProjectID:    req.ProjectID,
			SecretID:     req.SecretID,
			ARN:          result.ARN,
			ResourceType: req.Type,
			Name:         req.Name,
			Region:       result.Region,
			Status:       models.ResourceStatusActive,
			Metadata:     req.Config,
		}
		if err := h.discoveredResourceRepo.Create(ctx, discoveredResource); err != nil {
			log.Printf("Failed to add provisioned resource to discovered_resources: %v", err)
		} else {
			log.Printf("Provisioned resource %s auto-added to discovered_resources", req.Name)
		}
	}
}

// createProvisioningAuditLog creates an audit log entry for provisioning result
func (h *ProvisionHandler) createProvisioningAuditLog(userEmail, resourceType, resourceName, status, details string) {
	auditLog := models.AuditLog{
		UserEmail:    userEmail,
		Action:       "provision_resource_complete",
		ResourceType: resourceType,
		ResourceName: resourceName,
		Status:       status,
		Details:      details,
	}
	CreateAuditLogEntry(auditLog)
}

// GetProjectResources returns all resources for a project
func (h *ProvisionHandler) GetProjectResources(w http.ResponseWriter, r *http.Request) {
	// Extract project ID from URL path: /api/v1/projects/{id}/resources
	pathParts := strings.Split(r.URL.Path, "/")
	var projectID string
	for i, part := range pathParts {
		if part == "projects" && i+1 < len(pathParts) {
			projectID = pathParts[i+1]
			break
		}
	}

	if projectID == "" {
		http.Error(w, "Project ID required", http.StatusBadRequest)
		return
	}

	resources, err := h.resourceRepo.FindByProjectID(r.Context(), projectID)
	if err != nil {
		log.Printf("Failed to get resources: %v", err)
		http.Error(w, "Failed to get resources", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resources)
}
