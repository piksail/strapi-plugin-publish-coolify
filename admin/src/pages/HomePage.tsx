import { useState, useEffect, useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { Main } from "@strapi/design-system";
import { Rocket } from "@strapi/icons";
import { useFetchClient } from "@strapi/strapi/admin";
import {
  Box,
  Button,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  Flex,
} from "@strapi/design-system";
import { formatDate } from "../utils/date";
import { getTranslation } from "../utils/getTranslation";
import { Deployment, GetDeploymentsResponse } from "../types";
import { getDeploymentStatusColor } from "../utils/getDeploymentStatusColor";

const POLL_INTERVAL_MS = 30_000; // 30 seconds; adjust if needed

const HomePage = () => {
  const { formatMessage } = useIntl();
  const { post, get } = useFetchClient();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, []);

  // Use a ref to store interval id so we can clear it from callbacks
  const pollingRef = useRef<number | null>(null);

  const fetchDeployments = useCallback(async () => {
    setIsLoadingDeployments(true);
    try {
      const response = await get<GetDeploymentsResponse>(
        "/publish-coolify/deployments"
      );
      const { data } = response;
      setDeployments(data.deployments ?? []);
    } catch (error) {
      console.error("Failed to request deployments:", error);
      // Show user-friendly error for debugging
      if (error && typeof error === "object" && "response" in error) {
        const err = error as any;
        console.error("Response status:", err.response?.status);
        console.error("Response data:", err.response?.data);
      }
      setDeployments([]);
    } finally {
      setIsLoadingDeployments(false);
      setLastRefreshTime(new Date());
    }
  }, [get]);

  useEffect(() => {
    // start polling when component mounts
    const startPolling = () => {
      if (pollingRef.current == null) {
        pollingRef.current = window.setInterval(() => {
          fetchDeployments();
        }, POLL_INTERVAL_MS) as unknown as number;
      }
    };

    const stopPolling = () => {
      if (pollingRef.current != null) {
        clearInterval(pollingRef.current as number);
        pollingRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // pause polling when tab is hidden
        stopPolling();
      } else {
        // when visible again fetch once and resume polling
        fetchDeployments();
        startPolling();
      }
    };

    // initial fetch and start polling
    fetchDeployments();
    startPolling();

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDeployments]);

  const onClick = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await post("/publish-coolify/deploy");

      if (response.data.success) {
        setMessage(
          "✅ " +
            formatMessage({ id: getTranslation("message.deploy.success") })
        );
        // Refresh deployments list after triggering deploy
        setTimeout(() => fetchDeployments(), 2000);
      } else {
        setMessage(
          "❌ " +
            formatMessage({ id: getTranslation("message.deploy.error") }) +
            ": " +
            (response.data.details ||
              formatMessage({ id: getTranslation("message.deploy.failed") }))
        );
      }
    } catch (error) {
      console.error("Deploy error:", error);
      setMessage(
        "❌ " +
          formatMessage({ id: getTranslation("message.deploy.error") }) +
          ": " +
          formatMessage({ id: getTranslation("message.deploy.unable") })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // TODO just because file rename broke somehow
  const getStatusColor = (status: Deployment["status"]) => {
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

  const getStatusLabel = (status: string) => {
    // Build the translation key relative to the plugin, e.g.:
    // getTranslation('deployment.status.queued') -> 'ssg.deployment.status.queued'
    const keySuffix = `deployment.status.${status.toLowerCase().replace(/-/g, "_")}`;
    const id = getTranslation(keySuffix);

    return formatMessage({ id, defaultMessage: status });
  };

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent={{ initial: "space-between" }} gap={16}>
          <Typography variant="alpha" tag="h1">
            {formatMessage({ id: getTranslation("page.title") })}
          </Typography>
          <Button
            startIcon={<Rocket />}
            size="L"
            onClick={onClick}
            loading={isLoading}
            disabled={isLoading}
            title={
              isLoading
                ? formatMessage({ id: getTranslation("button.publishing") })
                : formatMessage({ id: getTranslation("button.publishInfo") })
            }
          >
            {isLoading
              ? formatMessage({ id: getTranslation("button.publishing") })
              : formatMessage({ id: getTranslation("button.publish") })}
          </Button>
        </Flex>
        <br />
        {/* <Typography variant="beta" marginBottom={2}>
          Plugin {formatMessage({ id: getTranslation('plugin.name') })}
        </Typography> */}
        <br />
        <Typography variant="delta" tag="p" textColor="neutral600">
          {formatMessage({ id: getTranslation("page.description") })}
        </Typography>
        <br />

        {message && (
          <Typography
            marginTop={4}
            textColor={message.startsWith("✅") ? "success600" : "danger600"}
          >
            {message}
          </Typography>
        )}

        <Box marginTop={8}>
          <Flex
            justifyContent="space-between"
            alignItems="center"
            marginBottom={4}
          >
            <Flex direction="column" alignItems="flex-start">
              <Typography variant="beta" tag="h2">
                {formatMessage({ id: getTranslation("deployments.title") })}
              </Typography>
              {lastRefreshTime && (
                <Typography variant="sigma" textColor="neutral600">
                  {formatMessage({
                    id: getTranslation("deployments.lastRefresh"),
                  })}{" "}
                  : {formatDate(new Date(lastRefreshTime.toISOString()))} (
                  {formatMessage({
                    id: getTranslation("deployments.everyRefresh"),
                  })}{" "}
                  {POLL_INTERVAL_MS / 1000}s)
                </Typography>
              )}
            </Flex>
            <Button
              onClick={fetchDeployments}
              loading={isLoadingDeployments}
              disabled={isLoadingDeployments}
              variant="secondary"
              size="S"
            >
              {formatMessage({ id: getTranslation("button.refresh") })}
            </Button>
          </Flex>

          <Table>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation("deployments.table.status"),
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation("deployments.table.startDate"),
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation("deployments.table.endDate"),
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation("deployments.table.source"),
                    })}
                  </Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {deployments.length === 0 && !isLoadingDeployments ? (
                <Tr>
                  <Td colSpan={4}>
                    <Typography>
                      {formatMessage({
                        id: getTranslation("deployments.empty"),
                      })}
                    </Typography>
                  </Td>
                </Tr>
              ) : (
                deployments.map((deployment) => (
                  <Tr key={deployment.id}>
                    <Td>
                      <Typography
                        textColor={getDeploymentStatusColor(deployment.status)}
                      >
                        {getStatusLabel(deployment.status)}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography>
                        {formatDate(new Date(deployment.created_at))}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography>
                        {formatDate(new Date(deployment.finished_at))} (
                        {deployment.finished_at &&
                          new Date(
                            deployment.finished_at
                          ).getUTCMilliseconds() -
                            new Date(
                              deployment.created_at
                            ).getUTCMilliseconds()}
                        )
                      </Typography>
                    </Td>
                    <Td>
                      <Typography>
                        {deployment.is_webhook
                          ? "🔗 " +
                            formatMessage({
                              id: getTranslation("deployments.source.webhook"),
                            }) +
                            " (Piksail)"
                          : deployment.is_api
                            ? "⚡ " +
                              formatMessage({
                                id: getTranslation("deployments.source.api"),
                              })
                            : "🖱️ " +
                              formatMessage({
                                id: getTranslation("deployments.source.manual"),
                              })}
                      </Typography>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Main>
  );
};

export { HomePage };
