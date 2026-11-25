# Strapi Plugin Publish Coolify

A Strapi plugin that integrates with [Coolify](https://coolify.io/) to trigger deployments of your static site generated (SSG) frontend applications directly from your Strapi admin panel.

## Installation

```bash
pnpm add @piksail/strapi-plugin-publish-coolify
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

The plugin queues deployments with [`POST /api/v1/deploy`](https://coolify.io/docs/api/endpoints/deployments/deploy-by-tag-or-uuid)
and reports request errors in Strapi's admin panel and server logs. Once queued,
Strapi polls [`GET /api/v1/deployments/{uuid}`](https://coolify.io/docs/api/endpoints/deployments/get-deployment-by-uuid)
in the background and forwards new, non-hidden build output to its server logs.
This runs until a terminal deployment status, Strapi shutdown, or one hour.
The Coolify token needs `deploy` and `read`, plus `read:sensitive` access to
the application on Coolify versions that restrict access to deployment
logs. Restrict access to Strapi logs: visible build output may still contain
sensitive information printed by the build itself.

## Development

```bash
# Change version in package.json to "dev" or any other tag you want to use for local development
# context is current plugin directory
pnpx nodemon --watch dist --exec "pnpm run build && npx yalc push"

# In another terminal, in a Strapi project directory
npx yalc add --link @piksail/strapi-plugin-publish-coolify@dev && pnpm install
```
