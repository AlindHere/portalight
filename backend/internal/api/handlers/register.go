package handlers

import (
	"encoding/json"
	"net/http"
)

type RegisterRequest struct {
	RepoURL string `json:"repoUrl"`
	PAT     string `json:"pat"`
	Branch  string `json:"branch"`
}

type RegisterResponse struct {
	Message    string `json:"message"`
	Status     string `json:"status"`
	Repository string `json:"repository"`
}

// RegisterRepository handles the registration of a new GitHub repository
func RegisterRepository(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.RepoURL == "" || req.PAT == "" {
		http.Error(w, "Repository URL and PAT are required", http.StatusBadRequest)
		return
	}

	// Set default branch if not provided
	if req.Branch == "" {
		req.Branch = "main"
	}

	// TODO: Implement actual GitHub API integration
	// 1. Validate GitHub PAT
	// 2. Fetch catalog-info.yaml from the repository
	// 3. Parse YAML and extract service metadata
	// 4. Store the repository configuration
	// 5. Create service entries from catalog-info.yaml

	// For now, return a mock success response
	response := RegisterResponse{
		Message:    "Repository registered successfully. Services will be synced shortly.",
		Status:     "pending",
		Repository: req.RepoURL,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(response)
}
