# GitHub Integration & Catalog System - Implementation Plan

## 📋 Executive Summary

Implement a centralized metadata repository system where:
- **One GitHub repository** contains all project metadata
- **Each YAML file** represents one project and all its services
- **Auto-sync** keeps Portalight in sync with the metadata repo
- **Orphaned services** are marked and can be deleted by leads/superadmin

---

## ✅ Final Decisions

### 1. Authentication
- ✅ **Support Both**: GitHub App (primary) + Personal Access Token (fallback)
- ✅ User can choose based on their GitHub setup

### 2. Repository Access
- ✅ **Private Repository**: Requires authentication
- ✅ Organization-level access needed

### 3. Team Matching
- ✅ **Team Name Matching**: Use human-readable team names
- ✅ Case-insensitive lookup in database
- ✅ Sync fails if team doesn't exist
- ✅ Example: `owner: Platform Team` matches team with name "platform team"

### 4. Service Deletion Strategy
- ✅ **Mark as Orphaned**: Don't auto-delete
- ✅ Services get `orphaned: true` flag
- ✅ UI shows orphaned services separately
- ✅ Lead/Superadmin can delete from UI

### 5. Starting State
- ✅ **Clean Slate**: No existing services
- ✅ All services come from GitHub sync
- ✅ Manual service creation disabled (or marked as non-synced)

---

## 📁 Metadata Repository Structure

```
myorg/service-metadata/
├── README.md
├── projects/
│   ├── payments-platform.yaml
│   ├── user-management.yaml
│   ├── analytics-pipeline.yaml
│   └── factory.yaml
├── schemas/
│   └── project-catalog-schema.json      # JSON schema for validation
└── .github/
    └── workflows/
        └── validate.yml                  # CI validation
```

---

## 📄 YAML Schema Definition

### Project Catalog File Structure

```yaml
apiVersion: portalight.dev/v1alpha1
kind: ProjectCatalog

metadata:
  name: payments-platform                              # Required: Unique ID
  title: Payments Platform                             # Required: Display name
  description: Core payment processing infrastructure   # Optional
  tags:                                                 # Optional
    - payments
    - critical
  owner: "650e8400-e29b-41d4-a716-446655440001"       # Required: Team UUID
  links:                                                # Optional
    - url: https://confluence.company.com/payments
      title: Documentation
      type: confluence

spec:
  services:                                             # Required: Array
    - name: payments-api                                # Required: Unique ID
      title: Payments REST API                          # Required: Display
      description: Core payment processing API          # Optional
      language: Go                                      # Optional
      environment: production                           # Optional: production|staging|development
      repository: https://github.com/myorg/payments-api # Optional: GitHub repo
      owner: "650e8400-e29b-41d4-a716-446655440001"    # Optional: Overrides project owner
      tags:                                             # Optional
        - api
        - payment
      links:                                            # Optional
        - url: https://grafana.company.com/d/payments
          title: Grafana Dashboard
          type: grafana
      dependencies:                                     # Optional
        infrastructure:
          - postgresql
          - redis
        services:
          - user-api
          - billing-api
```

### Required vs Optional Fields

**Project Level (metadata):**
- ✅ Required: `name`, `title`, `owner` (team name)
- ⚪ Optional: `description`, `tags`, `links`

**Service Level (spec.services[]):**
- ✅ Required: `name`, `title`
- ⚪ Optional: Everything else

**Team Name Resolution:**
- Team names are case-insensitive
- "Platform Team" = "platform team" = "PLATFORM TEAM"
- Matched against `teams.name` column in database
- Converted to team UUID during sync

---

## 🗄️ Database Schema Updates

### 1. GitHub Configuration Table

```sql
CREATE TABLE github_metadata_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Repository Details
    repo_owner VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    branch VARCHAR(100) DEFAULT 'main' NOT NULL,
    projects_path VARCHAR(255) DEFAULT 'projects' NOT NULL,
    
    -- Authentication (store one or both)
    auth_type VARCHAR(50) NOT NULL,  -- 'github_app' | 'pat' | 'both'
    
    -- GitHub App settings
    github_app_id BIGINT,
    github_app_installation_id BIGINT,
    github_app_private_key_encrypted TEXT,
    
    -- PAT settings
    personal_access_token_encrypted TEXT,
    
    -- Status
    enabled BOOLEAN DEFAULT true,
    last_scan_at TIMESTAMP,
    last_scan_status VARCHAR(50),     -- 'success' | 'failed'
    last_scan_error TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT single_config_row CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Ensure only one configuration exists
CREATE UNIQUE INDEX idx_github_config_singleton ON github_metadata_config ((id));
```

