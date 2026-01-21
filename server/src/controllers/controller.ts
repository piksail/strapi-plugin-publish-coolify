import type { Core } from "@strapi/strapi";

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin("publish-coolify")
      // the name of the service file & the method.
      .service("service")
      .getWelcomeMessage();
  },

  async deploy(ctx) {
    try {
      const result = await strapi
        .plugin("publish-coolify")
        .service("service")
        .triggerDeploy();

      ctx.body = result;
      ctx.status = 200;
    } catch (err: any) {
      strapi.log.error("Deploy controller error:", err);
      ctx.body = {
        success: false,
        error: "Failed to trigger deploy",
        details: err instanceof Error ? err.message : "Unknown error",
      };
      // Preserve the original HTTP status if available, otherwise default to 500
      ctx.status = err.status || 500;
    }
  },

  async listDeployments(ctx) {
    try {
      const skip = parseInt(ctx.query.skip as string) || 0;
      const take = parseInt(ctx.query.take as string) || 10;

      const deployments = await strapi
        .plugin("publish-coolify")
        .service("service")
        .listDeployments(skip, take);

      ctx.body = deployments;
      ctx.status = 200;
    } catch (err: any) {
      strapi.log.error("List deployments controller error:", err);
      ctx.body = {
        success: false,
        error: "Failed to fetch deployments",
        details: err instanceof Error ? err.message : "Unknown error",
      };
      // Preserve the original HTTP status if available, otherwise default to 500
      ctx.status = err.status || 500;
    }
  },
});

export default controller;
