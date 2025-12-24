# GitHub Webhook Setup Guide

This guide explains how to configure GitHub webhooks to automatically sync your catalog when YAML files change.

## Overview

When you push changes to catalog YAML files in your GitHub repository, GitHub will automatically notify your backend, which will trigger a sync to update the projects and services in the database.

## Setup Steps

### 1. Generate a Webhook Secret

First, generate a secure random secret for webhook validation:

```bash
# On macOS/Linux
openssl rand -hex 32

# Or use any secure random string generator
```

Save this secret - you'll need it for both GitHub and your backend configuration.

###2. Configure the Backend

Add the webhook secret to your GitHub configuration in the database:

```sql
UPDATE github_metadata_config 
SET webhook_secret = 'your-generated-secret-here'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

Or update it via the Configuration UI (you'll need to add a webhook_secret field to the UI form).

### 3. Set Up GitHub Webhook

1. Go to your GitHub repository
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:

   **Payload URL**: `https://your-domain.com/api/v1/webhook/github`
   - Replace `your-domain.com` with your actual domain
   - For local testing, use a tool like [ngrok](https://ngrok.com/) to expose localhost

   **Content type**: `application/json`

   **Secret**: Paste the secret you generated in step 1

   **Which events**: Select "Just the push event"

   **Active**: ✅ Check this box

4. Click **Add webhook**

### 4. Test the Webhook

1. Make a change to a YAML file in your `projects/` directory
2. Commit and push to GitHub
3. Check the webhook delivery in GitHub Settings → Webhooks → Recent Deliveries
4. Verify the project was updated in your portal

## How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   GitHub    │  Push   │   Webhook    │  Sync   │  Database   │
│ Repository ├────────►│   Endpoint   ├────────►│   Projects  │
└─────────────┘         └──────────────┘         └─────────────┘
```

1. **Push to GitHub**: You commit changes to YAML files
2. **GitHub sends webhook**: GitHub POSTs to your webhook endpoint
3. **Signature validation**: Backend validates the request using the secret
4. **Parse changes**: Extracts which YAML files were modified
5. **Trigger sync**: Re-imports affected projects from GitHub
6. **Update database**: Projects and services are updated

## Current Limitations

⚠️ **New Projects**: Webhooks can only update **existing** projects. New projects must still be manually imported via the UI because they require team selection.

**Why?** The webhook doesn't have user context to know which team should own a new project. For security and accountability, team assignment must be done manually.

## Webhook URL for Different Environments

- **Production**: `https://portal.yourcompany.com/api/v1/webhook/github`
- **Staging**: `https://staging-portal.yourcompany.com/api/v1/webhook/github`
- **Local (via ngrok)**: ` https://<random-id>.ngrok.io/api/v1/webhook/github`

## Troubleshooting

### Webhook shows failed delivery

1. Check GitHub webhook delivery logs
2. Verify your backend is running and accessible from the internet
3. Check backend logs for error messages
4. Ensure the webhook secret matches in both GitHub and your database

### Projects not updating

1. Verify the changed files are in the configured `projects_path` directory
2. Check they are `.yaml` or `.yml` files
3. Ensure the push was to the configured branch (default: `main`)
4. Check backend logs for sync errors

### Testing Locally

Use [ngrok](https://ngrok.com/) to expose your local backend:

```bash
# Start ngrok
ngrok http 8080

# Use the HTTPS URL in GitHub webhook settings
# Example: https://abc123.ngrok.io/api/v1/webhook/github
```

## Security

- ✅ Webhook signatures are validated using HMAC-SHA256
- ✅ Only push events are processed
- ✅ Only configured branch is monitored
- ✅ Only YAML files in the projects path are synced
- ✅ No authentication tokens are exposed in webhook payloads

## Next Steps

Consider adding:
- UI field for webhook secret in Configuration page
- Webhook delivery logs in the admin panel
- Manual "Sync Now" button for existing projects
- Support for deleting projects when YAML files are removed