### 2. Update Projects Table

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS catalog_file_path VARCHAR(500);
  -- Example: "projects/payments-platform.yaml"

ALTER TABLE projects ADD COLUMN IF NOT EXISTS catalog_metadata JSONB;
  -- Store full parsed YAML for reference

ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'never_synced';
  -- 'never_synced' | 'syncing' | 'success' | 'failed'

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sync_error TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_synced BOOLEAN DEFAULT false;
  -- Was this created from catalog sync?

CREATE INDEX idx_projects_catalog_path ON projects(catalog_file_path);
CREATE INDEX idx_projects_sync_status ON projects(sync_status);
```

### 3. Update Services Table

```sql
ALTER TABLE services ADD COLUMN IF NOT EXISTS catalog_source VARCHAR(500);
  -- Which project YAML file this came from

ALTER TABLE services ADD COLUMN IF NOT EXISTS auto_synced BOOLEAN DEFAULT false;
  -- Was this created from catalog sync?

ALTER TABLE services ADD COLUMN IF NOT EXISTS orphaned BOOLEAN DEFAULT false;
  -- Service removed from catalog but kept in DB

ALTER TABLE services ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMP;
  -- When it was marked as orphaned

ALTER TABLE services ADD COLUMN IF NOT EXISTS catalog_metadata JSONB;
  -- Store full service definition from YAML

CREATE INDEX idx_services_auto_synced ON services(auto_synced);
CREATE INDEX idx_services_orphaned ON services(orphaned);
CREATE INDEX idx_services_catalog_source ON services(catalog_source);
```

### 4. Sync History Table

```sql
CREATE TABLE catalog_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Sync Context
    sync_type VARCHAR(50) NOT NULL,   -- 'manual' | 'scheduled' | 'webhook'
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_name VARCHAR(255),         -- In case project deleted
    catalog_file_path VARCHAR(500),
    
    -- Results
    status VARCHAR(50) NOT NULL,       -- 'success' | 'partial' | 'failed'
    projects_created INT DEFAULT 0,
    projects_updated INT DEFAULT 0,
    services_created INT DEFAULT 0,
    services_updated INT DEFAULT 0,
    services_orphaned INT DEFAULT 0,
    
    -- Error Details
    error_message TEXT,
    validation_errors JSONB,           -- Detailed validation errors
    
    -- Duration
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INT,
    
    -- User Context
    synced_by UUID REFERENCES users(id),
    synced_by_name VARCHAR(255),
    
    CONSTRAINT duration_check CHECK (duration_ms >= 0)
);

CREATE INDEX idx_sync_history_project ON catalog_sync_history(project_id);
CREATE INDEX idx_sync_history_status ON catalog_sync_history(status);
CREATE INDEX idx_sync_history_started ON catalog_sync_history(started_at DESC);
```

---

## 🏗️ Backend Architecture

### New Directory Structure

```
backend/
├── internal/
│   ├── github/
│   │   ├── client.go              # GitHub API client (supports both auth methods)
│   │   ├── auth_app.go            # GitHub App authentication
│   │   ├── auth_pat.go            # Personal Access Token auth
│   │   ├── file_reader.go         # Read files from repo
│   │   └── webhook.go             # Webhook handler
│   │
│   ├── catalog/
│   │   ├── parser.go              # YAML parser
│   │   ├── validator.go           # Schema validation
│   │   ├── syncer.go              # Sync orchestrator
│   │   ├── schema.go              # Go struct definitions
│   │   ├── transformer.go         # YAML → DB models
│   │   └── differ.go              # Detect changes
│   │
│   ├── repositories/
│   │   ├── github_config_repository.go
│   │   ├── sync_history_repository.go
│   │   └── (existing repositories...)
│   │
│   └── api/handlers/
│       ├── catalog_config.go      # Config CRUD
│       ├── catalog_sync.go        # Sync operations
│       └── github_webhook.go      # Webhook endpoint
```

### Key Components

#### 1. GitHub Client (`internal/github/client.go`)

```go
type GitHubClient struct {
    authType    string
    appClient   *github.Client  // For GitHub App
    patClient   *github.Client  // For PAT
}

func (c *GitHubClient) GetFileContent(owner, repo, path, branch string) ([]byte, error)
func (c *GitHubClient) ListFiles(owner, repo, path, branch string) ([]FileInfo, error)
func (c *GitHubClient) ValidateAccess() error
```

#### 2. Catalog Parser (`internal/catalog/parser.go`)

```go
type ProjectCatalog struct {
    APIVersion string           `yaml:"apiVersion"`
    Kind       string           `yaml:"kind"`
    Metadata   ProjectMetadata  `yaml:"metadata"`
    Spec       ProjectSpec      `yaml:"spec"`
}

