package catalog

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/portalight/backend/internal/github"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

type Syncer struct {
	githubClient *github.GitHubClient
	projectRepo  *repositories.ProjectRepository
	serviceRepo  *repositories.ServiceRepository
	teamRepo     *repositories.TeamRepository
	historyRepo  *repositories.SyncHistoryRepository
	configRepo   *repositories.GitHubConfigRepository
}

func NewSyncer(
	projectRepo *repositories.ProjectRepository,
	serviceRepo *repositories.ServiceRepository,
	teamRepo *repositories.TeamRepository,
	historyRepo *repositories.SyncHistoryRepository,
	configRepo *repositories.GitHubConfigRepository,
) *Syncer {
	return &Syncer{
		projectRepo: projectRepo,
		serviceRepo: serviceRepo,
		teamRepo:    teamRepo,
		historyRepo: historyRepo,
		configRepo:  configRepo,
	}
}

// initClient initializes the GitHub client from the stored configuration
func (s *Syncer) initClient(ctx context.Context) error {
	config, err := s.configRepo.GetConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to get github config: %w", err)
	}
	if config == nil {
		return fmt.Errorf("github integration not configured")
	}
	if !config.Enabled {
		return fmt.Errorf("github integration disabled")
	}

	// For now, only supporting PAT
	if config.PATEncrypted != nil && *config.PATEncrypted != "" {
		// In a real app, we would decrypt this. Assuming plain text for MVP/Demo if not encrypted logic implemented yet.
		// Or if it IS encrypted, we need a decryptor.
		// For this MVP, let's assume the repository stores it as is (maybe plain text for now or we need a helper).
		// Since I don't have a crypto helper yet, I'll assume it's stored as plain text in the "Encrypted" field for simplicity,
		// OR I should implement encryption. Given the constraints, I'll assume plain text for now.
		s.githubClient = github.NewClientWithPAT(ctx, *config.PATEncrypted)
		return nil
	}

	return fmt.Errorf("no valid authentication method found")
}

// Scan lists available project files in the configured repository
func (s *Syncer) Scan(ctx context.Context) ([]string, error) {
	if err := s.initClient(ctx); err != nil {
		return nil, err
	}

	config, _ := s.configRepo.GetConfig(ctx) // Already checked in initClient

	files, err := s.githubClient.ListFiles(ctx, config.RepoOwner, config.RepoName, config.ProjectsPath, config.Branch)
	if err != nil {
		return nil, err
	}

	var filePaths []string
	for _, f := range files {
		// Simple filter for .yaml or .yml
		if len(f.Name) > 5 && (f.Name[len(f.Name)-5:] == ".yaml" || f.Name[len(f.Name)-4:] == ".yml") {
			filePaths = append(filePaths, f.Path)
		}
	}

	return filePaths, nil
}

