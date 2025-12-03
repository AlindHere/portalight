package database

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

// Connect establishes a connection pool to PostgreSQL
func Connect() error {
	dbHost := getEnvWithDefault("DB_HOST", "localhost")
	dbPort := getEnvWithDefault("DB_PORT", "5432")
	dbUser := getEnvWithDefault("DB_USER", "alindchaurasia")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := getEnvWithDefault("DB_NAME", "portalight_dev")
	dbSSLMode := getEnvWithDefault("DB_SSL_MODE", "disable")

	log.Printf("🔌 Connecting to database: host=%s port=%s user=%s dbname=%s", dbHost, dbPort, dbUser, dbName)

	// Build connection string in URL format
	var connString string
	if dbPassword != "" {
		connString = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=%s",
			dbUser, dbPassword, dbHost, dbPort, dbName, dbSSLMode,
		)
	} else {
		connString = fmt.Sprintf(
			"postgres://%s@%s:%s/%s?sslmode=%s",
			dbUser, dbHost, dbPort, dbName, dbSSLMode,
		)
	}

	// Create connection pool
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return fmt.Errorf("unable to parse database config: %w", err)
	}

	// Set pool configuration
	config.MaxConns = 25
	config.MinConns = 5

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(context.Background()); err != nil {
		return fmt.Errorf("unable to ping database: %w", err)
	}

	DB = pool
	log.Printf("✅ Connected to PostgreSQL database: %s", dbName)
	return nil
}

// Close closes the database connection pool
func Close() {
	if DB != nil {
		DB.Close()
		log.Println("Database connection pool closed")
	}
}

// Helper function to get environment variable with default
func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
