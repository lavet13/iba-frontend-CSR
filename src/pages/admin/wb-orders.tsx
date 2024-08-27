import {
  Center,
  Image,
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Tooltip,
  Spinner,
  Alert,
  AlertIcon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  Stack,
  StackDivider,
  Box,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Button,
  LinkBox,
  LinkOverlay,
  Link,
  useColorModeValue,
  SimpleGrid,
  Container,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  useToast,
  useMediaQuery,
  useTheme,
  InputRightElement,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  CloseButton,
  Flex,
} from '@chakra-ui/react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  FC,
  Fragment,
  useEffect,
  useRef,
  useTransition,
  useDeferredValue,
} from 'react';
import { useInfiniteWbOrders } from '../../features/wb-orders';
import { Waypoint } from 'react-waypoint';
import {
  MutationUpdateWbOrderArgs,
  OrderStatus,
  SearchTypeWbOrders,
} from '../../gql/graphql';
import { useSearchParams } from 'react-router-dom';
import {
  useWbOrderById,
  useUpdateWbOrder,
} from '../../features/wb-order-by-id';
import { Formik, Form, FormikHelpers, FormikProps } from 'formik';
import SelectWrapper from '../../components/select-wrapper';
import { z } from 'zod';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import ClipboardInput from '../../components/clipboard-input';
import queryClient from '../../react-query/query-client';
import { useNewWbOrderSubscription } from '../../hooks/use-new-wb-order-subscription';
import AutoSubmit from '../../components/auto-submit';
import { HiArrowLeft, HiFilter, HiSearch } from 'react-icons/hi';
import { HiArrowLongLeft } from 'react-icons/hi2';
import useIsClient from '../../utils/ssr/use-is-client';
import { useScrollDirection } from 'react-use-scroll-direction';
import { ScrollDirection } from 'react-use-scroll-direction/dist/useScrollDirection';
import { CloseIcon } from '@chakra-ui/icons';

type HandleSubmitProps = (
  values: InitialValues,
  formikHelpers: FormikHelpers<InitialValues>
) => void | Promise<any>;

const statusKeys = Object.values(OrderStatus);

export type StatusKey = (typeof statusKeys)[number];

const statusMapText: Record<StatusKey, string> = {
  ASSEMBLED: 'СОБРАН',
  NOT_ASSEMBLED: 'НЕСОБРАН',
  REJECTED: 'ОТКЛОНЕН',
};

const statusMap: Record<StatusKey, JSX.Element> = {
  NOT_ASSEMBLED: (
    <Alert status='warning' variant='solid'>
      <AlertIcon />
      НЕСОБРАН
    </Alert>
  ),
  ASSEMBLED: (
    <Alert status='success' variant='solid'>
      <AlertIcon />
      СОБРАН
    </Alert>
  ),
  REJECTED: (
    <Alert status='error' variant='solid'>
      <AlertIcon />
      ОТКЛОНЕН
    </Alert>
  ),
};

const statusValues = [
  OrderStatus.Assembled,
  OrderStatus.NotAssembled,
  OrderStatus.Rejected,
] as const;

const Schema = z.object({
  status: z.enum(statusValues, { required_error: 'Нужно выбрать статус!' }),
});

type FormSchema = Omit<z.infer<typeof Schema>, 'status'>;

type InitialValues = FormSchema & { status: StatusKey | '' };

export const take = 30;

const getSortByStatus = (sortByStatusParam: string): OrderStatus | 'ALL' => {
  const validStatuses = new Set(Object.values(OrderStatus));

  const upperCaseParam = sortByStatusParam.toUpperCase();

  if (validStatuses.has(upperCaseParam as OrderStatus)) {
    return upperCaseParam as OrderStatus;
  }

  return 'ALL';
};

const getSearchType = (searchParamValue: string) => {
  const validTypes = new Set(Object.values(SearchTypeWbOrders));

  try {
    const parsed = JSON.parse(searchParamValue);

    if (Array.isArray(parsed)) {
      // Filter out invalid types and ensure all values are of type SearchTypeWbOrders
      const validParsed = parsed.filter((type): type is SearchTypeWbOrders =>
        validTypes.has(type)
      );

      return validParsed.length > 0
        ? validParsed
        : Object.values(SearchTypeWbOrders);
    } else {
      return Object.values(SearchTypeWbOrders);
    }
  } catch (err) {
    return Object.values(SearchTypeWbOrders);
  }
};

