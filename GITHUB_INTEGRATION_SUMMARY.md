# GitHub Integration - Planning Complete ✅

## 📋 What We've Decided

### Authentication
- ✅ Support **both** GitHub App and Personal Access Token
- ✅ User chooses based on their setup
- ✅ Both stored encrypted in database

### Repository Structure
- ✅ **Private repository** containing all metadata
- ✅ One YAML file per project
- ✅ Each file contains project + all its services
- ✅ Example: `projects/payments-platform.yaml`

### Team Matching
- ✅ **Exact UUID matching** from database
- ✅ Format: `owner: "650e8400-e29b-41d4-a716-446655440001"`
- ✅ Sync fails if team doesn't exist (strict validation)

### Service Lifecycle
- ✅ **Mark as orphaned** when removed from catalog
- ✅ Don't auto-delete
- ✅ Lead/Superadmin can delete from UI
- ✅ Show orphaned services separately

### Starting Point
- ✅ **Clean slate** - no existing services
- ✅ All services come from GitHub sync
- ✅ Fresh start for catalog system

---

## 📁 Files Created

### 1. Implementation Plan
**File:** `GITHUB_INTEGRATION_PLAN.md`
- Complete technical specification
- Database schemas
- API endpoints
- Frontend components
- 4-week timeline
- Security considerations

### 2. Example Metadata Files

**File:** `metadata-example.yaml`
- Payments Platform project
- 5 services (API, Worker, Billing, Gateway, Dashboard)
- Complete with all fields
- Production-ready structure

**File:** `metadata-example-user-management.yaml`
- User Management project
- 3 services (User API, Auth, Profile UI)
- Simpler example for reference

---

## 🗄️ Database Changes Required

### New Tables
1. `github_metadata_config` - Store GitHub repo config
2. `catalog_sync_history` - Track all sync operations

### Updated Tables
**projects:**
- `catalog_file_path` - Path to YAML file
- `catalog_metadata` - Full parsed YAML (JSONB)
- `last_synced_at` - Last sync timestamp
- `sync_status` - Current sync status
- `auto_synced` - Created from catalog?

**services:**
- `catalog_source` - Source YAML file
- `auto_synced` - Created from catalog?
- `orphaned` - Removed from catalog?
- `orphaned_at` - When marked orphaned
- `catalog_metadata` - Full service definition (JSONB)

---

## 🔄 Sync Flow Summary

```
1. Configure GitHub repo in Settings
   ↓
2. Click "Sync from GitHub"
   ↓
3. Scan repo for *.yaml files
   ↓
4. Show preview of projects & services
   ↓
5. User selects projects to sync
   ↓
6. Backend processes each file:
   - Parse YAML
   - Validate schema
   - Create/update project
   - Create/update services
   - Mark missing services as orphaned
   ↓
7. Show sync results
   ↓
8. Ongoing: Manual, Scheduled, or Webhook sync
```

---

## 🎯 YAML Schema (Quick Reference)

### Required Fields

**Project Level:**
```yaml
metadata:
  name: "unique-id"           # Required
  title: "Display Name"       # Required
  owner: "team-uuid"          # Required
```

**Service Level:**
```yaml
spec:
  services:
    - name: "service-id"      # Required
      title: "Service Name"   # Required
```

### Optional Fields
- description
- tags[]
- language
- environment
- repository
- links[]
- dependencies{}

---

## 🚀 Next Steps

### Option 1: Start Implementation (Week 1)
1. Create database migrations
2. Build GitHub client (PAT + App support)
3. Build YAML parser
4. Basic sync logic

**Command:** Ready when you are!

### Option 2: Refine Planning
- Discuss specific implementation details
- Create user stories
- Design UI mockups

### Option 3: Setup Metadata Repo
- Create actual GitHub repo
- Add example YAML files
- Setup validation CI

---

## ❓ Questions Before Implementation

1. **GitHub App Setup**
   - Do you want me to guide you through creating a GitHub App?
   - Or start with just PAT support?

2. **Metadata Repository**
   - Do you have a repo ready?
   - Or should we create one as part of setup?

3. **Team UUIDs**
   - Need help getting current team IDs from database?
   - Should we add a "Team ID" display in UI?

4. **Implementation Priority**
   - Start with Week 1 foundation?
   - Or focus on specific component first?

---

**Status:** ✅ Planning Complete - Ready for Implementation

**Waiting for:** Your decision on next steps!
