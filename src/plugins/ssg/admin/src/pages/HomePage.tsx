import { Main } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';

import { getTranslation } from '../utils/getTranslation';
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
} from '@strapi/design-system';

interface Deployment {
  id: number;
  deployment_uuid: string;
  status: string;
  commit: string;
  commit_message: string;
  created_at: string;
  finished_at: string;
  updated_at: string;
  is_webhook: boolean;
  is_api: boolean;
  application_name: string;
}

const HomePage = () => {
  const { formatMessage } = useIntl();
  const { post, get } = useFetchClient();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, []);

  // Use a ref to store interval id so we can clear it from callbacks
  const pollingRef = useRef<number | null>(null);
  const POLL_INTERVAL_MS = 30_000; // 30 seconds; adjust if needed

  const fetchDeployments = useCallback(async () => {
    // mark loading and fetch
    setIsLoadingDeployments(true);
    try {
      const response = await get('/ssg/deployments');

      // Handle the response structure: { count: number, deployments: array }
      const data = response.data;
      if (data && Array.isArray(data.deployments)) {
        setDeployments(data.deployments);
      } else if (Array.isArray(data)) {
        setDeployments(data);
      } else {
        setDeployments([]);
      }
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
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

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDeployments]);

  const onClick = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await post('/ssg/deploy');

      if (response.data.success) {
        setMessage('✅ ' + formatMessage({ id: getTranslation('message.deploy.success') }));
        // Refresh deployments list after triggering deploy
        setTimeout(() => fetchDeployments(), 2000);
      } else {
        setMessage(
          '❌ ' +
            formatMessage({ id: getTranslation('message.deploy.error') }) +
            ': ' +
            (response.data.details ||
              formatMessage({ id: getTranslation('message.deploy.failed') }))
        );
      }
    } catch (error) {
      console.error('Deploy error:', error);
      setMessage(
        '❌ ' +
          formatMessage({ id: getTranslation('message.deploy.error') }) +
          ': ' +
          formatMessage({ id: getTranslation('message.deploy.unable') })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'finished':
        return 'success600';
      case 'failed':
        return 'danger600';
      case 'in_progress':
        return 'warning600';
      case 'queued':
        return 'secondary600';
      case 'cancelled-by-user':
        return 'neutral600';
      default:
        return 'neutral600';
    }
  };

  const getStatusLabel = (status: string) => {
    // Build the translation key relative to the plugin, e.g.:
    // getTranslation('deployment.status.queued') -> 'ssg.deployment.status.queued'
    const keySuffix = `deployment.status.${status.toLowerCase().replace(/-/g, '_')}`;
    const id = getTranslation(keySuffix);

    return formatMessage({ id, defaultMessage: status });
  };

  return (
    <Main>
      <Box padding={8}>
        <Typography variant="alpha" marginBottom={4}>
          {formatMessage({ id: getTranslation('page.title') })}
        </Typography>
        <Button
          marginLeft={2}
          onClick={onClick}
          loading={isLoading}
          disabled={isLoading}
          title={
            isLoading
              ? formatMessage({ id: getTranslation('button.publishing') })
              : formatMessage({ id: getTranslation('button.publishInfo') })
          }
        >
          {isLoading
            ? formatMessage({ id: getTranslation('button.publishing') })
            : formatMessage({ id: getTranslation('button.publish') })}
        </Button>
        <br />
        {/* <Typography variant="beta" marginBottom={2}>
          Plugin {formatMessage({ id: getTranslation('plugin.name') })}
        </Typography> */}
        <br />
        <Typography marginBottom={4}>
          {formatMessage({ id: getTranslation('page.description') })}
        </Typography>
        <br />

        {message && (
          <Typography
            marginTop={4}
            textColor={message.startsWith('✅') ? 'success600' : 'danger600'}
          >
            {message}
          </Typography>
        )}

        <Box marginTop={8}>
          <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
            <Flex direction="column" alignItems="flex-start">
              <Typography variant="beta">
                {formatMessage({ id: getTranslation('deployments.title') })}
              </Typography>
              {lastRefreshTime && (
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({ id: getTranslation('deployments.lastRefresh') })} :{' '}
                  {formatDate(lastRefreshTime.toISOString())} (
                  {formatMessage({ id: getTranslation('deployments.everyRefresh') })}{' '}
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
              {formatMessage({ id: getTranslation('button.refresh') })}
            </Button>
          </Flex>

          <Table>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({ id: getTranslation('deployments.table.status') })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({ id: getTranslation('deployments.table.startDate') })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({ id: getTranslation('deployments.table.endDate') })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({ id: getTranslation('deployments.table.source') })}
                  </Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {deployments.length === 0 && !isLoadingDeployments ? (
                <Tr>
                  <Td colSpan={4}>
                    <Typography>
                      {formatMessage({ id: getTranslation('deployments.empty') })}
                    </Typography>
                  </Td>
                </Tr>
              ) : (
                Array.isArray(deployments) &&
                deployments.map((deployment) => (
                  <Tr key={deployment.id}>
                    <Td>
                      <Typography textColor={getStatusColor(deployment.status)}>
                        {getStatusLabel(deployment.status)}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography>{formatDate(deployment.created_at)}</Typography>
                    </Td>
                    <Td>
                      <Typography>{formatDate(deployment.finished_at)}</Typography>
                    </Td>
                    <Td>
                      <Typography>
                        {deployment.is_webhook
                          ? '🔗 ' +
                            formatMessage({ id: getTranslation('deployments.source.webhook') })
                          : deployment.is_api
                            ? '⚡ ' +
                              formatMessage({ id: getTranslation('deployments.source.api') })
                            : '🖱️ ' +
                              formatMessage({ id: getTranslation('deployments.source.manual') })}
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
