import { Main } from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { getTranslation } from '../utils/getTranslation';
import { Box, Button,Typography } from '@strapi/design-system';

const HomePage = () => {
  const { formatMessage } = useIntl();

  const onClick = () => {
    // TODO déclencher appel API rebuild
  }

  return (
    <Main>
      <Box>
        <Typography>Publication du site</Typography>
        <Typography>Plugin {formatMessage({ id: getTranslation('plugin.name') })}</Typography>
        <Typography>Ceci va intégrer le contenu que vous avez mis à jour depuis le dernier déclenchement de ce bouton.</Typography>
        <Button onClick={onClick}>Publier</Button>
      </Box>
    </Main>
  );
};

export { HomePage };
