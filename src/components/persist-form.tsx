import * as React from 'react';
import { connect, FormikProps } from 'formik';
import _ from 'lodash';
import isEqual from 'react-fast-compare';

export interface PersistProps {
  name: string;
  debounce?: number;
  ignore?: string[];
  storage?: Storage;
  onFormSubmit?: () => void;
  handleValidation?: (values: any) => void;
}

class PersistImpl extends React.Component<
  PersistProps & { formik: FormikProps<any> },
  {}
> {
  static defaultProps = {
    ignore: [],
  };

  saveForm = (data: FormikProps<{}>) => {
    const { ignore = [], storage = window.localStorage, name } = this.props;
    data.values = _.omit(data.values, ignore);

    if (data.status === 'submitted') {
      storage.removeItem(name);
      return;
    }

    storage.setItem(name, JSON.stringify(data));
  };

  componentDidUpdate(
    prevProps: Readonly<PersistProps & { formik: FormikProps<any> }>
  ): void {
    if (!isEqual(prevProps.formik, this.props.formik)) {
      if (
        this.props.formik.submitCount > prevProps.formik.submitCount &&
        this.props.formik.status === undefined // by default it's undefined so...
      ) {
        this.handleFormSubmit();
      } else {
        this.saveForm(this.props.formik);
      }
    }
  }

  componentDidMount(): void {
    const {
      storage = window.localStorage,
      formik,
      name,
      handleValidation,
    } = this.props;

    if (!name) {
      throw new Error('No name provided as prop for Persist');
    }

    if (!formik) {
      throw new Error('FormikStore must be wrapped in Formik');
    }

    Promise.resolve(storage.getItem(name)).then(storageState => {
      if (storageState !== null) {
        let parsedState;
        if (typeof storageState === 'object') {
          parsedState = storageState;
        } else if (typeof storageState === 'string') {
          parsedState = JSON.parse(storageState);
        }

        parsedState.isSubmitting = false;

        formik.setFormikState(parsedState);
      }

      if (handleValidation) {
        handleValidation(
          storageState !== null
            ? JSON.parse(storageState)?.values
            : this.props.formik.values
        );
      }
    });
  }

  handleFormSubmit = () => {
    if (this.props.onFormSubmit) {
      this.props.onFormSubmit();
    }
  };

  render() {
    return null;
  }
}

export const Persist = connect<PersistProps, any>(PersistImpl);