const WbOrders: FC = () => {
  const { isClient } = useIsClient();
  const { scrollDirection } = useScrollDirection();
  const deferredScrollDirection = useDeferredValue(scrollDirection);
  const lastScrollDirection = useRef<ScrollDirection>(null);
  if (deferredScrollDirection !== null) {
    lastScrollDirection.current = deferredScrollDirection;
  }
  const theme = useTheme();
  const toast = useToast();
  const formModalRef = useRef<FormikProps<InitialValues>>(null);
  const {
    isOpen: isFilterOpen,
    onOpen: onFilterOpen,
    onClose: onFilterClose,
  } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();
  const [searchParams, setSearchParams] = useSearchParams();
  const wbOrderIdToEdit = searchParams.get('edit')!;

  const [isLargerThanMd] = useMediaQuery(
    `(min-width: ${theme.breakpoints.md})`,
    { ssr: true, fallback: false }
  );

  const searchQuery = searchParams.get('q') ?? '';
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isStaleSearchQuery = searchQuery !== deferredSearchQuery;

  const searchTypeParam = searchParams.get('search_type') ?? '';
  const searchType = getSearchType(searchTypeParam);

  const sortByStatusParam = searchParams.get('sort_by_status') ?? '';
  const sortStatus = getSortByStatus(sortByStatusParam);

  const [isPending, startTransition] = useTransition();

  const {
    data: infWbOrdersResult,
    error: infWbOrdersError,
    isError: isInfWbOrdersError,
    fetchNextPage: fetchNextInfPage,
    hasNextPage: hasNextInfPage,
    isPending: isPendingInfinite,
    isFetching: isFetchingInfinite,
    isFetchingNextPage,
    fetchStatus: fetchStatusInfinite,
    status: statusInfinite,
  } = useInfiniteWbOrders({
    take,
    status: sortStatus,
    query: deferredSearchQuery,
    searchType,
  });

  useEffect(() => {}, [isClient]);

  const { newOrder, error } = useNewWbOrderSubscription();

  useEffect(() => {
    if (newOrder) {
      queryClient.invalidateQueries({ queryKey: ['WbOrders'] });
      toast({
        title: 'Клиент только что оформил заявку',
        description: `Номер заявки: ${newOrder.id}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [newOrder]);

  const {
    data: wbOrderByIdResult,
    fetchStatus,
    status,
  } = useWbOrderById(wbOrderIdToEdit, {
    enabled: !!wbOrderIdToEdit,
  });

  const { mutate: updateWbOrder, variables } = useUpdateWbOrder();

  const initialValues: InitialValues = {
    status: wbOrderByIdResult?.wbOrderById?.status ?? '',
  };

  const handleEditOpen = (id: string) => () => {
    setSearchParams(params => {
      const query = new URLSearchParams(params.toString());

      query.set('edit', id);

      return query;
    });

    onEditOpen();
  };

  const handleEditClose = () => {
    if (formModalRef.current !== null) {
      onEditClose();
      setSearchParams(params => {
        const query = new URLSearchParams(params.toString());
        query.delete('edit');
        return query;
      });
    }
  };

  const handleSubmit: HandleSubmitProps = async (values, actions) => {
    import.meta.env.DEV && console.log('submitted!');
    import.meta.env.DEV && console.log({ values });

    // Check if the status is empty and handle accordingly
    if (!values.status) {
      // Handle the error or set a default status
      // For example, you might want to set a default status or show a validation error
      console.error('Status cannot be empty');
      actions.setSubmitting(false);
      return;
    }

    const payload: MutationUpdateWbOrderArgs = {
      input: {
        id: wbOrderIdToEdit,
        status: values.status,
        name: wbOrderByIdResult?.wbOrderById?.name ?? '',
        phone: wbOrderByIdResult?.wbOrderById?.phone ?? '',
        qrCode: wbOrderByIdResult?.wbOrderById?.qrCode ?? null,
        wbPhone: wbOrderByIdResult?.wbOrderById?.wbPhone ?? null,
        createdAt: wbOrderByIdResult?.wbOrderById?.createdAt ?? 0,
        updatedAt: wbOrderByIdResult?.wbOrderById?.updatedAt ?? 0,
        orderCode: wbOrderByIdResult?.wbOrderById?.orderCode ?? null,
      },
    };

    if (formModalRef.current !== null && formModalRef.current.dirty) {
      updateWbOrder({ ...payload });
    }

    actions.setSubmitting(false);
    handleEditClose();
  };

  useEffect(() => {
    if (wbOrderByIdResult?.wbOrderById) {
      onEditOpen();
    } else {
      onEditClose();
    }
  }, [wbOrderByIdResult]);

  if (isInfWbOrdersError) {
    throw infWbOrdersError;
  }

  const bgUpdated = useColorModeValue('gray.200', 'gray.600');
  const bgAdded = useColorModeValue('green.100', 'green.800');

  return (
    <>
      <Formik
        initialValues={{ sortStatus, searchType }}
        enableReinitialize={true}
        onSubmit={(values, __) => {
          startTransition(() => {
            setSearchParams(params => {
              const query = new URLSearchParams(params.toString());

              query.set('sort_by_status', values.sortStatus);
              query.set('search_type', JSON.stringify(values.searchType));

              return query;
            });
          });
        }}
      >
        {() => (
          <Box
            as={Form}
            position='sticky'
            top={'59px'}
            width='100%'
            bg='chakra-body-bg'
            zIndex={100}
            transform={
              window.scrollY === 0
                ? 'translateY(0)'
                : lastScrollDirection.current === 'DOWN'
                ? 'translateY(-100%)'
                : 'translateY(0)'
            }
            transitionTimingFunction={'ease-in-out'}
            transitionDuration={'fast'}
            transitionProperty='common'
          >
            <Container>
              <SimpleGrid my={2} gap={2} minChildWidth={'230px'}>
                {isLargerThanMd && (
                  <SelectWrapper
                    labelSize={'sm'}
                    size='sm'
                    isLoading={isPending}
                    name='sortStatus'
                    label='Сортировать статус'
                    placeholder='Выберите статус'
                    data={[
                      { label: 'ВСЕ', value: 'ALL' },
                      { label: 'СОБРАН', value: 'ASSEMBLED' },
                      { label: 'НЕСОБРАН', value: 'NOT_ASSEMBLED' },
                      { label: 'ОТКЛОНЕН', value: 'REJECTED' },
                    ]}
                  />
                )}

                {isLargerThanMd && deferredSearchQuery.length !== 0 && (
                  <SelectWrapper
                    isMulti
                    closeMenuOnSelect={false}
                    size='sm'
                    {...(isLargerThanMd
                      ? { label: 'Выберите тип поиска' }
                      : {})}
                    isLoading={isPending}
                    name='searchType'
                    placeholder='Выберите тип поиска'
                    data={[
                      { label: 'ID', value: 'ID' },
                      { label: 'ФИО', value: 'NAME' },
                      { label: 'ТЕЛЕФОН', value: 'PHONE' },
                      { label: 'ТЕЛЕФОН WB', value: 'WB_PHONE' },
                    ]}
                  />
                )}

                {isClient && (
                  <>
                    <InputGroup size='sm' alignSelf='end'>
                      <InputLeftElement pointerEvents={'none'}>
                        {isStaleSearchQuery ? (
                          <Spinner boxSize={4} />
                        ) : (
                          <Icon as={HiSearch} boxSize={4} />
                        )}
                      </InputLeftElement>
                      <Input
                        pr={!isLargerThanMd ? '3.35rem' : undefined}
                        value={searchQuery}
                        onChange={e => {
                          setSearchParams(params => {
                            const query = new URLSearchParams(
                              params.toString()
                            );

                            if (e.target.value.length === 0) {
                              query.delete('q');
                              return query;
                            }

                            query.set('q', e.target.value);
                            return query;
                          });
                        }}
                        placeholder={'Искать заявку...'}
                      />

                      <InputRightElement
                        gap={0.5}
                        pr={'0.2rem'}
                        width={!isLargerThanMd ? 'auto' : '2rem'}
                      >
                        {searchQuery.length !== 0 && (
                          <IconButton
                            variant='ghost'
                            size='xs'
                            aria-label='clear search'
                            onClick={() =>
                              setSearchParams(params => {
                                const query = new URLSearchParams(params);

                                query.delete('q');

                                return query;
                              })
                            }
                            icon={<CloseIcon boxSize={2.5} />}
                          />
                        )}
                        {!isLargerThanMd && (
                          <IconButton
                            variant='ghost'
                            size='xs'
                            aria-label='filter orders'
                            onClick={onFilterOpen}
                            icon={<Icon as={HiFilter} boxSize={4} />}
                          />
                        )}
                      </InputRightElement>
                    </InputGroup>
                  </>
                )}
              </SimpleGrid>
            </Container>
            <AutoSubmit />
          </Box>
        )}
      </Formik>

      {isStaleSearchQuery || isPendingInfinite ? (
        <TableContainer>
          <Table variant='simple' size='sm'>
            <Thead>
              <Tr>
                <Th isNumeric>Номер заявки</Th>
                <Th>ФИО</Th>
                <Th>Телефон</Th>
                <Th>QR-код</Th>
                <Th isNumeric>Код заказа</Th>
                <Th>Телефон Wb</Th>
                <Th>Статус</Th>
                <Th isNumeric>Создано</Th>
                <Th isNumeric>Обновлено</Th>
              </Tr>
            </Thead>

            <Tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <Tr key={i}>
                  <Td isNumeric>
                    <Skeleton height='20px' />
                  </Td>
                  <Td>
                    <Skeleton height='20px' />
                  </Td>
                  <Td>
                    <Skeleton height='20px' />
                  </Td>
                  <Td>
                    <Skeleton height='65px' />
                  </Td>
                  <Td isNumeric>
                    <Skeleton height='20px' />
                  </Td>
                  <Td>
                    <Skeleton height='20px' />
                  </Td>
                  <Td>
                    <Skeleton height='20px' />
                  </Td>
                  <Td isNumeric>
                    <Skeleton height='20px' />
                  </Td>
                  <Td isNumeric>
                    <Skeleton height='20px' />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer>
          <Table variant='simple' size='sm'>
            <Thead>
              <Tr>
                <Th isNumeric>Номер заявки</Th>
                <Th>ФИО</Th>
                <Th>Телефон</Th>
                <Th>QR-код</Th>
                <Th isNumeric>Код заказа</Th>
                <Th>Телефон Wb</Th>
                <Th>Статус</Th>
                <Th>Создано</Th>
                <Th>Обновлено</Th>
              </Tr>
            </Thead>

            <Tbody>
              {infWbOrdersResult.pages.map((group, i, arrGroup) => (
                <Fragment key={i}>
                  {group.wbOrders.edges.length !== 0 ? (
                    group.wbOrders.edges.map(o => {
                      const wbOrderPending =
                        fetchStatusInfinite === 'fetching' &&
                        statusInfinite === 'success' &&
                        variables?.input.id == o.id;

                      if (wbOrderPending) {
                        return (
                          <Tr key={o.id}>
                            <Td isNumeric>
                              <Skeleton height='20px' />
                            </Td>
                            <Td>
                              <Skeleton height='20px' />
                            </Td>
                            <Td>
                              <Skeleton height='20px' />
                            </Td>
                            <Td>
                              <Skeleton height='65px' />
                            </Td>
                            <Td isNumeric>
                              <Skeleton height='20px' />
                            </Td>
                            <Td>
                              <Skeleton height='20px' />
                            </Td>
                            <Td>
                              <Skeleton height='20px' />
                            </Td>
                            <Td isNumeric>
                              <Skeleton height='20px' />
                            </Td>
                            <Td isNumeric>
                              <Skeleton height='20px' />
                            </Td>
                          </Tr>
                        );
                      }

                      return (
                        <Tr
                          key={o.id}
                          transitionTimingFunction={'ease-in-out'}
                          transitionDuration={'fast'}
                          transitionProperty={'common'}
                          {...(variables?.input.id == o.id
                            ? { bg: bgUpdated }
                            : {})}
                          {...(newOrder?.id === o.id ? { bg: bgAdded } : {})}
                          _dark={{ _hover: { background: 'gray.700' } }}
                          _hover={{
                            background: 'gray.100',
                            cursor: 'pointer',
                          }}
                        >
                          <Td onClick={handleEditOpen(o.id)} isNumeric>
                            {o.id}
                          </Td>
                          <Td onClick={handleEditOpen(o.id)}>{o.name}</Td>
                          <Td onClick={handleEditOpen(o.id)}>{o.phone}</Td>
                          <LinkBox as={Td}>
                            {o.qrCode ? (
                              <LinkOverlay
                                href={`/assets/qr-codes/${o.qrCode}`}
                                target={'_blank'}
                                rel='noopener noreferrer'
                              >
                                <Image
                                  width='60px'
                                  rounded='sm'
                                  src={`/assets/qr-codes/${o.qrCode}`}
                                  fallbackSrc='/images/no-preview.webp'
                                  alt='qr-code'
                                />
                              </LinkOverlay>
                            ) : (
                              <Image
                                width='60px'
                                src={`/images/no-preview.webp`}
                                rounded='sm'
                                alt='qr-code'
                              />
                            )}
                          </LinkBox>
                          <Td onClick={handleEditOpen(o.id)} isNumeric>
                            {o.orderCode}
                          </Td>
                          <Td onClick={handleEditOpen(o.id)}>{o.wbPhone}</Td>
                          <Td onClick={handleEditOpen(o.id)}>
                            {statusMap[o.status]}
                          </Td>
                          <Td cursor={'auto'}>
                            <Tooltip
                              label={format(
                                new Date(o.createdAt),
                                'dd.MM.yyyy, HH:mm:ss',
                                {
                                  locale: ru,
                                }
                              )}
                            >
                              {formatDistanceToNow(new Date(o.createdAt), {
                                addSuffix: true,
                                locale: ru,
                                includeSeconds: true,
                              })}
                            </Tooltip>
                          </Td>
                          <Td cursor={'auto'}>
                            <Tooltip
                              label={format(
                                new Date(o.updatedAt),
                                'dd.MM.yyyy, HH:mm:ss',
                                {
                                  locale: ru,
                                }
                              )}
                            >
                              {formatDistanceToNow(new Date(o.updatedAt), {
                                addSuffix: true,
                                locale: ru,
                                includeSeconds: true,
                              })}
                            </Tooltip>
                          </Td>
                        </Tr>
                      );
                    })
                  ) : (
                    <Tr>
                      <Td borderBottom='none' textAlign='center' colSpan={999}>
                        Нет данных
                      </Td>
                    </Tr>
                  )}
                  {i === arrGroup.length - 1 && (
                    <Waypoint
                      onEnter={() =>
                        !isFetchingInfinite &&
                        hasNextInfPage &&
                        fetchNextInfPage()
                      }
                    />
                  )}
                </Fragment>
              ))}
              {isFetchingNextPage &&
                Array.from({ length: 15 }).map((_, i) => (
                  <Tr key={i}>
                    <Td isNumeric>
                      <Skeleton height='20px' />
                    </Td>
                    <Td>
                      <Skeleton height='20px' />
                    </Td>
                    <Td>
                      <Skeleton height='20px' />
                    </Td>
                    <Td>
                      <Skeleton height='65px' />
                    </Td>
                    <Td isNumeric>
                      <Skeleton height='20px' />
                    </Td>
                    <Td>
                      <Skeleton height='20px' />
                    </Td>
                    <Td>
                      <Skeleton height='20px' />
                    </Td>
                    <Td isNumeric>
                      <Skeleton height='20px' />
                    </Td>
                    <Td isNumeric>
                      <Skeleton height='20px' />
                    </Td>
                  </Tr>
                ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
      <Modal size='xl' isOpen={isEditOpen} onClose={handleEditClose}>
        <ModalOverlay />

        <ModalContent>
          <Stack divider={<StackDivider />}>
            <Box>
              <ModalHeader sx={{ display: 'flex', alignItems: 'center' }}>
                Редактировать заявку{' '}
                {fetchStatus === 'fetching' && status === 'success' && (
                  <Spinner />
                )}
              </ModalHeader>
              <ModalCloseButton />
            </Box>
            <ModalBody pb={5}>
              {/* For initial loading */}
              {fetchStatus === 'fetching' && status === 'pending' ? (
                <Center>
                  <Spinner />
                </Center>
              ) : (
                <Formik
                  initialValues={initialValues}
                  validationSchema={toFormikValidationSchema(Schema)}
                  enableReinitialize={true}
                  onSubmit={handleSubmit}
                  innerRef={formModalRef}
                >
                  {({ isSubmitting }) => {
                    return (
                      <Form>
                        <ClipboardInput
                          label='ID'
                          value={wbOrderByIdResult?.wbOrderById?.id}
                        />
                        <ClipboardInput
                          label='ФИО'
                          value={wbOrderByIdResult?.wbOrderById?.name}
                        />
                        <ClipboardInput
                          label='Телефон'
                          value={wbOrderByIdResult?.wbOrderById?.phone}
                        />
                        {wbOrderByIdResult?.wbOrderById?.wbPhone && (
                          <ClipboardInput
                            label='Телефон WB'
                            value={wbOrderByIdResult?.wbOrderById?.wbPhone}
                          />
                        )}

                        {wbOrderByIdResult?.wbOrderById?.orderCode && (
                          <ClipboardInput
                            label='Код для получения заказа'
                            value={wbOrderByIdResult.wbOrderById.orderCode}
                          />
                        )}

                        {wbOrderByIdResult?.wbOrderById?.qrCode && (
                          <Button
                            as={Link}
                            size='lg'
                            variant='outline'
                            href={`/assets/qr-codes/${
                              wbOrderByIdResult?.wbOrderById?.qrCode ?? ''
                            }`}
                            target='_blank'
                          >
                            Посмотреть QR
                          </Button>
                        )}

                        <SelectWrapper
                          name='status'
                          label='Выберите статус'
                          placeholder='Выберите статус'
                          data={Object.entries(statusMapText).map(
                            ([value, label]) => ({
                              label,
                              value,
                            })
                          )}
                        />

                        <Button
                          w={['full', 'auto']}
                          isLoading={isSubmitting}
                          mt={4}
                          type='submit'
                        >
                          Подтвердить
                        </Button>
                      </Form>
                    );
                  }}
                </Formik>
              )}
            </ModalBody>
          </Stack>
        </ModalContent>
      </Modal>
      {!isLargerThanMd && (
        <Drawer size={'full'} isOpen={isFilterOpen} onClose={onFilterClose}>
          <DrawerOverlay />
          <DrawerContent>
            <DrawerHeader
              display='flex'
              alignItems='center'
              gap='2'
              borderBottomWidth='1px'
            >
              <IconButton
                size={'md'}
                onClick={onFilterClose}
                variant={'ghost'}
                aria-label='close filters'
                icon={<Icon as={HiArrowLeft} boxSize='5' />}
              />
              Фильтры
            </DrawerHeader>
            <DrawerBody>
              <Formik
                initialValues={{ sortStatus, searchType }}
                enableReinitialize={true}
                onSubmit={(values, __) => {
                  startTransition(() => {
                    setSearchParams(params => {
                      const query = new URLSearchParams(params.toString());

                      query.set('sort_by_status', values.sortStatus);
                      query.set(
                        'search_type',
                        JSON.stringify(values.searchType)
                      );

                      return query;
                    });
                  });
                }}
              >
                {() => (
                  <Form>
                    <Container>
                      <SimpleGrid gap={2} minChildWidth={'230px'}>
                        <SelectWrapper
                          size='sm'
                          isLoading={isPending}
                          name='sortStatus'
                          label='Сортировать статус'
                          placeholder='Выберите статус'
                          data={[
                            { label: 'ВСЕ', value: 'ALL' },
                            { label: 'СОБРАН', value: 'ASSEMBLED' },
                            { label: 'НЕСОБРАН', value: 'NOT_ASSEMBLED' },
                            { label: 'ОТКЛОНЕН', value: 'REJECTED' },
                          ]}
                        />
                        <SelectWrapper
                          isMulti
                          closeMenuOnSelect={false}
                          size='sm'
                          label='Выберите тип поиска'
                          isLoading={isPending}
                          name='searchType'
                          placeholder='Выберите тип поиска'
                          data={[
                            { label: 'ID', value: 'ID' },
                            { label: 'ФИО', value: 'NAME' },
                            { label: 'ТЕЛЕФОН', value: 'PHONE' },
                            { label: 'ТЕЛЕФОН WB', value: 'WB_PHONE' },
                          ]}
                        />
                      </SimpleGrid>
                    </Container>
                    <AutoSubmit />
                  </Form>
                )}
              </Formik>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
};

export default WbOrders;
