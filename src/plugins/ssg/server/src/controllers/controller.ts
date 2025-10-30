import type { Core } from '@strapi/strapi';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('ssg')
      // the name of the service file & the method.
      .service('service')
      .getWelcomeMessage();
  },

  async deploy(ctx) {
    try {
      const result = await strapi.plugin('ssg').service('service').triggerDeploy();

      ctx.body = result;
      ctx.status = 200;
    } catch (err) {
      strapi.log.error('Deploy controller error:', err);
      ctx.body = {
        success: false,
        error: 'Failed to trigger deploy',
        details: err instanceof Error ? err.message : 'Unknown error',
      };
      ctx.status = 500;
    }
  },
});

export default controller;
