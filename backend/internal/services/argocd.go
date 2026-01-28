package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/portalight/backend/internal/models"
)

// ArgoCDClient is a client for the ArgoCD API
type ArgoCDClient struct {
	baseURL string
	token   string
	client  *http.Client
}

// NewArgoCDClient creates a new ArgoCD client from environment variables
func NewArgoCDClient() *ArgoCDClient {
	return &ArgoCDClient{
		baseURL: strings.TrimSuffix(os.Getenv("ARGOCD_SERVER_URL"), "/"),
		token:   os.Getenv("ARGOCD_AUTH_TOKEN"),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// IsConfigured returns true if ArgoCD is configured
func (c *ArgoCDClient) IsConfigured() bool {
	return c.baseURL != "" && c.token != ""
}

// GetBaseURL returns the ArgoCD base URL for external links
func (c *ArgoCDClient) GetBaseURL() string {
	return c.baseURL
}

// doRequest performs an HTTP request to the ArgoCD API
func (c *ArgoCDClient) doRequest(method, path string, body io.Reader) (*http.Response, error) {
	url := c.baseURL + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	return c.client.Do(req)
}

// ListApplications returns all ArgoCD applications
func (c *ArgoCDClient) ListApplications() ([]models.ArgoCDApplication, error) {
	resp, err := c.doRequest("GET", "/api/v1/applications", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list applications: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ArgoCD API error: %s - %s", resp.Status, string(body))
	}

	var response struct {
		Items []struct {
			Metadata struct {
				Name              string `json:"name"`
				Namespace         string `json:"namespace"`
				CreationTimestamp string `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				Project string `json:"project"`
			} `json:"spec"`
			Status struct {
				Health struct {
					Status string `json:"status"`
				} `json:"health"`
				Sync struct {
					Status   string `json:"status"`
					Revision string `json:"revision"`
				} `json:"sync"`
			} `json:"status"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	apps := make([]models.ArgoCDApplication, len(response.Items))
	for i, item := range response.Items {
		apps[i] = models.ArgoCDApplication{
			Name:       item.Metadata.Name,
			Namespace:  item.Metadata.Namespace,
			Project:    item.Spec.Project,
			Health:     item.Status.Health.Status,
			SyncStatus: item.Status.Sync.Status,
			Revision:   item.Status.Sync.Revision,
			CreatedAt:  item.Metadata.CreationTimestamp,
		}
	}

	return apps, nil
}

// GetApplicationStatus returns the status of a specific application
func (c *ArgoCDClient) GetApplicationStatus(appName string) (*models.ArgoCDApplication, error) {
	resp, err := c.doRequest("GET", "/api/v1/applications/"+appName, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get application: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("application not found: %s", appName)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ArgoCD API error: %s - %s", resp.Status, string(body))
	}

	var response struct {
		Metadata struct {
			Name              string `json:"name"`
			Namespace         string `json:"namespace"`
			CreationTimestamp string `json:"creationTimestamp"`
		} `json:"metadata"`
		Spec struct {
			Project string `json:"project"`
		} `json:"spec"`
		Status struct {
			Health struct {
				Status string `json:"status"`
			} `json:"health"`
			Sync struct {
				Status   string `json:"status"`
				Revision string `json:"revision"`
			} `json:"sync"`
		} `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &models.ArgoCDApplication{
		Name:       response.Metadata.Name,
		Namespace:  response.Metadata.Namespace,
		Project:    response.Spec.Project,
		Health:     response.Status.Health.Status,
		SyncStatus: response.Status.Sync.Status,
		Revision:   response.Status.Sync.Revision,
		CreatedAt:  response.Metadata.CreationTimestamp,
	}, nil
}

// GetApplicationPods returns all pods for an application
func (c *ArgoCDClient) GetApplicationPods(appName string) ([]models.ArgoCDPod, error) {
	// Get the resource tree which includes pods
	resp, err := c.doRequest("GET", "/api/v1/applications/"+appName+"/resource-tree", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource tree: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ArgoCD API error: %s - %s", resp.Status, string(body))
	}

	var response struct {
		Nodes []struct {
			Kind      string   `json:"kind"`
			Name      string   `json:"name"`
			Namespace string   `json:"namespace"`
			Images    []string `json:"images"`
			Health    *struct {
				Status string `json:"status"`
			} `json:"health"`
			Info []struct {
				Name  string `json:"name"`
				Value string `json:"value"`
			} `json:"info"`
			CreatedAt string `json:"createdAt"`
		} `json:"nodes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	var pods []models.ArgoCDPod
	for _, node := range response.Nodes {
		if node.Kind != "Pod" {
			continue
		}

		pod := models.ArgoCDPod{
			Name:      node.Name,
			Namespace: node.Namespace,
			Status:    "Unknown",
			Ready:     "0/0",
		}

		if node.Health != nil {
			pod.Status = node.Health.Status
		}

		// Extract info fields from ArgoCD
		for _, info := range node.Info {
			switch info.Name {
			case "Status Reason":
				if pod.Status == "Unknown" {
					pod.Status = info.Value
				}
			case "Containers":
				// This field contains ready status like "1/1" or "2/2"
				pod.Ready = info.Value
			case "Restarts":
				// Parse restarts count
				if restarts, err := strconv.Atoi(info.Value); err == nil {
					pod.Restarts = restarts
				}
			}
		}

		// ALWAYS try to get containers from manifest first (most accurate)
		manifest, err := c.GetResourceManifest(appName, node.Name, node.Namespace, "Pod")
		if err != nil {
			log.Printf("[DEBUG] Failed to get manifest for pod %s: %v", node.Name, err)
		} else if manifest != "" {
			var podManifest struct {
				Spec struct {
					Containers []struct {
						Name string `json:"name"`
					} `json:"containers"`
					InitContainers []struct {
						Name string `json:"name"`
					} `json:"initContainers"`
				} `json:"spec"`
			}
			if unmarshalErr := json.Unmarshal([]byte(manifest), &podManifest); unmarshalErr != nil {
				log.Printf("[DEBUG] Failed to unmarshal manifest for pod %s: %v", node.Name, unmarshalErr)
			} else {
				log.Printf("[DEBUG] Pod %s has %d containers and %d initContainers", node.Name, len(podManifest.Spec.Containers), len(podManifest.Spec.InitContainers))
				for _, container := range podManifest.Spec.Containers {
					if container.Name != "" {
						pod.Containers = append(pod.Containers, container.Name)
						log.Printf("[DEBUG] Added container: %s", container.Name)
					}
				}
				// Note: InitContainers are short-lived, typically don't need logs
				// But if we want to include them:
				// for _, container := range podManifest.Spec.InitContainers {
				//     if container.Name != "" {
				//         pod.Containers = append(pod.Containers, container.Name)
				//     }
				// }
			}
		}

		// Fallback to images if manifest parsing fails
		if len(pod.Containers) == 0 && len(node.Images) > 0 {
			log.Printf("[DEBUG] No containers from manifest for pod %s, falling back to images", node.Name)
			for _, image := range node.Images {
				// Extract container name from image
				// Remove registry prefix and tag
				imageName := image
				// Remove tag
				if idx := strings.LastIndex(imageName, ":"); idx != -1 {
					imageName = imageName[:idx]
				}
				// Get the last part after /
				if idx := strings.LastIndex(imageName, "/"); idx != -1 {
					imageName = imageName[idx+1:]
				}
				if imageName != "" {
					pod.Containers = append(pod.Containers, imageName)
				}
			}
		}

		// Final fallback - use a generic name
		if len(pod.Containers) == 0 {
			log.Printf("[DEBUG] No containers found for pod %s, using 'main'", node.Name)
			pod.Containers = []string{"main"}
		}

		// Calculate age from createdAt
		if node.CreatedAt != "" {
			if t, err := time.Parse(time.RFC3339, node.CreatedAt); err == nil {
				pod.Age = formatDuration(time.Since(t))
			}
		}

		pods = append(pods, pod)
	}

	return pods, nil
}

// GetResourceManifest returns the manifest of a specific resource
func (c *ArgoCDClient) GetResourceManifest(appName, name, namespace, kind string) (string, error) {
	// For core resources (Pod, Service, etc), group is empty
	// For custom resources, group would be something like "apps" or "networking.k8s.io"
	// ArgoCD API expects group to be explicitly specified (empty string for core API)
	path := fmt.Sprintf("/api/v1/applications/%s/resource?name=%s&namespace=%s&resourceName=%s&kind=%s&version=v1&group=",
		appName, name, namespace, name, kind)

	log.Printf("[DEBUG] Fetching manifest from: %s", path)

	resp, err := c.doRequest("GET", path, nil)
	if err != nil {
		return "", fmt.Errorf("failed to get resource manifest: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[DEBUG] Manifest API error response: %s", string(body))
		return "", fmt.Errorf("ArgoCD API error: %s", resp.Status)
	}

	var response struct {
		Manifest string `json:"manifest"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return response.Manifest, nil
}

// GetPodLogs returns logs for a specific pod
func (c *ArgoCDClient) GetPodLogs(appName, podName, namespace, container string, tailLines int) (string, error) {
	path := fmt.Sprintf("/api/v1/applications/%s/pods/%s/logs?namespace=%s&container=%s&tailLines=%d",
		appName, podName, namespace, container, tailLines)

	resp, err := c.doRequest("GET", path, nil)
	if err != nil {
		return "", fmt.Errorf("failed to get pod logs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ArgoCD API error: %s - %s", resp.Status, string(body))
	}

	// ArgoCD returns logs as a stream of JSON objects
	var logs strings.Builder
	decoder := json.NewDecoder(resp.Body)
	for decoder.More() {
		var logEntry struct {
			Result struct {
				Content   string `json:"content"`
				Timestamp string `json:"timeStamp"`
			} `json:"result"`
		}
		if err := decoder.Decode(&logEntry); err != nil {
			break
		}
		if logEntry.Result.Content != "" {
			logs.WriteString(logEntry.Result.Content + "\n")
		}
	}

	return logs.String(), nil
}

// DeletePod deletes a specific pod
func (c *ArgoCDClient) DeletePod(appName, podName, namespace string) error {
	// ArgoCD requires resourceName and group parameters
	path := fmt.Sprintf("/api/v1/applications/%s/resource?name=%s&namespace=%s&resourceName=%s&kind=Pod&version=v1&group=",
		appName, podName, namespace, podName)

	log.Printf("[DEBUG] Deleting pod via: %s", path)

	resp, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("failed to delete pod: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Failed to delete pod: ArgoCD API error: %s - %s", resp.Status, string(body))
		return fmt.Errorf("ArgoCD API error: %s - %s", resp.Status, string(body))
	}

	log.Printf("[DEBUG] Pod %s deleted successfully", podName)
	return nil
}

// SyncApplication triggers a sync for an application
func (c *ArgoCDClient) SyncApplication(appName string) error {
	path := fmt.Sprintf("/api/v1/applications/%s/sync", appName)

	resp, err := c.doRequest("POST", path, strings.NewReader("{}"))
	if err != nil {
		return fmt.Errorf("failed to sync application: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ArgoCD API error: %s - %s", resp.Status, string(body))
	}

	return nil
}

// formatDuration formats a duration into a human-readable string
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%dh", int(d.Hours()))
	}
	return fmt.Sprintf("%dd", int(d.Hours()/24))
}
