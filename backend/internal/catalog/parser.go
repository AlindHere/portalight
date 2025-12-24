package catalog

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// ParseYAML parses the raw YAML content into a ProjectCatalog struct
func ParseYAML(content []byte) (*ProjectCatalog, error) {
	var catalog ProjectCatalog
	if err := yaml.Unmarshal(content, &catalog); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}
	return &catalog, nil
}

// ValidationError represents a validation issue
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidateSchema checks if the catalog structure is valid according to rules
func ValidateSchema(catalog *ProjectCatalog) []ValidationError {
	var errors []ValidationError

	// Validate API Version and Kind
	if catalog.APIVersion != "portalight.dev/v1alpha1" {
		errors = append(errors, ValidationError{
			Field:   "apiVersion",
			Message: "must be portalight.dev/v1alpha1",
		})
	}
	if catalog.Kind != "ProjectCatalog" {
		errors = append(errors, ValidationError{
			Field:   "kind",
			Message: "must be ProjectCatalog",
		})
	}

	// Validate Metadata
	if catalog.Metadata.Name == "" {
		errors = append(errors, ValidationError{
			Field:   "metadata.name",
			Message: "is required",
		})
	}
	if catalog.Metadata.Title == "" {
		errors = append(errors, ValidationError{
			Field:   "metadata.title",
			Message: "is required",
		})
	}
	if catalog.Metadata.Owner == "" {
		errors = append(errors, ValidationError{
			Field:   "metadata.owner",
			Message: "is required",
		})
	}

	// Validate Services
	if len(catalog.Spec.Services) == 0 {
		errors = append(errors, ValidationError{
			Field:   "spec.services",
			Message: "at least one service is required",
		})
	}

	seenServices := make(map[string]bool)
	for i, service := range catalog.Spec.Services {
		if service.Name == "" {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("spec.services[%d].name", i),
				Message: "is required",
			})
		} else {
			if seenServices[service.Name] {
				errors = append(errors, ValidationError{
					Field:   fmt.Sprintf("spec.services[%d].name", i),
					Message: fmt.Sprintf("duplicate service name '%s' in this file", service.Name),
				})
			}
			seenServices[service.Name] = true
		}

		if service.Title == "" {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("spec.services[%d].title", i),
				Message: "is required",
			})
		}
	}

	return errors
}

// IsValidTeamName checks if the team name exists in the database
// This is a placeholder - actual validation needs database access
func IsValidTeamName(teamName string, validTeams map[string]string) bool {
	_, exists := validTeams[strings.ToLower(teamName)]
	return exists
}
