export default {
  default: {
    webhookUrl: process.env.SSG_WEBHOOK_URL || '',
    coolifyToken: process.env.COOLIFY_TOKEN || '',
  },
  validator() {},
};
