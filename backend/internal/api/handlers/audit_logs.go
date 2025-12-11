package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/portalight/backend/internal/models"

	"github.com/google/uuid"
)

// In-memory storage for audit logs (will be replaced with S3)
var (
	auditLogs      []models.AuditLog
	auditLogsMutex sync.RWMutex
)

// GetAuditLogs retrieves audit logs with optional filtering
func GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get query parameters for filtering
	userEmail := r.URL.Query().Get("user_email")
	action := r.URL.Query().Get("action")

	auditLogsMutex.RLock()
	defer auditLogsMutex.RUnlock()

	// Filter logs
	filteredLogs := make([]models.AuditLog, 0)
	for _, log := range auditLogs {
		if userEmail != "" && !strings.Contains(strings.ToLower(log.UserEmail), strings.ToLower(userEmail)) {
			continue
		}
		if action != "" && log.Action != action {
			continue
		}
		filteredLogs = append(filteredLogs, log)
	}

	// Sort by timestamp (newest first)
	sort.Slice(filteredLogs, func(i, j int) bool {
		return filteredLogs[i].Timestamp > filteredLogs[j].Timestamp
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(filteredLogs)
}

// CreateAuditLog creates a new audit log entry
func CreateAuditLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var log models.AuditLog
	if err := json.NewDecoder(r.Body).Decode(&log); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate ID and timestamp if not provided
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.Timestamp == "" {
		log.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	if log.Status == "" {
		log.Status = "success"
	}

	// Get IP address from request
	if log.IPAddress == "" {
		log.IPAddress = r.RemoteAddr
	}

	// Store the log
	auditLogsMutex.Lock()
	auditLogs = append(auditLogs, log)
	auditLogsMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(log)
}

// CreateAuditLogEntry is a helper function to create audit logs from other handlers
func CreateAuditLogEntry(log models.AuditLog) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.Timestamp == "" {
		log.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	if log.Status == "" {
		log.Status = "success"
	}

	auditLogsMutex.Lock()
	auditLogs = append(auditLogs, log)
	auditLogsMutex.Unlock()

	return nil
}

// GetAuditLogsCount returns the total count of audit logs
func GetAuditLogsCount() int {
	auditLogsMutex.RLock()
	defer auditLogsMutex.RUnlock()
	return len(auditLogs)
}
