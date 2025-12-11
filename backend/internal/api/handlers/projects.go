package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/portalight/backend/internal/models"
)

// Mock projects data
var mockProjects = []models.Project{
	{
		ID:            "850e8400-e29b-41d4-a716-446655440000",
		Name:          "Factory",
		Description:   "Core platform and infrastructure services for the organization",
		ConfluenceURL: "https://confluence.company.com/display/FACTORY/Factory-Platform",
		OwnerTeamID:   "650e8400-e29b-41d4-a716-446655440001",
		CreatedAt:     time.Now().AddDate(0, -12, 0),
		UpdatedAt:     time.Now(),
	},
	{
		ID:            "850e8400-e29b-41d4-a716-446655440001",
		Name:          "Payments Platform",
		Description:   "Core payment processing infrastructure and billing services",
		ConfluenceURL: "https://confluence.company.com/display/PAY/Payments-Platform",
		OwnerTeamID:   "650e8400-e29b-41d4-a716-446655440001",
		CreatedAt:     time.Now().AddDate(0, -6, 0),
		UpdatedAt:     time.Now(),
	},
	{
		ID:            "850e8400-e29b-41d4-a716-446655440002",
		Name:          "User Management",
		Description:   "Authentication, authorization, and user profile services",
		ConfluenceURL: "https://confluence.company.com/display/AUTH/User-Management",
		OwnerTeamID:   "650e8400-e29b-41d4-a716-446655440002",
		CreatedAt:     time.Now().AddDate(0, -8, 0),
		UpdatedAt:     time.Now(),
	},
	{
		ID:            "850e8400-e29b-41d4-a716-446655440003",
		Name:          "Analytics Pipeline",
		Description:   "Data analytics, reporting, and notification services",
		ConfluenceURL: "https://confluence.company.com/display/DATA/Analytics-Pipeline",
		OwnerTeamID:   "650e8400-e29b-41d4-a716-446655440002",
		CreatedAt:     time.Now().AddDate(0, -4, 0),
		UpdatedAt:     time.Now(),
	},
}

// GetProjects returns all projects
func GetProjects(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockProjects)
}

// GetProjectByID returns a single project with its associated services
func GetProjectByID(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	projectID := strings.Split(path, "/")[0]

	// Find project
	var project *models.Project
	for i := range mockProjects {
		if mockProjects[i].ID == projectID {
			project = &mockProjects[i]
			break
		}
	}

	if project == nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Get associated services
	var services []models.Service
	for _, svc := range MockServices {
		// Check if service belongs to this project
		// In real implementation, this would be a database join
		// For Factory project, include all services
		if project.ID == "850e8400-e29b-41d4-a716-446655440000" {
			services = append(services, svc)
		} else if (project.ID == "850e8400-e29b-41d4-a716-446655440001" && svc.Name == "payments-service-go") ||
			(project.ID == "850e8400-e29b-41d4-a716-446655440002" && svc.Name == "user-auth-api") ||
			(project.ID == "850e8400-e29b-41d4-a716-446655440003" && (svc.Name == "notification-worker" || svc.Name == "analytics-dashboard")) {
			services = append(services, svc)
		}
	}

	// Get team name
	var teamName string
	for _, team := range mockTeams {
		if team.ID == project.OwnerTeamID {
			teamName = team.Name
			break
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
	// TODO: Check if user is admin

	var newProject models.Project
	if err := json.NewDecoder(r.Body).Decode(&newProject); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate ID and timestamps
	newProject.ID = "proj-" + time.Now().Format("20060102150405")
	newProject.CreatedAt = time.Now()
	newProject.UpdatedAt = time.Now()

	mockProjects = append(mockProjects, newProject)

	// Create audit log entry
	detailsJSON, _ := json.Marshal(map[string]interface{}{
		"project_id":     newProject.ID,
		"project_name":   newProject.Name,
		"description":    newProject.Description,
		"confluence_url": newProject.ConfluenceURL,
		"owner_team_id":  newProject.OwnerTeamID,
	})

	auditLog := models.AuditLog{
		UserEmail:    "john.doe@company.com", // TODO: Get from auth context
		UserName:     "John Doe",
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
	// TODO: Check if user is admin

	// Extract ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	projectID := strings.Split(path, "/")[0]

	var updateData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Find and update project
	for i := range mockProjects {
		if mockProjects[i].ID == projectID {
			if name, ok := updateData["name"].(string); ok {
				mockProjects[i].Name = name
			}
			if desc, ok := updateData["description"].(string); ok {
				mockProjects[i].Description = desc
			}
			if url, ok := updateData["confluence_url"].(string); ok {
				mockProjects[i].ConfluenceURL = url
			}
			if avatar, ok := updateData["avatar"].(string); ok {
				mockProjects[i].Avatar = avatar
			}
			if owner, ok := updateData["owner_team_id"].(string); ok {
				mockProjects[i].OwnerTeamID = owner
			}

			mockProjects[i].UpdatedAt = time.Now()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(mockProjects[i])
			return
		}
	}

	http.Error(w, "Project not found", http.StatusNotFound)
}

// DeleteProject deletes a project
func DeleteProject(w http.ResponseWriter, r *http.Request) {
	// TODO: Check if user is admin

	// Extract ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/projects/")
	projectID := strings.Split(path, "/")[0]

	// Remove project
	for i := range mockProjects {
		if mockProjects[i].ID == projectID {
			mockProjects = append(mockProjects[:i], mockProjects[i+1:]...)
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	http.Error(w, "Project not found", http.StatusNotFound)
}

// UpdateProjectAccess updates the access list for a project
func UpdateProjectAccess(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		ProjectID string   `json:"project_id"`
		TeamIDs   []string `json:"team_ids"`
		UserIDs   []string `json:"user_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Find and update project
	for i, project := range mockProjects {
		if project.ID == request.ProjectID {
			mockProjects[i].TeamIDs = request.TeamIDs
			mockProjects[i].UserIDs = request.UserIDs
			mockProjects[i].UpdatedAt = time.Now()

			// Create audit log
			details, _ := json.Marshal(map[string]interface{}{
				"project_id": request.ProjectID,
				"team_ids":   request.TeamIDs,
				"user_ids":   request.UserIDs,
			})
			CreateAuditLogEntry(models.AuditLog{
				UserEmail:    "admin@portalight.io", // TODO: Get from context
				UserName:     "Admin User",
				Action:       "update_project_access",
				ResourceType: "project",
				ResourceID:   project.ID,
				ResourceName: project.Name,
				Details:      string(details),
				Status:       "success",
			})

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(mockProjects[i])
			return
		}
	}

	http.Error(w, "Project not found", http.StatusNotFound)
}