func ParseYAML(content []byte) (*ProjectCatalog, error)
func ValidateSchema(catalog *ProjectCatalog) []ValidationError
```

#### 3. Sync Orchestrator (`internal/catalog/syncer.go`)

```go
type Syncer struct {
    githubClient *github.GitHubClient
    projectRepo  *repositories.ProjectRepository
    serviceRepo  *repositories.ServiceRepository
    historyRepo  *repositories.SyncHistoryRepository
}

func (s *Syncer) SyncAll() (*SyncResult, error)
func (s *Syncer) SyncProject(filePath string) (*ProjectSyncResult, error)
func (s *Syncer) DetectOrphans(projectID string, catalogServices []string) ([]string, error)
```

---

## 🌐 API Endpoints

### Configuration Endpoints

```
GET    /api/v1/catalog/config
POST   /api/v1/catalog/config
PUT    /api/v1/catalog/config
DELETE /api/v1/catalog/config
POST   /api/v1/catalog/config/test-connection
```

### Sync Endpoints

```
GET    /api/v1/catalog/scan
  - Scans repo without syncing
  - Returns list of found projects + preview

POST   /api/v1/catalog/sync
  Body: { "project_files": ["projects/payments.yaml"] }  // empty = sync all
  - Triggers sync
  - Returns sync job ID

GET    /api/v1/catalog/sync/:syncId/status
  - Check sync progress
  - Returns real-time status

GET    /api/v1/catalog/sync/history
  Query: ?limit=50&project_id=xxx
  - Get sync history

POST   /api/v1/projects/:id/sync
  - Sync single project
  - Returns sync result

GET    /api/v1/services/orphaned
  - List all orphaned services
  - For cleanup UI

DELETE /api/v1/services/:id/orphaned
  - Delete orphaned service (Lead/Superadmin only)
```

### Webhook Endpoint

```
POST   /api/v1/webhooks/github
  Headers: X-GitHub-Event, X-Hub-Signature-256
  - Receives GitHub push events
  - Validates signature
  - Triggers smart sync (only changed files)
```

---

## 🎨 Frontend Components

### 1. Configuration Page (`/configuration → GitHub Integration Tab`)

```typescript
interface GitHubConfigForm {
  // Repository
  repoOwner: string;
  repoName: string;
  branch: string;
  projectsPath: string;
  
  // Authentication
  authType: 'github_app' | 'pat' | 'both';
  
  // GitHub App
  appId?: string;
  installationId?: string;
  privateKey?: File;
  
  // PAT
  personalAccessToken?: string;
  
  enabled: boolean;
}
```

**UI Features:**
- Connection test button
- Validation before save
- Show last scan status
- Trigger manual scan

### 2. Catalog Sync Modal (`Projects → Sync from GitHub`)

```typescript
interface SyncModalProps {
  availableProjects: CatalogProject[];
  onSync: (selectedFiles: string[]) => void;
}

interface CatalogProject {
  filePath: string;
  projectName: string;
  serviceCount: number;
  owner: string;
  status: 'new' | 'modified' | 'up-to-date';
  lastSynced?: Date;
}
```

**UI Features:**
- Checkbox selection
- Preview services count
- Show sync status
- Diff indication (modified files)

### 3. Orphaned Services Page (`/services/orphaned`)

**List View:**
```
Orphaned Services (3)
─────────────────────
These services were removed from the catalog but kept in the database.

[ ] payment-legacy-api
    From: payments-platform.yaml
    Orphaned: 5 days ago
    [Delete]

[ ] old-notification-worker  
    From: notifications.yaml
    Orphaned: 12 days ago
    [Delete]

[Delete Selected] [Restore All]
```

### 4. Project Card Sync Status

**Additional info on project cards:**
```
┌────────────────────────────┐
│ Payments Platform          │
├────────────────────────────┤
│ 5 services · Team Fintech  │
│                            │
│ 📄 payments-platform.yaml  │
│ Last Sync: 2h ago ✅       │
│                            │
│ [🔄 Sync Now]              │
└────────────────────────────┘
```

---

## 🔄 Sync Logic Flow

### Detailed Sync Process

```
1. FETCH YAML FILES
   ├─ Get list of .yaml files from /projects/
   ├─ For each file:
   │  ├─ Download content
   │  ├─ Parse YAML
   │  └─ Validate schema
   └─ Store in memory

