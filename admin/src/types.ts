export type Deployment = {
  id: number;
  application_id: string;
  deployment_uuid: string;
  pull_request_id: number;
  force_rebuild: boolean;
  commit: string;
  status:
    | "finished"
    | "failed"
    | "in_progress"
    | "queued"
    | "cancelled-by-user";
  is_webhook: boolean;
  created_at: string;
  updated_at: string;
  logs: string;
  current_process_id: string;
  restart_only: boolean;
  restarted_at: string;
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
  finished_at: string;
};

export type GetDeploymentsResponse = {
  count: number;
  deployments: Deployment[];
};
