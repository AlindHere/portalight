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
func GetPermissions(role Role) []Permission {
	basePermissions := []Permission{
		{Resource: "services", Action: "view", Allowed: true},
		{Resource: "services", Action: "create", Allowed: false},
		{Resource: "services", Action: "delete", Allowed: false},
		{Resource: "provision", Action: "create", Allowed: false},
		{Resource: "members", Action: "view", Allowed: false},
		{Resource: "members", Action: "manage", Allowed: false},
		{Resource: "teams", Action: "view", Allowed: true},
		{Resource: "teams", Action: "manage", Allowed: false},
	}

	if role == RoleAdmin {
		// Admin has all permissions
		for i := range basePermissions {
			basePermissions[i].Allowed = true
		}
	}

	return basePermissions
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
