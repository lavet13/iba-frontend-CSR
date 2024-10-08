import { extendTheme, theme as base } from '@chakra-ui/react';
import type { ThemeConfig } from '@chakra-ui/react';

import styles from './styles';
import semanticTokens from './semantic-tokens';

import Select from './components/select';
import Container from './components/container';
import Button from './components/button';
import Card from './components/card';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: true,
};

const theme = extendTheme({
  components: {
    Container,
    Button,
    Card,
    Select,
  },
  config,
  styles,
  fonts: {
    body: `"Golos", "Raleway", ${base.fonts?.body}`,
    heading: `"Golos", "Raleway", ${base.fonts?.heading}`,
    mono: `"Golos", "Raleway", ${base.fonts?.mono}`,
  },
  semanticTokens,
});

export default theme;
