import { Main } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { useState } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';

import { getTranslation } from '../utils/getTranslation';
import { Box, Button, Typography } from '@strapi/design-system';

const HomePage = () => {
  const { formatMessage } = useIntl();
  const { post } = useFetchClient();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onClick = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await post('/ssg/deploy');

      if (response.data.success) {
        setMessage('✅ Déploiement déclenché avec succès!');
      } else {
        setMessage('❌ Erreur: ' + (response.data.details || 'Échec du déploiement'));
      }
    } catch (error) {
      console.error('Deploy error:', error);
      setMessage('❌ Erreur: Impossible de déclencher le déploiement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Main>
      <Box padding={8}>
        <Typography variant="alpha" marginBottom={4}>
          Publication du site
        </Typography>
        <Typography variant="beta" marginBottom={2}>
          Plugin {formatMessage({ id: getTranslation('plugin.name') })}
        </Typography>
        <Typography marginBottom={4}>
          Ceci va intégrer le contenu que vous avez mis à jour depuis le dernier déclenchement de ce
          bouton.
        </Typography>
        <Button onClick={onClick} loading={isLoading} disabled={isLoading}>
          {isLoading ? 'Publication en cours...' : 'Publier'}
        </Button>
        {message && (
          <Typography
            marginTop={4}
            textColor={message.startsWith('✅') ? 'success600' : 'danger600'}
          >
            {message}
          </Typography>
        )}
      </Box>
    </Main>
  );
};

export { HomePage };
