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

## Development

```bash
# Change version in package.json to "dev" or any other tag you want to use for local development
# context is current plugin directory
pnpx nodemon --watch dist --exec "pnpm run build && npx yalc push"

# In another terminal, in a Strapi project directory
npx yalc add --link @piksail/strapi-plugin-publish-coolify@dev && pnpm install
```
