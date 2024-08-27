import { FC, memo, useEffect, useRef } from 'react';

import {
  NumericFormat,
  NumericFormatProps,
  OnValueChange,
} from 'react-number-format';

import { ErrorMessage, FastField, FastFieldProps, useField } from 'formik';
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import type { InputProps } from '@chakra-ui/react';

type NumberInputProps = {
  name: string;
  label: string;
  shouldFocus?: boolean;
} & InputProps &
  NumericFormatProps;

const NumberInput: FC<NumberInputProps> = memo(
  ({ name, label, shouldFocus, ...props }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      shouldFocus && inputRef.current?.focus();
    }, [shouldFocus]);

    return (
      <FastField name={name}>
        {({
          field: { onChange, value, ...field },
          meta,
          form: { setFieldValue },
        }: FastFieldProps) => {
          const { value: unformattedValue } = value;

          const handleOnValueChange: OnValueChange = values => {
            const { formattedValue, value, floatValue } = values;

            setFieldValue(name, { formattedValue, value, floatValue });
          };

          return (
            <FormControl
              isRequired={props.isRequired}
              isInvalid={!!meta.error && meta.touched}
            >
              <FormLabel htmlFor={props.id || name}>{label}</FormLabel>

              <NumericFormat
                {...field}
                value={unformattedValue}
                {...props}
                id={props.id || name}
                customInput={Input}
                decimalScale={0}
                type='tel'
                isAllowed={({ floatValue }) =>
                  typeof floatValue === 'undefined' || floatValue > 0
                }
                valueIsNumericString
                allowNegative={false}
                onValueChange={handleOnValueChange}
                getInputRef={inputRef}
              />

              <ErrorMessage name={name} component={FormErrorMessage} />
            </FormControl>
          );
        }}
      </FastField>
    );
  }
);

export default NumberInput;
