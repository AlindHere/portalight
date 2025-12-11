package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"

	"github.com/portalight/backend/internal/api/middleware"
	"github.com/portalight/backend/internal/config"
	"github.com/portalight/backend/internal/models"
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

	// 3. Create or Update User (Mock DB logic for now)
	role := models.RoleDev
	if githubUser.Login == "admin-user" { // Example admin check
		role = models.RoleAdmin
	}

	// 4. Generate JWT
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &middleware.Claims{
		UserID: githubUser.Login,
		Role:   string(role),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "portalight",
		},
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := jwtToken.SignedString([]byte(h.Config.JWTSecret))
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// 5. Redirect to Frontend with Token
	frontendURL := "http://localhost:3000/auth/callback?token=" + tokenString
	http.Redirect(w, r, frontendURL, http.StatusTemporaryRedirect)
}
