export default {
  default: {
    webhookUrl: process.env.SSG_WEBHOOK_URL || '',
    coolifyToken: process.env.COOLIFY_TOKEN || '',
    coolifyApiUrl: process.env.COOLIFY_API_URL || '',
    coolifyAppUuid: process.env.COOLIFY_APP_UUID || '',
  },
  validator() {},
};
