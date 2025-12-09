import type { Core } from "@strapi/strapi";
import { log } from "console";

interface SsgConfig {
  coolifyToken?: string;
  coolifyApiUrl?: string;
  coolifyAppUuid?: string;
}

export interface Deployment {
  id: number;
  application_id: string;
  deployment_uuid: string;
  pull_request_id: number;
  force_rebuild: boolean;
  commit: string;
  status: string;
  is_webhook: boolean;
  created_at: string;
  updated_at: string;
  finished_at: string;
  current_process_id: string;
  restart_only: boolean;
  git_type: string | null;
  server_id: number;
  application_name: string;
  server_name: string;
  deployment_url: string;
  destination_id: string;
  only_this_server: boolean;
  rollback: boolean;
  commit_message: string;
  is_api: boolean;
  build_server_id: string | null;
  horizon_job_id: string;
  horizon_job_worker: string;
}

export interface DeploymentsResponse {
  count: number;
  deployments: Deployment[];
}

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  getWelcomeMessage() {
    return "Welcome to Strapi 🚀";
  },

  async triggerDeploy() {
    const pluginStore = strapi.store({
      type: "plugin",
      name: "publish-coolify",
    });

    const config = strapi.config.get("plugin::publish-coolify") as SsgConfig;

    if (!config.coolifyToken) {
      throw new Error(
        "Coolify token is not configured. Please set SSG_COOLIFY_TOKEN environment variable."
      );
    }
    const deploymentUrl = `${config.coolifyApiUrl}/deploy?uuid=${config.coolifyAppUuid}&force=false`;

    try {
      const response = await fetch(deploymentUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + config.coolifyToken,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Webhook request failed with status ${response.status}`
        );
      }

      const result = await response.text();

      return {
        success: true,
        message: "Deploy triggered successfully",
        timestamp: new Date().toISOString(),
        response: result,
      };
    } catch (error) {
      strapi.log.error("Failed to trigger deploy webhook:", error);
      throw error;
    }
  },

  async listDeployments(skip: number = 0, take: number = 10) {
    const config = strapi.config.get("plugin::publish-coolify") as SsgConfig;
    const { coolifyApiUrl, coolifyAppUuid, coolifyToken } = config;

    if (!coolifyApiUrl || !coolifyAppUuid || !coolifyToken) {
      throw new Error(
        "Coolify settings not configured. Please set COOLIFY_API_URL, COOLIFY_APP_UUID, and COOLIFY_TOKEN environment variables."
      );
    }

    try {
      const url = `${coolifyApiUrl}/deployments/applications/${coolifyAppUuid}?skip=${skip}&take=${take}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coolifyToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.status}`);
      }

      const data = (await response.json()) as DeploymentsResponse;

      // Patch finished_at to match the ISO format of created_at
      if (data.deployments) {
        data.deployments = data.deployments.map((deployment) => {
          if (deployment.finished_at) {
            // Check if it's in the format "YYYY-MM-DD HH:MM:SS" (without T)
            const datePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
            if (datePattern.test(deployment.finished_at)) {
              // Convert "2025-10-31 11:06:08" to "2025-10-31T11:06:08.000000Z"
              deployment.finished_at =
                deployment.finished_at.replace(" ", "T") + ".000000Z";
            }
          }
          return deployment;
        });
      }

      return data;
    } catch (error) {
      strapi.log.error("Failed to fetch deployments:", error);
      throw error;
    }
  },
});

export default service;
