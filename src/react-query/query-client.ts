import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createStandaloneToast } from '@chakra-ui/react';
import { isGraphQLRequestError } from '../utils/graphql/is-graphql-request-error';

const { toast } = createStandaloneToast();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      import.meta.env.DEV && console.log({ state: query.state });

      if(query.meta) {
        if(query.meta.toastEnabled === false) return;
      }

      if (isGraphQLRequestError(error)) {
        toast({
          title: 'Ошибка',
          description: error.response.errors[0].message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } else if (error instanceof Error) {
        toast({
          title: 'Ошибка',
          description: `${error.message} (╯‵□′)╯︵┻━┻`,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10, // it was 15 min
      gcTime: 1000 * 60 * 60 * 24, // garbage collected in 24 hours
    },
  },
});

export default queryClient;
