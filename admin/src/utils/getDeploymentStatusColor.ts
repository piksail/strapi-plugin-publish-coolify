import { Deployment } from "../types";

export const getDeploymentStatusColor = (status: Deployment["status"]) => {
  switch (status) {
    case "finished":
      return "success600";
    case "failed":
      return "danger600";
    case "in_progress":
      return "warning600";
    case "queued":
      return "secondary600";
    case "cancelled-by-user":
      return "neutral600";
    default:
      return "neutral600";
  }
};
