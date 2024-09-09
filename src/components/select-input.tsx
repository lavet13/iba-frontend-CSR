import { FC, memo } from 'react';

import { ErrorMessage, FastField, FastFieldProps } from 'formik';

import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Select,
  SelectProps,
  Spinner,
} from '@chakra-ui/react';
import { ChevronDownIcon, SpinnerIcon } from '@chakra-ui/icons';

type SelectOption = {
  label: string;
  value: string | number;
};

type SelectInputProps = {
  label?: string;
  name: string;
  placeholder?: string;
  id?: string;
  data: SelectOption[];
  isLoading?: boolean;
} & SelectProps;

const SelectInput: FC<SelectInputProps> = memo(
  ({ label, name, data, isLoading, ...props }) => {
    return (
      <FastField name={name} {...(isLoading ? { isLoading } : {})}>
        {({ field: { value, ...field }, meta }: FastFieldProps) => {
          console.log({ value, isLoading });

          return (
            <FormControl
              isRequired={props.isRequired}
              isInvalid={!!meta.error && meta.touched}
              display='flex'
              flexDirection='column'
              justifyContent='space-between'
            >
              {label && (
                <FormLabel htmlFor={props.id || name}>{label}</FormLabel>
              )}
              <Select
                value={value || ''}
                id={props.id || name}
                alignSelf='end'
                icon={isLoading ? <Spinner fontSize="xs" /> : <ChevronDownIcon />}
                {...field}
                {...props}
              >
                {data.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <ErrorMessage name={name} component={FormErrorMessage} />
            </FormControl>
          );
        }}
      </FastField>
    );
  }
);

export default SelectInput;
