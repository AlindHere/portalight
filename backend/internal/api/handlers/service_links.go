package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// ServiceLinksHandler handles service links endpoints
type ServiceLinksHandler struct {
	linkRepo    *repositories.ServiceLinkRepository
	serviceRepo *repositories.ServiceRepository
}

// NewServiceLinksHandler creates a new ServiceLinksHandler
func NewServiceLinksHandler() *ServiceLinksHandler {
	return &ServiceLinksHandler{
		linkRepo:    repositories.NewServiceLinkRepository(),
		serviceRepo: &repositories.ServiceRepository{},
	}
}

// GetLinks handles GET /api/v1/services/:id/links
func (h *ServiceLinksHandler) GetLinks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract service ID from path: /api/v1/services/{id}/links
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 5 {
		http.Error(w, "Service ID is required", http.StatusBadRequest)
		return
	}
	serviceID := parts[4]

	links, err := h.linkRepo.GetByServiceID(r.Context(), serviceID)
	if err != nil {
		log.Printf("Failed to get service links: %v", err)
		http.Error(w, "Failed to get links", http.StatusInternalServerError)
		return
	}

	if links == nil {
		links = []models.ServiceLink{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(links)
}

// AddLink handles POST /api/v1/services/:id/links
func (h *ServiceLinksHandler) AddLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check permissions
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can add links", http.StatusForbidden)
		return
	}

	// Extract service ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 5 {
		http.Error(w, "Service ID is required", http.StatusBadRequest)
		return
	}
	serviceID := parts[4]

	var req struct {
		Label string `json:"label"`
		URL   string `json:"url"`
		Icon  string `json:"icon"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Label == "" || req.URL == "" {
		http.Error(w, "Label and URL are required", http.StatusBadRequest)
		return
	}

	link := &models.ServiceLink{
		ServiceID: serviceID,
		Label:     req.Label,
		URL:       req.URL,
		Icon:      req.Icon,
	}

	if err := h.linkRepo.Create(r.Context(), link); err != nil {
		log.Printf("Failed to create service link: %v", err)
		http.Error(w, "Failed to create link", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(link)
}

// UpdateLink handles PUT /api/v1/services/:id/links/:linkId
func (h *ServiceLinksHandler) UpdateLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check permissions
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can update links", http.StatusForbidden)
		return
	}

	// Extract link ID from path: /api/v1/services/{id}/links/{linkId}
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 7 {
		http.Error(w, "Link ID is required", http.StatusBadRequest)
		return
	}
	linkID := parts[6]

	var req struct {
		Label string `json:"label"`
		URL   string `json:"url"`
		Icon  string `json:"icon"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	link := &models.ServiceLink{
		ID:    linkID,
		Label: req.Label,
		URL:   req.URL,
		Icon:  req.Icon,
	}

	if err := h.linkRepo.Update(r.Context(), link); err != nil {
		log.Printf("Failed to update service link: %v", err)
		http.Error(w, "Failed to update link", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(link)
}

// DeleteLink handles DELETE /api/v1/services/:id/links/:linkId
func (h *ServiceLinksHandler) DeleteLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check permissions
	userRole := middleware.GetUserRole(r.Context())
	if userRole != "superadmin" && userRole != "lead" {
		http.Error(w, "Only leads and superadmins can delete links", http.StatusForbidden)
		return
	}

	// Extract link ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 7 {
		http.Error(w, "Link ID is required", http.StatusBadRequest)
		return
	}
	linkID := parts[6]

	if err := h.linkRepo.Delete(r.Context(), linkID); err != nil {
		log.Printf("Failed to delete service link: %v", err)
		http.Error(w, "Failed to delete link", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Link deleted successfully",
	})
}

// HandleLinks routes service link requests
func (h *ServiceLinksHandler) HandleLinks(w http.ResponseWriter, r *http.Request) {
	// Check if this is a specific link operation (has link ID)
	path := r.URL.Path
	parts := strings.Split(path, "/")

	// /api/v1/services/{id}/links/{linkId}
	if len(parts) >= 7 && parts[6] != "" {
		switch r.Method {
		case http.MethodPut:
			h.UpdateLink(w, r)
		case http.MethodDelete:
			h.DeleteLink(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// /api/v1/services/{id}/links
	switch r.Method {
	case http.MethodGet:
		h.GetLinks(w, r)
	case http.MethodPost:
		h.AddLink(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
