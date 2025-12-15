package handlers

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/config"
	"github.com/portalight/backend/internal/models"
	"github.com/portalight/backend/internal/repositories"
)

type AuthHandler struct {
	Config      *config.Config
	OAuthConfig *oauth2.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		Config: cfg,
		OAuthConfig: &oauth2.Config{
			ClientID:     cfg.GithubClientID,
			ClientSecret: cfg.GithubClientSecret,
			Scopes:       []string{"read:user", "read:org"},
			Endpoint:     github.Endpoint,
			RedirectURL:  fmt.Sprintf("http://localhost:%s/auth/github/callback", cfg.Port),
		},
	}
}

// LoginRequest represents username/password login request
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents login response
type LoginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

// HandleLogin handles username/password login (for superadmin only)
func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request"})
		return
	}

	// Find superadmin user
	ctx := context.Background()
	userRepo := &repositories.UserRepository{}

	superadmin, err := userRepo.FindByEmail(ctx, req.Username)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid credentials"})
		return
	}

	if superadmin.Role != models.RoleAdmin {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid credentials"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(superadmin.PasswordHash), []byte(req.Password)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid credentials"})
		return
	}

	// Generate JWT
	token, err := h.generateToken(superadmin.ID, superadmin.Email, string(superadmin.Role))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to generate token"})
		return
	}

	response := LoginResponse{
		Token: token,
		User: models.User{
			ID:        superadmin.ID,
			Name:      superadmin.Name,
			Email:     superadmin.Email,
			Role:      superadmin.Role,
			TeamIDs:   superadmin.TeamIDs,
			Avatar:    superadmin.Avatar,
			CreatedAt: superadmin.CreatedAt,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *AuthHandler) HandleGithubLogin(w http.ResponseWriter, r *http.Request) {
	url := h.OAuthConfig.AuthCodeURL("state", oauth2.AccessTypeOnline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) HandleGithubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Code not found", http.StatusBadRequest)
		return
	}

	token, err := h.OAuthConfig.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "Failed to exchange token", http.StatusInternalServerError)
		return
	}

	client := h.OAuthConfig.Client(context.Background(), token)

	// 1. Get User Info
	userResp, err := client.Get("https://api.github.com/user")
	if err != nil {
		http.Error(w, "Failed to get user info", http.StatusInternalServerError)
		return
	}
	defer userResp.Body.Close()

	var githubUser struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&githubUser); err != nil {
		http.Error(w, "Failed to decode user info", http.StatusInternalServerError)
		return
	}

	// 2. Check Org Membership
	if h.Config.GithubAllowedOrg != "" {
		orgResp, err := client.Get(fmt.Sprintf("https://api.github.com/user/orgs"))
		if err != nil {
			http.Error(w, "Failed to get orgs", http.StatusInternalServerError)
			return
		}
		defer orgResp.Body.Close()

		var orgs []struct {
			Login string `json:"login"`
		}
		if err := json.NewDecoder(orgResp.Body).Decode(&orgs); err != nil {
			http.Error(w, "Failed to decode orgs", http.StatusInternalServerError)
			return
		}

		isMember := false
		for _, org := range orgs {
			if org.Login == h.Config.GithubAllowedOrg {
				isMember = true
				break
			}
		}

		if !isMember {
			http.Error(w, fmt.Sprintf("You must be a member of %s to login", h.Config.GithubAllowedOrg), http.StatusForbidden)
			return
		}
	}

	// 3. Find or Create User
	user := h.findOrCreateGithubUser(githubUser.ID, githubUser.Login, githubUser.Name, githubUser.Email, githubUser.AvatarURL)

	// 4. Generate JWT
	jwtToken, err := h.generateToken(user.ID, user.Email, string(user.Role))
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// 5. Redirect to Frontend with Token
	frontendURL := "http://localhost:3000/auth/callback?token=" + jwtToken
	http.Redirect(w, r, frontendURL, http.StatusTemporaryRedirect)
}

// findOrCreateGithubUser finds existing user or creates new one with dev role
func (h *AuthHandler) findOrCreateGithubUser(githubID int64, login, name, email, avatarURL string) *models.User {
	// Use GitHub username as fallback if name is empty
	displayName := name
	if displayName == "" {
		displayName = login
	}

	// If email is empty (privacy settings), use GitHub username
	userEmail := email
	if userEmail == "" {
		userEmail = login
	}

	ctx := context.Background()
	userRepo := &repositories.UserRepository{}

	// Try to find existing user by GitHub ID
	existingUser, err := userRepo.FindByGithubID(ctx, githubID)
	if err == nil {
		// Update user info on each login
		existingUser.Name = displayName
		existingUser.Email = userEmail
		existingUser.Avatar = avatarURL
		existingUser.GithubUsername = login
		userRepo.Update(ctx, existingUser)
		return existingUser
	}

	// Create new user with dev role
	newUser := &models.User{
		Name:           displayName,
		Email:          userEmail,
		Role:           models.RoleDev, // All new GitHub users start as dev
		TeamIDs:        []string{},
		Avatar:         avatarURL,
		GithubID:       githubID,
		GithubUsername: login,
		CreatedAt:      time.Now(),
	}

	if err := userRepo.Create(ctx, newUser); err != nil {
		// Fallback to in-memory if database fails (shouldn't happen)
		newUser.ID = generateID()
		return newUser
	}

	return newUser
}

// generateToken generates a JWT token
func (h *AuthHandler) generateToken(userID, email, role string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &middleware.Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "portalight",
		},
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return jwtToken.SignedString([]byte(h.Config.JWTSecret))
}

// generateID generates a random ID
func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}
