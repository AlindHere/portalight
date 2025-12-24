package models

import "time"

// Role represents user access level
type Role string

const (
	RoleAdmin Role = "superadmin"
	RoleLead  Role = "lead"
	RoleDev   Role = "dev"
)

// User represents a platform user
type User struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	Role           Role      `json:"role"`
	TeamIDs        []string  `json:"team_ids"`
	Avatar         string    `json:"avatar,omitempty"`
	GithubID       int64     `json:"github_id,omitempty"`
	GithubUsername string    `json:"github_username,omitempty"`
	PasswordHash   string    `json:"-"` // Password hash, not exposed in JSON
	CreatedAt      time.Time `json:"created_at"`
}

// Team represents a group of users that own services
type Team struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	MemberIDs   []string  `json:"member_ids"`
	ServiceIDs  []string  `json:"service_ids"`
	CreatedAt   time.Time `json:"created_at"`
}

// Permission represents what a user can do
type Permission struct {
	Resource string `json:"resource"`
	Action   string `json:"action"`
	Allowed  bool   `json:"allowed"`
}

// GetPermissions returns permissions for a role
// Dev: Read-only, can view audit logs but NO write access
// Lead: All write access EXCEPT configuration page
// Superadmin: Full access
func GetPermissions(role Role) []Permission {
	// All roles start with these base read permissions
	permissions := []Permission{
		// View permissions (all roles)
		{Resource: "services", Action: "view", Allowed: true},
		{Resource: "projects", Action: "view", Allowed: true},
		{Resource: "teams", Action: "view", Allowed: true},
		{Resource: "audit_logs", Action: "view", Allowed: true},
		{Resource: "resources", Action: "view", Allowed: true},

		// Write permissions (default: not allowed for dev)
		{Resource: "services", Action: "create", Allowed: false},
		{Resource: "services", Action: "update", Allowed: false},
		{Resource: "services", Action: "delete", Allowed: false},
		{Resource: "projects", Action: "create", Allowed: false},
		{Resource: "projects", Action: "update", Allowed: false},
		{Resource: "projects", Action: "delete", Allowed: false},
		{Resource: "teams", Action: "create", Allowed: false},
		{Resource: "teams", Action: "update", Allowed: false},
		{Resource: "teams", Action: "delete", Allowed: false},
		{Resource: "provision", Action: "create", Allowed: false},
		{Resource: "members", Action: "view", Allowed: false},
		{Resource: "members", Action: "manage", Allowed: false},

		// Configuration permissions (superadmin only)
		{Resource: "configuration", Action: "view", Allowed: false},
		{Resource: "configuration", Action: "manage", Allowed: false},
		{Resource: "credentials", Action: "view", Allowed: false},
		{Resource: "credentials", Action: "manage", Allowed: false},
		{Resource: "users", Action: "manage", Allowed: false},
	}

	switch role {
	case RoleAdmin:
		// Superadmin has all permissions
		for i := range permissions {
			permissions[i].Allowed = true
		}

	case RoleLead:
		// Lead has write access except configuration
		for i := range permissions {
			p := &permissions[i]
			// Allow all write permissions except configuration-related
			if p.Resource != "configuration" && p.Resource != "credentials" && p.Resource != "users" {
				p.Allowed = true
			}
			// Lead can view members
			if p.Resource == "members" && p.Action == "view" {
				p.Allowed = true
			}
		}

	case RoleDev:
		// Dev is read-only, base permissions already set
		// Only view permissions are allowed (already set above)
	}

	return permissions
}

// CanPerform checks if a user has permission for an action
func (u *User) CanPerform(resource, action string) bool {
	permissions := GetPermissions(u.Role)
	for _, p := range permissions {
		if p.Resource == resource && p.Action == action {
			return p.Allowed
		}
	}
	return false
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}
