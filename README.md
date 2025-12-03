# Portalight - Internal Developer Portal

A modern internal developer portal (IDP) inspired by Backstage and Port, built with Go and Next.js.

## Features

- **Service Catalog**: Centralized view of all services with metadata from GitHub repository
- **Observability Integration**: Embedded Grafana dashboards and Confluence documentation
- **Self-Service Provisioning**: Create AWS/Azure resources directly from the portal
- **Secret Management**: Securely manage and select cloud provider credentials
- **Modern UI**: Clean design with green-blue gradient theme

## Architecture

```
dev-portal/
├── backend/          # Go backend with REST APIs
│   ├── cmd/
│   │   └── server/   # Main application entry
│   ├── internal/
│   │   ├── api/      # HTTP handlers and middleware
│   │   ├── models/   # Data models
│   │   ├── services/ # Business logic
│   │   └── config/   # Configuration
│   └── pkg/          # Shared utilities
│
└── frontend/         # Next.js frontend
    ├── app/          # Pages and layouts
    ├── components/   # React components
    ├── lib/          # API client and utilities
    └── styles/       # Global styles
```

## Getting Started

### Prerequisites

- Go 1.21+ (backend)
- Node.js 20+ (frontend)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
go mod tidy
```

3. Configure environment variables (optional):
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the server:
```bash
go run cmd/server/main.go
```

The backend will start on `http://localhost:8080`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

## API Endpoints

### Service Catalog
- `GET /api/v1/services` - List all services
- `GET /api/v1/services/:id` - Get service details
- `POST /api/v1/services` - Register new service

### Secret Management
- `GET /api/v1/secrets` - List available cloud credentials

### Provisioning
- `POST /api/v1/provision` - Create cloud resources

### Health Check
- `GET /health` - Server health status

## Metadata Repository Structure

Services are defined in a separate GitHub repository with the following structure:

```yaml
# Example: services/payments-service.yaml
id: payments-service-go
name: payments-service-go
team: Team Fintech
description: Core payment processing microservice handling Stripe and PayPal webhooks.
environment: Production  # Production, Staging, Experimental
language: Go
tags:
  - go
  - payments
  - critical
repository: https://github.com/company/payments-service
owner: fintech-team
grafana_url: https://grafana.company.com/d/payments
confluence_url: https://confluence.company.com/payments
```

## Environment Variables

### Backend (.env)
```bash
PORT=8080
METADATA_REPO_URL=https://github.com/your-org/service-metadata
METADATA_REPO_BRANCH=main
GITHUB_TOKEN=your_github_token_here
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Design System

The application uses a custom design system with:

- **Primary Colors**: Green-blue gradient (#10b981 to #06b6d4)
- **Background**: White (#ffffff)
- **Typography**: Inter font family
- **Components**: Cards, badges, buttons with gradient accents
- **Animations**: Smooth transitions and hover effects

## Technology Stack

### Backend
- **Language**: Go
- **Web Framework**: Native net/http
- **Architecture**: Clean architecture with handlers, services, and repositories

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules
- **State Management**: React hooks

## Future Enhancements

- [ ] GitHub metadata repository integration
- [ ] HashiCorp Vault integration for secret management
- [ ] AWS/Azure SDK integration for actual provisioning
- [ ] Authentication and authorization (OAuth/SAML)
- [ ] Service health monitoring
- [ ] Deployment pipeline integration
- [ ] Cost tracking and reporting
- [ ] Team management and RBAC

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