2. VALIDATE ALL
   ├─ Resolve team names to UUIDs (case-insensitive lookup)
   ├─ Check all team names exist in database
   ├─ Check for duplicate project names
   ├─ Check for duplicate service names (globally)
   └─ Return errors if any

3. SYNC PROJECTS (Transaction per project)
   ├─ BEGIN TRANSACTION
   │
   ├─ Find existing project by catalog_file_path
   │
   ├─ IF NOT EXISTS:
   │  ├─ CREATE new project
   │  └─ Set auto_synced = true
   │
   ├─ IF EXISTS:
   │  ├─ UPDATE project metadata
   │  └─ Update last_synced_at
   │
   ├─ SYNC SERVICES:
   │  ├─ Get existing services: SELECT * WHERE project_id = X AND auto_synced = true
   │  │
   │  ├─ For each service in YAML:
   │  │  ├─ IF EXISTS (by name):
   │  │  │  ├─ UPDATE service
   │  │  │  └─ Set orphaned = false
   │  │  │
   │  │  └─ IF NOT EXISTS:
   │  │     ├─ CREATE service
   │  │     └─ Set auto_synced = true
   │  │
   │  └─ For existing services NOT in YAML:
   │     ├─ SET orphaned = true
   │     └─ SET orphaned_at = NOW()
   │
   ├─ RECORD SYNC HISTORY
   │  └─ INSERT counts and status
   │
   └─ COMMIT TRANSACTION

4. RETURN RESULTS
   └─ Summary of all changes
```

### Orphan Detection

```sql
-- Services that were auto-synced but no longer in catalog
UPDATE services 
SET orphaned = true, 
    orphaned_at = NOW()
WHERE project_id = $1 
  AND auto_synced = true 
  AND name NOT IN (
    SELECT name FROM catalog_services_temp
  );
```

---

## 🔐 Security Considerations

### 1. GitHub Authentication

**GitHub App:**
- ✅ Store private key encrypted in database
- ✅ Use app installation token (expires in 1 hour)
- ✅ Auto-refresh tokens

**PAT:**
- ✅ Store encrypted in database
- ✅ Never expose in API responses
- ✅ Require superadmin to configure

### 2. Webhook Validation

```go
// Validate webhook signature
func ValidateWebhookSignature(payload []byte, signature string, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

### 3. Access Control

- ✅ Only Superadmin can configure GitHub integration
- ✅ Lead/Superadmin can trigger sync
- ✅ Lead/Superadmin can delete orphaned services
- ✅ Everyone can view catalog status

---

## 📅 Implementation Timeline

### Week 1: Foundation
- [ ] Database migrations
- [ ] GitHub client (both auth methods)
- [ ] YAML parser & validator
- [ ] Basic sync logic (projects only)

### Week 2: Services & UI
- [ ] Service sync logic
- [ ] Orphan detection
- [ ] Configuration UI
- [ ] Sync modal UI

### Week 3: History & Polish
- [ ] Sync history tracking
- [ ] Orphaned services page
- [ ] Error handling & validation
- [ ] Progress indicators

### Week 4: Automation
- [ ] Scheduled sync (cron)
- [ ] Webhook endpoint
- [ ] Webhook setup UI
- [ ] Real-time sync

---

## 🧪 Testing Strategy

### Unit Tests
- ✅ YAML parser
- ✅ Schema validator
- ✅ GitHub client
- ✅ Sync logic

### Integration Tests
- ✅ Full sync flow
- ✅ Orphan detection
- ✅ Conflict resolution

### E2E Tests
- ✅ Configure → Scan → Sync workflow
- ✅ Webhook trigger
- ✅ Orphan cleanup

---

## 📝 Example Metadata File

See `metadata-example.yaml` in project root.

---

## ✅ Acceptance Criteria

### Must Have (MVP)
1. ✅ Configure GitHub repo (PAT or App)
2. ✅ Scan repo for project files
3. ✅ Preview projects before sync
4. ✅ Sync creates/updates projects + services
5. ✅ Orphaned services marked (not deleted)
6. ✅ Manual sync button works
7. ✅ Sync history visible

### Should Have
1. ✅ Scheduled auto-sync
2. ✅ Orphaned services cleanup UI
3. ✅ Validation error details
4. ✅ Diff indication

### Nice to Have
1. ✅ Webhook-based sync
2. ✅ Dry-run mode
3. ✅ Rollback capability

---

**Status:** Ready for Implementation
**Next Step:** Create example YAML and start Week 1 tasks
