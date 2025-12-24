# Quick Reference: Creating Metadata Files

## ✅ Checklist Before Creating YAML

1. [ ] Get your team UUID from Portalight database
2. [ ] Decide project name (kebab-case, e.g., `payments-platform`)
3. [ ] List all services in this project
4. [ ] Gather GitHub repo URLs (optional)
5. [ ] Collect links (Grafana, Confluence, etc.)

---

## 📝 Minimal Example

```yaml
apiVersion: portalight.dev/v1alpha1
kind: ProjectCatalog

metadata:
  name: my-project              # REQUIRED
  title: My Project             # REQUIRED
  owner: "TEAM-UUID-HERE"       # REQUIRED - Get from database!

spec:
  services:
    - name: my-service          # REQUIRED
      title: My Service         # REQUIRED
```

---

## 🎨 Full Example with All Features

```yaml
apiVersion: portalight.dev/v1alpha1
kind: ProjectCatalog

metadata:
  name: payments-platform
  title: Payments Platform
  description: Payment processing infrastructure
  tags:
    - payments
    - critical
  owner: "650e8400-e29b-41d4-a716-446655440001"
  links:
    - url: https://confluence.company.com/payments
      title: Documentation
      type: confluence

spec:
  services:
    - name: payments-api
      title: Payments API
      description: Core payment processing
      language: Go
      environment: production
      repository: https://github.com/myorg/payments-api
      tags:
        - api
        - go
      links:
        - url: https://grafana.company.com/payments
          title: Grafana
          type: grafana
      dependencies:
        infrastructure:
          - postgresql
          - redis
        services:
          - user-api
```

---

## 🔑 Getting Team UUID

**Option 1: From Database**
```sql
SELECT id, name FROM teams;
```

**Option 2: From Portalight UI**
We'll add this in the Teams page:
- Show UUID when hovering over team
- Click to copy UUID
- Display in team details modal

---

## 📂 File Naming

**Good:**
- `payments-platform.yaml`
- `user-management.yaml`
- `data-analytics.yaml`

**Bad:**
- `Payments Platform.yaml` (spaces)
- `payments_platform.yml` (underscore, wrong extension)
- `PAYMENTS.yaml` (all caps)

**Rule:** kebab-case, `.yaml` extension, descriptive name

---

## ✅ Validation Checklist

Before syncing, ensure:

- [ ] File is valid YAML (use yamllint.com)
- [ ] `apiVersion` is `portalight.dev/v1alpha1`
- [ ] `kind` is `ProjectCatalog`
- [ ] `metadata.name` is unique across all projects
- [ ] `metadata.owner` is valid team UUID
- [ ] Each service has unique `name` within project
- [ ] All team UUIDs exist in database
- [ ] No duplicate service names across ALL projects

---

## 🚫 Common Mistakes

### 1. Wrong Team ID Format
```yaml
❌ owner: team-fintech          # Team name
❌ owner: 1                     # Number
✅ owner: "650e8400-e29b-41d4-a716-446655440001"  # UUID string
```

### 2. Duplicate Service Names
```yaml
# projects/payments.yaml
services:
  - name: api  # ❌ Too generic!

# projects/users.yaml
services:
  - name: api  # ❌ Conflicts!
```

Better:
```yaml
services:
  - name: payments-api  # ✅ Unique
  - name: users-api     # ✅ Unique
```

### 3. Invalid YAML Syntax
```yaml
❌ links
    - url: https://example.com
      title: Docs

✅ links:
    - url: https://example.com
      title: Docs
```

### 4. Missing Quotes on UUIDs
```yaml
❌ owner: 650e8400-e29b-41d4-a716-446655440001
✅ owner: "650e8400-e29b-41d4-a716-446655440001"
```

---

## 🔗 Link Types

Common `type` values for links:

- `confluence` - Confluence pages
- `jira` - JIRA boards/projects
- `grafana` - Grafana dashboards
- `datadog` - Datadog dashboards
- `swagger` - API documentation
- `github` - GitHub repos
- `web` - General websites
- `docs` - Documentation sites

---

## 🏷️ Common Tags

**By Type:**
- `api`, `frontend`, `worker`, `library`

**By Language:**
- `go`, `python`, `typescript`, `java`, `nodejs`

**By Criticality:**
- `critical`, `high-availability`, `experimental`

**By Domain:**
- `payments`, `auth`, `analytics`, `data`, `infra`

---

## 📊 Environment Values

Standard values:
- `production`
- `staging`
- `development`
- `experimental` (for beta/alpha features)

---

## 💡 Pro Tips

1. **Start Simple**
   - Add just name, title, owner
   - Add details gradually

2. **Use Comments**
   ```yaml
   # Production payment services
   services:
     - name: payments-api
       # Main customer-facing API
   ```

3. **Consistent Naming**
   - Use same pattern: `{domain}-{type}`
   - Examples: `payments-api`, `payments-worker`, `payments-ui`

4. **Group By Function**
   - Put related services in same project
   - Don't split by language/team

5. **Update Regularly**
   - Keep links current
   - Add new services as they're created
   - Remove deprecated services

---

**Need help?** Check `metadata-example.yaml` for complete working examples!
