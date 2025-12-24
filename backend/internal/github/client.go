package github

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/go-github/v57/github"
	"golang.org/x/oauth2"
)

type AuthType string

const (
	AuthTypePAT       AuthType = "pat"
	AuthTypeGitHubApp AuthType = "github_app"
)

type GitHubClient struct {
	client   *github.Client
	authType AuthType
}

// NewClientWithPAT creates a new GitHub client using a Personal Access Token
func NewClientWithPAT(ctx context.Context, token string) *GitHubClient {
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(ctx, ts)
	client := github.NewClient(tc)

	return &GitHubClient{
		client:   client,
		authType: AuthTypePAT,
	}
}

// FileInfo represents a file in the repository
type FileInfo struct {
	Name string
	Path string
	Type string // "file" or "dir"
	SHA  string
}

// GetFileContent retrieves the content of a file from the repository
func (c *GitHubClient) GetFileContent(ctx context.Context, owner, repo, path, branch string) ([]byte, error) {
	opts := &github.RepositoryContentGetOptions{
		Ref: branch,
	}

	fileContent, _, _, err := c.client.Repositories.GetContents(ctx, owner, repo, path, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get file content: %w", err)
	}

	if fileContent == nil {
		return nil, fmt.Errorf("file not found or is a directory: %s", path)
	}

	content, err := fileContent.GetContent()
	if err != nil {
		return nil, fmt.Errorf("failed to decode file content: %w", err)
	}

	return []byte(content), nil
}

// ListFiles recursively lists all files in a directory matching a pattern (simple suffix match for now)
// Note: GitHub API has limits, for large repos we might need the Tree API.
// For now, we'll use the Tree API directly as it's more efficient for recursive listing.
func (c *GitHubClient) ListFiles(ctx context.Context, owner, repo, path, branch string) ([]FileInfo, error) {
	// Get the SHA of the branch first
	ref, _, err := c.client.Git.GetRef(ctx, owner, repo, "refs/heads/"+branch)
	if err != nil {
		if strings.Contains(err.Error(), "404") {
			// Check if repo exists/accessible
			if accessErr := c.ValidateAccess(ctx, owner, repo); accessErr != nil {
				return nil, fmt.Errorf("repository '%s/%s' not found or access denied (check PAT permissions): %v", owner, repo, accessErr)
			}
			return nil, fmt.Errorf("branch '%s' not found in repository '%s/%s'", branch, owner, repo)
		}
		return nil, fmt.Errorf("failed to get branch ref: %w", err)
	}

	// Get the tree recursively
	tree, _, err := c.client.Git.GetTree(ctx, owner, repo, ref.Object.GetSHA(), true)
	if err != nil {
		return nil, fmt.Errorf("failed to get git tree: %w", err)
	}

	var files []FileInfo
	for _, entry := range tree.Entries {
		// Filter by path prefix if specified
		if path != "" && !strings.HasPrefix(entry.GetPath(), path) {
			continue
		}

		// We only care about blobs (files), not trees (directories)
		if entry.GetType() == "blob" {
			files = append(files, FileInfo{
				Name: getFileName(entry.GetPath()),
				Path: entry.GetPath(),
				Type: "file",
				SHA:  entry.GetSHA(),
			})
		}
	}

	return files, nil
}

// ValidateAccess checks if the client can access the repository
func (c *GitHubClient) ValidateAccess(ctx context.Context, owner, repo string) error {
	_, _, err := c.client.Repositories.Get(ctx, owner, repo)
	if err != nil {
		return fmt.Errorf("failed to access repository %s/%s: %w", owner, repo, err)
	}
	return nil
}

func getFileName(path string) string {
	parts := strings.Split(path, "/")
	return parts[len(parts)-1]
}
