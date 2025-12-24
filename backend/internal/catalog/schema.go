package catalog

// ProjectCatalog represents the root structure of the catalog-info.yaml file
type ProjectCatalog struct {
	APIVersion string          `yaml:"apiVersion"`
	Kind       string          `yaml:"kind"`
	Metadata   ProjectMetadata `yaml:"metadata"`
	Spec       ProjectSpec     `yaml:"spec"`
}

// ProjectMetadata contains project-level details
type ProjectMetadata struct {
	Name        string   `yaml:"name"`
	Title       string   `yaml:"title"`
	Description string   `yaml:"description,omitempty"`
	Tags        []string `yaml:"tags,omitempty"`
	Owner       string   `yaml:"owner"` // Team Name or UUID
	Links       []Link   `yaml:"links,omitempty"`
}

// ProjectSpec contains the list of services
type ProjectSpec struct {
	Services []ServiceSpec `yaml:"services"`
}

// ServiceSpec represents a single service definition
type ServiceSpec struct {
	Name         string       `yaml:"name"`
	Title        string       `yaml:"title"`
	Description  string       `yaml:"description,omitempty"`
	Language     string       `yaml:"language,omitempty"`
	Environment  string       `yaml:"environment,omitempty"`
	Repository   string       `yaml:"repository,omitempty"`
	Owner        string       `yaml:"owner,omitempty"` // Optional override
	Tags         []string     `yaml:"tags,omitempty"`
	Links        []Link       `yaml:"links,omitempty"`
	Dependencies Dependencies `yaml:"dependencies,omitempty"`
}

// Link represents an external link
type Link struct {
	URL   string `yaml:"url"`
	Title string `yaml:"title"`
	Type  string `yaml:"type,omitempty"` // confluence, jira, grafana, etc.
}

// Dependencies represents service dependencies
type Dependencies struct {
	Infrastructure []string `yaml:"infrastructure,omitempty"`
	Services       []string `yaml:"services,omitempty"`
}