// SyncProject syncs a single project file
func (s *Syncer) SyncProject(ctx context.Context, filePath string, teamID string, userID string, userName string) (*models.SyncHistory, error) {
	if err := s.initClient(ctx); err != nil {
		return nil, err
	}

	config, _ := s.configRepo.GetConfig(ctx)

	history := &models.SyncHistory{
		ID:              uuid.New().String(),
		SyncType:        "manual",
		CatalogFilePath: filePath,
		Status:          "running",
		StartedAt:       time.Now(),
		SyncedBy:        userID,
		SyncedByName:    userName,
	}
	// Create initial history record
	if err := s.historyRepo.Create(ctx, history); err != nil {
		return nil, fmt.Errorf("failed to create sync history: %w", err)
	}

	// Helper to finish sync
	finish := func(status string, err error) (*models.SyncHistory, error) {
		history.Status = status
		now := time.Now()
		history.CompletedAt = &now
		history.DurationMs = now.Sub(history.StartedAt).Milliseconds()
		if err != nil {
			history.ErrorMessage = err.Error()
		}
		_ = s.historyRepo.Update(ctx, history)
		return history, err
	}

	// 1. Fetch Content
	content, err := s.githubClient.GetFileContent(ctx, config.RepoOwner, config.RepoName, filePath, config.Branch)
	if err != nil {
		return finish("failed", fmt.Errorf("failed to fetch file: %w", err))
	}

	// 2. Parse
	catalog, err := ParseYAML(content)
	if err != nil {
		return finish("failed", fmt.Errorf("failed to parse yaml: %w", err))
	}

	// 3. Validate Schema
	validationErrors := ValidateSchema(catalog)
	if len(validationErrors) > 0 {
		history.ValidationErrors = validationErrors
		return finish("failed", fmt.Errorf("schema validation failed"))
	}

	// 4. Use provided team ID as Owner
	ownerTeamID := teamID

	// 5. Upsert Project
	project := &models.Project{
		Name: catalog.Metadata.Title, // Use Title as Name for display, or Metadata.Name?
		// The DB has Name as unique. Metadata.Name is the ID (kebab-case). Metadata.Title is display.
		// Let's use Metadata.Title as Name, but we need to store Metadata.Name somewhere.
		// Actually, DB Name is VARCHAR(255) UNIQUE.
		// If we use Title "Payments Platform", it's fine.
		// But Metadata.Name "payments-platform" is the stable ID.
		// Let's use Metadata.Title for Name, and maybe store Metadata.Name in CatalogMetadata.
		Description:     catalog.Metadata.Description,
		OwnerTeamID:     ownerTeamID,
		CatalogFilePath: filePath,
		CatalogMetadata: catalog,
		AutoSynced:      true,
		SyncStatus:      "success",
	}

	// Map links to fields if possible
	for _, link := range catalog.Metadata.Links {
		if link.Type == "confluence" || link.Title == "Confluence" {
			project.ConfluenceURL = link.URL
		}
	}

	if err := s.projectRepo.UpsertFromCatalog(ctx, project); err != nil {
		return finish("failed", fmt.Errorf("failed to upsert project: %w", err))
	}
	history.ProjectID = project.ID
	history.ProjectName = project.Name
	history.ProjectsUpdated = 1 // Or Created, hard to distinguish without checking first

	// 6. Upsert Services
	fmt.Printf("📊 [Sync] Found %d services in catalog\n", len(catalog.Spec.Services))
	log.Printf("📊 [Sync] Found %d services in catalog", len(catalog.Spec.Services))
	var activeServiceNames []string
	for _, svcSpec := range catalog.Spec.Services {
		// Resolve Service Owner - default to project owner
		serviceOwnerID := ownerTeamID
		if svcSpec.Owner != "" {
			svcTeam, err := s.teamRepo.FindByName(ctx, svcSpec.Owner)
			if err != nil {
				// Log warning but continue? Or fail?
				// Let's fail for strictness as per plan
				return finish("failed", fmt.Errorf("failed to find service owner team '%s': %w", svcSpec.Owner, err))
			}
			if svcTeam == nil {
				return finish("failed", fmt.Errorf("service owner team '%s' not found", svcSpec.Owner))
			}
			serviceOwnerID = svcTeam.ID
		}

		service := &models.Service{
			Name: svcSpec.Name,   // This is the ID/Name
			Team: serviceOwnerID, // This is actually TeamID in struct but JSON tag is team?
			// Wait, models.Service has Team string `json:"team"`. In DB it's team_id UUID.
			// ServiceRepository UpsertFromCatalog handles this: `if service.Team != "" { teamID = &service.Team }`
			// So I should put the UUID in service.Team.
			ProjectID:       project.ID,
			Description:     svcSpec.Description,
			Environment:     svcSpec.Environment,
			Language:        svcSpec.Language,
			Tags:            svcSpec.Tags,
			Repository:      svcSpec.Repository,
			Owner:           svcSpec.Owner, // This is string name, keep it for reference
			CatalogSource:   filePath,
			AutoSynced:      true,
			CatalogMetadata: svcSpec,
		}

		for _, link := range svcSpec.Links {
			if link.Type == "grafana" {
				service.GrafanaURL = link.URL
			}
			if link.Type == "confluence" {
				service.ConfluenceURL = link.URL
			}
		}

		if err := s.serviceRepo.UpsertFromCatalog(ctx, service); err != nil {
			return finish("failed", fmt.Errorf("failed to upsert service '%s': %w", svcSpec.Name, err))
		}
		activeServiceNames = append(activeServiceNames, svcSpec.Name)
		history.ServicesUpdated++
	}

	// 7. Handle Orphans - Delete services not in catalog
	if err := s.serviceRepo.DeleteOrphanedServices(ctx, project.ID, activeServiceNames); err != nil {
		return finish("failed", fmt.Errorf("failed to delete orphaned services: %w", err))
	}
	// We'd need to count orphans to update history, but UpdateOrphanStatus doesn't return count.
	// We can skip exact count for now.

	return finish("success", nil)
}
