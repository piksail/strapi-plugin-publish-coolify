# Strapi Plugin Publish Coolify

A Strapi plugin that integrates with [Coolify](https://coolify.io/) to trigger deployments of your static site generated (SSG) frontend applications directly from your Strapi admin panel.

## Installation

```bash
pnpm add strapi-plugin-publish-coolify
```

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Coolify API Configuration
COOLIFY_TOKEN=your_coolify_api_token
COOLIFY_API_URL=https://your-coolify-instance.com/api/v1
COOLIFY_APP_UUID=your_application_uuid
```
