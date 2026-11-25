import type { Core } from "@strapi/strapi";

const destroy = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.plugin("publish-coolify").service("service").stopTrackingDeployments();
};

export default destroy;
