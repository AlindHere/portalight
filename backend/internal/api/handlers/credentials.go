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
)

type CredentialsHandler struct {
	secretRepo *repositories.SecretRepository
}

func NewCredentialsHandler() *CredentialsHandler {
	return &CredentialsHandler{
		secretRepo: &repositories.SecretRepository{},
	}
}

// CreateCredential handles POST /api/v1/credentials
// Superadmin only - creates a new AWS credential set
func (h *CredentialsHandler) CreateCredential(w http.ResponseWriter, r *http.Request) {
	// Check superadmin role
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" {
		http.Error(w, "Forbidden: superadmin access required", http.StatusForbidden)
		return
	}

	var req models.CreateSecretRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Name == "" || req.AccessKeyID == "" || req.SecretAccessKey == "" {
		http.Error(w, "Missing required fields: name, access_key_id, secret_access_key", http.StatusBadRequest)
		return
	}

	// Default provider to AWS
	if req.Provider == "" {
		req.Provider = "AWS"
	}

	// Default access type to write
	if req.AccessType == "" {
		req.AccessType = models.AccessTypeWrite
	}

	// Get current user
	userID := middleware.GetUserID(r.Context())

	secret := &models.Secret{
		Name:       req.Name,
		Provider:   req.Provider,
		Region:     req.Region,
		AccountID:  req.AccountID,
		AccessType: req.AccessType,
		CreatedBy:  userID,
	}

	credentials := &models.AWSCredentials{
		AccessKeyID:     req.AccessKeyID,
		SecretAccessKey: req.SecretAccessKey,
	}

	ctx := context.Background()
	if err := h.secretRepo.Create(ctx, secret, credentials); err != nil {
		log.Printf("Failed to create credential: %v", err)
		http.Error(w, "Failed to create credential", http.StatusInternalServerError)
		return
	}

	// Audit log
	auditLog := models.AuditLog{
		UserEmail:    middleware.GetUserEmail(r.Context()),
		Action:       "create_aws_credential",
		ResourceType: "credential",
		ResourceName: req.Name,
		Status:       "success",
		Details:      "AWS credential created (encrypted)",
	}
	CreateAuditLogEntry(auditLog)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(secret)
}

// ListCredentials handles GET /api/v1/credentials
// Returns all credentials (metadata only, never secrets)
func (h *CredentialsHandler) ListCredentials(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	secrets, err := h.secretRepo.GetAll(ctx)
	if err != nil {
		log.Printf("Failed to list credentials: %v", err)
		http.Error(w, "Failed to list credentials", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(secrets)
}

// DeleteCredential handles DELETE /api/v1/credentials/:id
// Superadmin only
func (h *CredentialsHandler) DeleteCredential(w http.ResponseWriter, r *http.Request) {
	// Check superadmin role
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" {
		http.Error(w, "Forbidden: superadmin access required", http.StatusForbidden)
		return
	}

	// Extract ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	var credentialID string
	for i, part := range pathParts {
		if part == "credentials" && i+1 < len(pathParts) {
			credentialID = pathParts[i+1]
			break
		}
	}

	if credentialID == "" {
		http.Error(w, "Credential ID required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	if err := h.secretRepo.Delete(ctx, credentialID); err != nil {
		log.Printf("Failed to delete credential: %v", err)
		http.Error(w, "Failed to delete credential", http.StatusInternalServerError)
		return
	}

	// Audit log
	auditLog := models.AuditLog{
		UserEmail:    middleware.GetUserEmail(r.Context()),
		Action:       "delete_aws_credential",
		ResourceType: "credential",
		ResourceName: credentialID,
		Status:       "success",
		Details:      "AWS credential deleted",
	}
	CreateAuditLogEntry(auditLog)

	w.WriteHeader(http.StatusNoContent)
}
