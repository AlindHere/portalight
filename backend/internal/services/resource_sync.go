package services

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

// SyncResult contains the result of a sync operation
type SyncResult struct {
	ProjectID        string    `json:"project_id"`
	SecretID         string    `json:"secret_id"`
	Region           string    `json:"region"`
	ResourcesFound   int       `json:"resources_found"`
	ResourcesAdded   int       `json:"resources_added"`
	ResourcesActive  int       `json:"resources_active"`
	ResourcesDeleted int       `json:"resources_deleted"`
	SyncedAt         time.Time `json:"synced_at"`
	Error            string    `json:"error,omitempty"`
}

// ResourceSyncService handles background synchronization of AWS resources
type ResourceSyncService struct {
	discovery    *AWSDiscovery
	secretRepo   *repositories.SecretRepository
	resourceRepo *repositories.DiscoveredResourceRepository
	mu           sync.Mutex
	stopCh       chan struct{}
	running      bool
}

// NewResourceSyncService creates a new sync service
func NewResourceSyncService() *ResourceSyncService {
	return &ResourceSyncService{
		discovery:    NewAWSDiscovery(),
		secretRepo:   &repositories.SecretRepository{},
		resourceRepo: repositories.NewDiscoveredResourceRepository(),
		stopCh:       make(chan struct{}),
	}
}

// SyncProject verifies status of associated resources for a project
// It only checks if EXISTING associated resources still exist in AWS
// It does NOT add new resources - those must be explicitly associated via "Discover Resources"
func (s *ResourceSyncService) SyncProject(ctx context.Context, projectID, secretID, region string) (*SyncResult, error) {
	result := &SyncResult{
		ProjectID: projectID,
		SecretID:  secretID,
		Region:    region,
		SyncedAt:  time.Now(),
	}

	// Get existing associated resources for this project
	existingResources, err := s.resourceRepo.GetByProjectID(ctx, projectID)
	if err != nil {
		result.Error = err.Error()
		return result, err
	}

	// If no resources associated, nothing to sync
	if len(existingResources) == 0 {
		return result, nil
	}

	// Get credentials
	_, credentials, err := s.secretRepo.GetByIDWithCredentials(ctx, secretID)
	if err != nil {
		result.Error = err.Error()
		return result, err
	}

	// Discover all resources from AWS to check which ones still exist
	discovered, err := s.discovery.DiscoverAll(ctx, credentials, region)
	if err != nil {
		result.Error = err.Error()
		return result, err
	}

	// Create a map of ARNs that exist in AWS
	awsARNs := make(map[string]bool)
	for _, d := range discovered {
		awsARNs[d.ARN] = true
	}

	result.ResourcesFound = len(discovered)

	// Check each existing associated resource against AWS
	for _, res := range existingResources {
		if awsARNs[res.ARN] {
			// Resource still exists in AWS
			if res.Status != models.ResourceStatusActive {
				s.resourceRepo.UpdateStatus(ctx, res.ID, models.ResourceStatusActive)
			}
			result.ResourcesActive++
		} else {
			// Resource no longer exists in AWS
			if res.Status != models.ResourceStatusDeleted {
				s.resourceRepo.UpdateStatus(ctx, res.ID, models.ResourceStatusDeleted)
				result.ResourcesDeleted++
			}
		}
	}

	return result, nil
}

// StartBackgroundSync starts periodic background synchronization
func (s *ResourceSyncService) StartBackgroundSync(interval time.Duration) {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.stopCh = make(chan struct{})
	s.mu.Unlock()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.runSyncCycle()
			case <-s.stopCh:
				return
			}
		}
	}()

	log.Printf("Background sync service started with interval: %v", interval)
}

// StopBackgroundSync stops the background synchronization
func (s *ResourceSyncService) StopBackgroundSync() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		close(s.stopCh)
		s.running = false
		log.Println("Background sync service stopped")
	}
}

// runSyncCycle performs a full sync cycle for all projects with discovered resources
func (s *ResourceSyncService) runSyncCycle() {
	ctx := context.Background()

	// This would typically query for all project-secret pairs that have discovered resources
	// For now, we log that sync is happening
	log.Println("Running background sync cycle...")

	// In a production implementation, you would:
	// 1. Query all unique (project_id, secret_id) pairs from discovered_resources
	// 2. For each pair, run SyncProject
	// 3. Log results and update last_synced_at

	_ = ctx // Placeholder - implement actual sync logic
}

// GetSyncStatus returns the current sync status
func (s *ResourceSyncService) GetSyncStatus() map[string]interface{} {
	s.mu.Lock()
	defer s.mu.Unlock()

	return map[string]interface{}{
		"running": s.running,
	}
}
