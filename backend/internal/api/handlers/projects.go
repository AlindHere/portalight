package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// GetProjects returns all projects
func GetProjects(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	projectRepo := &repositories.ProjectRepository{}

	projects, err := projectRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, "Failed to fetch projects", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

// GetProjectByID returns a single project with its associated services
func GetProjectByID(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	projectRepo := &repositories.ProjectRepository{}
	serviceRepo := &repositories.ServiceRepository{}
	teamRepo := &repositories.TeamRepository{}

	// Extract ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	projectID := strings.Split(path, "/")[0]

	// Find project
	project, err := projectRepo.FindByID(ctx, projectID)
	if err != nil {
		if err.Error() == "project not found" {
			http.Error(w, "Project not found", http.StatusNotFound)
		} else {
			log.Printf("Error fetching project %s: %v", projectID, err)
			http.Error(w, fmt.Sprintf("Failed to fetch project: %v", err), http.StatusInternalServerError)
		}
		return
	}

	// Get associated services
	services, err := serviceRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		// Log error but continue with empty services
		log.Printf("Failed to fetch services for project %s: %v", projectID, err)
		services = []models.Service{}
	}

	// Get team name
	var teamName string
	if project.OwnerTeamID != "" {
		team, err := teamRepo.FindByID(ctx, project.OwnerTeamID)
		if err == nil {
			teamName = team.Name
		}
	}

	result := models.ProjectWithServices{
		Project:  *project,
		Services: services,
		TeamName: teamName,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// CreateProject creates a new project
func CreateProject(w http.ResponseWriter, r *http.Request) {
	var newProject models.Project
	if err := json.NewDecoder(r.Body).Decode(&newProject); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	projectRepo := &repositories.ProjectRepository{}

	if err := projectRepo.Create(ctx, &newProject); err != nil {
		http.Error(w, "Failed to create project", http.StatusInternalServerError)
		return
	}

	// Create audit log
	detailsJSON, _ := json.Marshal(map[string]interface{}{
		"project_id":     newProject.ID,
		"project_name":   newProject.Name,
		"description":    newProject.Description,
		"confluence_url": newProject.ConfluenceURL,
		"owner_team_id":  newProject.OwnerTeamID,
	})

	auditLog := models.AuditLog{
		UserEmail:    "system@portalight.dev",
		UserName:     "System",
		Action:       "create_project",
		ResourceType: "project",
		ResourceID:   newProject.ID,
		ResourceName: newProject.Name,
		Details:      string(detailsJSON),
		Status:       "success",
	}
	CreateAuditLogEntry(auditLog)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newProject)
}

// UpdateProject updates an existing project
func UpdateProject(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	projectID := strings.Split(path, "/")[0]

	var updateData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	projectRepo := &repositories.ProjectRepository{}

	// Find project
	project, err := projectRepo.FindByID(ctx, projectID)
	if err != nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Update fields
	if name, ok := updateData["name"].(string); ok {
		project.Name = name
	}
	if desc, ok := updateData["description"].(string); ok {
		project.Description = desc
	}
	if url, ok := updateData["confluence_url"].(string); ok {
		project.ConfluenceURL = url
	}
	if avatar, ok := updateData["avatar"].(string); ok {
		project.Avatar = avatar
	}
	if owner, ok := updateData["owner_team_id"].(string); ok {
		project.OwnerTeamID = owner
	}

	// Save to database
	if err := projectRepo.Update(ctx, project); err != nil {
		http.Error(w, "Failed to update project", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(project)
}

// DeleteProject deletes a project
func DeleteProject(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	projectID := strings.Split(path, "/")[0]

	ctx := context.Background()
	projectRepo := &repositories.ProjectRepository{}

	if err := projectRepo.Delete(ctx, projectID); err != nil {
		http.Error(w, "Failed to delete project", http.StatusInternalServerError)
		return
	}

	// Create audit log
	auditLog := models.AuditLog{
		UserEmail:    "system@portalight.dev",
		UserName:     "System",
		Action:       "delete_project",
		ResourceType: "project",
		ResourceID:   projectID,
		Status:       "success",
	}
	CreateAuditLogEntry(auditLog)

	w.WriteHeader(http.StatusOK)
}

// UpdateProjectAccess updates who has access to a project
func UpdateProjectAccess(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	parts := strings.Split(path, "/")
	projectID := parts[0]

	var request struct {
		TeamIDs []string `json:"team_ids"`
		UserIDs []string `json:"user_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	projectRepo := &repositories.ProjectRepository{}

	// Update access
	if err := projectRepo.UpdateProjectAccess(ctx, projectID, request.TeamIDs, request.UserIDs); err != nil {
		http.Error(w, "Failed to update project access", http.StatusInternalServerError)
		return
	}

	// Return updated project
	project, err := projectRepo.FindByID(ctx, projectID)
	if err != nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(project)
}
