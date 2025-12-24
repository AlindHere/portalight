package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	MetadataRepoURL    string
	MetadataRepoBranch string
	GithubToken        string
	CORSAllowedOrigins []string
	GithubClientID     string
	GithubClientSecret string
	GithubAllowedOrg   string
	JWTSecret          string
	EncryptionKey      string
}

func Load() *Config {
	// Load .env file from current directory
	if err := godotenv.Load(".env"); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return &Config{
		Port:               getEnv("PORT", "8080"),
		MetadataRepoURL:    getEnv("METADATA_REPO_URL", ""),
		MetadataRepoBranch: getEnv("METADATA_REPO_BRANCH", "main"),
		GithubToken:        getEnv("GITHUB_TOKEN", ""),
		CORSAllowedOrigins: []string{getEnv("CORS_ORIGIN", "http://localhost:3000")},
		GithubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GithubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		GithubAllowedOrg:   getEnv("GITHUB_ALLOWED_ORG", ""),
		JWTSecret:          getEnv("JWT_SECRET", "secret-key-change-me"),
		EncryptionKey:      getEnv("ENCRYPTION_KEY", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
