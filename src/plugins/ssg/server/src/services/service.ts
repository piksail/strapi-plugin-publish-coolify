import type { Core } from '@strapi/strapi';

interface SsgConfig {
  webhookUrl?: string;
  coolifyToken?: string;
}

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  getWelcomeMessage() {
    return 'Welcome to Strapi 🚀';
  },

  async triggerDeploy() {
    const pluginStore = strapi.store({
      type: 'plugin',
      name: 'ssg',
    });

    const config = strapi.config.get('plugin::ssg') as SsgConfig;
    const webhookUrl = config?.webhookUrl;

    if (!webhookUrl) {
      throw new Error(
        'Webhook URL is not configured. Please set SSG_WEBHOOK_URL environment variable.'
      );
    } else {
      console.log('Using webhook URL:', webhookUrl);
    }

    if (!config.coolifyToken) {
      throw new Error(
        'Coolify token is not configured. Please set SSG_COOLIFY_TOKEN environment variable.'
      );
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + config.coolifyToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed with status ${response.status}`);
      }

      const result = await response.text();

      return {
        success: true,
        message: 'Deploy triggered successfully',
        timestamp: new Date().toISOString(),
        response: result,
      };
    } catch (error) {
      strapi.log.error('Failed to trigger deploy webhook:', error);
      throw error;
    }
  },
});

export default service;
