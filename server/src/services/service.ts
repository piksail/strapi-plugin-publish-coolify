import type { Core } from "@strapi/strapi";
import { setTimeout as delay } from "node:timers/promises";

const REQUEST_TIMEOUT_MS = 15_000;
const LOG_POLL_INTERVAL_MS = 5_000;
const LOG_POLL_TIMEOUT_MS = 60 * 60_000;
const FINAL_STATUSES = new Set([
  "finished",
  "failed",
  "cancelled-by-user",
  "skipped",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

interface SsgConfig {
  coolifyToken?: string;
  coolifyApiUrl?: string;
  coolifyAppUuid?: string;
}

type CoolifyConfig = Required<SsgConfig>;

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
  logs?: string | null;
  configuration_snapshot?: unknown;
  configuration_diff?: unknown;
}

export interface DeploymentsResponse {
  count: number;
  deployments: Deployment[];
}

const service = ({ strapi }: { strapi: Core.Strapi }) => {
  const shutdown = new AbortController();
  const trackedDeployments = new Set<string>();

  const getConfig = (): CoolifyConfig => {
    const { coolifyApiUrl, coolifyAppUuid, coolifyToken } =
      strapi.config.get<SsgConfig>("plugin::publish-coolify");

    if (!coolifyApiUrl || !coolifyAppUuid || !coolifyToken) {
      throw new Error(
        "Coolify settings not configured. Please set COOLIFY_API_URL, COOLIFY_APP_UUID, and COOLIFY_TOKEN environment variables.",
      );
    }
    return {
      coolifyApiUrl: coolifyApiUrl.replace(/\/+$/, ""),
      coolifyAppUuid,
      coolifyToken,
    };
  };

  const trackDeployment = async (config: CoolifyConfig, uuid: string) => {
    const prefix = `Coolify deployment ${uuid}`;
    const deadline = AbortSignal.timeout(LOG_POLL_TIMEOUT_MS);
    const signal = AbortSignal.any([shutdown.signal, deadline]);
    const url = `${config.coolifyApiUrl}/deployments/${encodeURIComponent(uuid)}`;
    let nextEntry = 0;
    let failures = 0;
    let sawFinalStatus = false;

    try {
      while (!signal.aborted) {
        let deployment: unknown;
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${config.coolifyToken}` },
            signal: AbortSignal.any([
              signal,
              AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            ]),
          });
          if (!response.ok) {
            throw new HttpError(
              `HTTP ${response.status} while reading deployment`,
              response.status,
            );
          }
          deployment = await response.json();
          failures = 0;
        } catch (error) {
          if (signal.aborted) throw error;
          failures++;
          if (
            failures >= 3 ||
            (error instanceof HttpError &&
              error.status < 500 &&
              error.status !== 429)
          ) {
            throw error;
          }
          strapi.log.warn(
            `${prefix}: log polling failed; retrying (${String(error)})`,
          );
          await delay(LOG_POLL_INTERVAL_MS * 2 ** (failures - 1), undefined, {
            signal,
            ref: false,
          });
          continue;
        }

        if (!isRecord(deployment) || typeof deployment.status !== "string") {
          throw new Error("Invalid deployment status response from Coolify");
        }
        if (deployment.logs != null && deployment.logs !== "") {
          const entries: unknown =
            typeof deployment.logs === "string"
              ? JSON.parse(deployment.logs)
              : deployment.logs;
          if (!Array.isArray(entries)) {
            throw new Error("Invalid deployment log format from Coolify");
          }
          // Coolify returns the full append-only log on every poll.
          for (const entry of entries.slice(nextEntry)) {
            if (
              !isRecord(entry) ||
              entry.hidden !== false ||
              typeof entry.output !== "string"
            ) {
              continue;
            }
            const output = entry.output
              .split(config.coolifyToken)
              .join("[redacted]");
            for (const line of output.split(/\r?\n/)) {
              if (!line) continue;
              if (entry.type === "stderr")
                strapi.log.warn(`${prefix}: ${line}`);
              else strapi.log.info(`${prefix}: ${line}`);
            }
          }
          nextEntry = entries.length;
        }

        const { status } = deployment;
        if (sawFinalStatus && FINAL_STATUSES.has(status)) {
          if (!("logs" in deployment)) {
            strapi.log.warn(
              `${prefix}: Coolify omitted logs; check the token's sensitive-read permission`,
            );
          }
          if (status === "failed") strapi.log.error(`${prefix}: ${status}`);
          else strapi.log.info(`${prefix}: ${status}`);
          return;
        }

        // Coolify can save final failure output after updating the deployment status.
        sawFinalStatus = FINAL_STATUSES.has(status);
        await delay(LOG_POLL_INTERVAL_MS, undefined, { signal, ref: false });
      }
    } catch (error) {
      if (!signal.aborted) {
        strapi.log.error(
          `${prefix}: could not forward logs (${String(error)})`,
        );
      }
    } finally {
      if (deadline.aborted && !shutdown.signal.aborted) {
        strapi.log.warn(`${prefix}: stopped forwarding logs after 1 hour`);
      }
      trackedDeployments.delete(uuid);
    }
  };

  return {
    stopTrackingDeployments() {
      shutdown.abort();
    },

    getWelcomeMessage() {
      return "Welcome to Strapi 🚀";
    },

    async triggerDeploy() {
      const config = getConfig();
      const params = new URLSearchParams({
        uuid: config.coolifyAppUuid,
        force: "false",
      });
      const deploymentUrl = `${config.coolifyApiUrl}/deploy?${params}`;

      const response = await fetch(deploymentUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.coolifyToken,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new HttpError(
          `Coolify deploy request failed: ${errorText || response.statusText}`,
          response.status,
        );
      }

      const result = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(result);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new HttpError("Coolify returned an invalid deploy response", 502);
      }
      const deployment: unknown =
        isRecord(payload) && Array.isArray(payload.deployments)
          ? payload.deployments.find(
              (entry: unknown) =>
                isRecord(entry) &&
                entry.resource_uuid === config.coolifyAppUuid,
            )
          : undefined;
      if (
        !isRecord(deployment) ||
        typeof deployment.deployment_uuid !== "string" ||
        !deployment.deployment_uuid
      ) {
        const message =
          isRecord(deployment) && typeof deployment.message === "string"
            ? `: ${deployment.message}`
            : "";
        throw new HttpError(
          `Coolify did not return a deployment UUID${message}`,
          502,
        );
      }

      const uuid = deployment.deployment_uuid;
      if (!trackedDeployments.has(uuid)) {
        trackedDeployments.add(uuid);
        strapi.log.info(`Coolify deployment ${uuid}: queued`);
        void trackDeployment(config, uuid);
      }

      return {
        success: true,
        message: "Deploy triggered successfully",
        timestamp: new Date().toISOString(),
        response: result,
        deploymentUuid: uuid,
      };
    },

    async listDeployments(skip: number = 0, take: number = 10) {
      const { coolifyApiUrl, coolifyAppUuid, coolifyToken } = getConfig();

      try {
        const url = `${coolifyApiUrl}/deployments/applications/${encodeURIComponent(coolifyAppUuid)}?skip=${skip}&take=${take}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${coolifyToken}`,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new HttpError(
            `Failed to fetch deployments: ${errorText || response.statusText}`,
            response.status,
          );
        }

        const data = (await response.json()) as DeploymentsResponse;

        // Patch finished_at to match the ISO format of created_at
        if (data.deployments) {
          data.deployments = data.deployments.map(
            ({
              logs,
              configuration_snapshot,
              configuration_diff,
              ...deployment
            }) => {
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
            },
          );
        }

        return data;
      } catch (error) {
        strapi.log.error("Failed to fetch deployments:", error);
        throw error;
      }
    },
  };
};

export default service;
