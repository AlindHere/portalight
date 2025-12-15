package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// GetAuditLogs returns audit logs from the database
func GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	auditRepo := &repositories.AuditLogRepository{}

	// Get optional user_email filter from query params
	userEmail := r.URL.Query().Get("user_email")

	logs, err := auditRepo.GetAll(ctx, userEmail)
	if err != nil {
		http.Error(w, "Failed to fetch audit logs", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// CreateAuditLog creates a new audit log entry in the database
func CreateAuditLog(w http.ResponseWriter, r *http.Request) {
	var log models.AuditLog
	if err := json.NewDecoder(r.Body).Decode(&log); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get user email from JWT context
	userEmail := middleware.GetUserEmail(r.Context())
	if userEmail != "" {
		log.UserEmail = userEmail
	}

	ctx := context.Background()
	auditRepo := &repositories.AuditLogRepository{}

	if err := auditRepo.Create(ctx, &log); err != nil {
		http.Error(w, "Failed to create audit log", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// CreateAuditLogEntry is a helper function to create audit log entries from other handlers
func CreateAuditLogEntry(log models.AuditLog) {
	ctx := context.Background()
	auditRepo := &repositories.AuditLogRepository{}
	auditRepo.Create(ctx, &log)
}

// GetAuditLogCount returns the total count of audit logs
func GetAuditLogCount() int {
	ctx := context.Background()
	auditRepo := &repositories.AuditLogRepository{}
	count, _ := auditRepo.Count(ctx)
	return count
}
