import React from "react";
import { JSONSchema7 } from "json-schema";

import { Field, FieldProps, useField } from "formik";
import { FormattedMessage, useIntl } from "react-intl";
import styled from "styled-components";

import LabeledInput from "../../LabeledInput";
import LabeledDropDown from "../../LabeledDropDown";
import { IDataItem } from "../../DropDown/components/ListItem";
import Instruction from "./Instruction";
import FrequencyConfig from "../../../data/FrequencyConfig.json";
import Spinner from "../../Spinner";
import PropertyField from "./PropertyField";
import {
  FormBaseItem,
  FormBlock,
  WidgetConfigMap
} from "../../../core/form/types";

type IProps = {
  formFields: FormBlock[];
  dropDownData: Array<IDataItem>;
  setFieldValue: (name: string, value: string) => void;
  setUiWidgetsInfo: (path: string, value: object) => void;
  isLoadingSchema?: boolean;
  isEditMode?: boolean;
  allowChangeConnector?: boolean;
  onChangeServiceType?: (id: string) => void;
  formType: "source" | "destination" | "connection";
  values: { name: string; serviceType: string; frequency?: string };
  specifications?: JSONSchema7;
  widgetsInfo: WidgetConfigMap;
  documentationUrl?: string;
};

const FormItem = styled.div`
  margin-bottom: 27px;
`;

const SmallLabeledDropDown = styled(LabeledDropDown)`
  max-width: 202px;
`;

const LoaderContainer = styled.div`
  text-align: center;
  padding: 22px 0 23px;
`;

const FrequencyInput: React.FC = () => {
  const [field, , { setValue }] = useField("frequency");
  const formatMessage = useIntl().formatMessage;
  const dropdownData = React.useMemo(
    () =>
      FrequencyConfig.map(item => ({
        ...item,
        text:
          item.value === "manual"
            ? item.text
            : formatMessage(
                {
                  id: "form.every"
                },
                {
                  value: item.text
                }
              )
      })),
    [formatMessage]
  );

  return (
    <SmallLabeledDropDown
      {...field}
      labelAdditionLength={300}
      label={formatMessage({
        id: "form.frequency"
      })}
      message={formatMessage({
        id: "form.frequency.message"
      })}
      placeholder={formatMessage({
        id: "form.frequency.placeholder"
      })}
      data={dropdownData}
      onSelect={item => setValue(item.value)}
    />
  );
};

const FormContent: React.FC<IProps> = ({
  dropDownData,
  formType,
  setFieldValue,
  values,
  widgetsInfo,
  setUiWidgetsInfo,
  isLoadingSchema,
  isEditMode,
  onChangeServiceType,
  documentationUrl,
  allowChangeConnector,
  formFields
}) => {
  const formatMessage = useIntl().formatMessage;

  const renderItem = (
    formItem: FormBaseItem,
    fieldProps: FieldProps<string>
  ) => {
    switch (formItem.fieldKey) {
      case "name":
        return (
          <LabeledInput
            {...fieldProps.field}
            // error={!!fieldProps.meta.error && fieldProps.meta.touched}
            label={<FormattedMessage id="form.name" />}
            placeholder={formatMessage({
              id: `form.${formType}Name.placeholder`
            })}
            type="text"
            message={formatMessage({
              id: `form.${formType}Name.message`
            })}
          />
        );
      case "serviceType":
        return (
          <>
            <SmallLabeledDropDown
              {...fieldProps.field}
              // error={!!fieldProps.meta.error && fieldProps.meta.touched}
              disabled={isEditMode && !allowChangeConnector}
              label={formatMessage({
                id: `form.${formType}Type`
              })}
              hasFilter
              placeholder={formatMessage({
                id: "form.selectConnector"
              })}
              filterPlaceholder={formatMessage({
                id: "form.searchName"
              })}
              data={dropDownData}
              onSelect={item => {
                setFieldValue("serviceType", item.value);
                if (onChangeServiceType) {
                  onChangeServiceType(item.value);
                }
              }}
            />
            {values.serviceType && formItem.meta?.includeInstruction && (
              <Instruction
                serviceId={values.serviceType}
                dropDownData={dropDownData}
                documentationUrl={documentationUrl}
              />
            )}
          </>
        );
      case "frequency":
        return <FrequencyInput />;
      default:
        return <PropertyField property={formItem} />;
    }
  };

  const renderFormMeta = (formMetaFields: FormBlock[]): React.ReactNode => {
    return formMetaFields.map(formField => {
      if (formField._type === "formGroup") {
        return renderFormMeta(formField.properties);
      } else if (formField._type === "formCondition") {
        const currentlySelectedCondition =
          widgetsInfo[formField.fieldName]?.selectedItem;
        return (
          <>
            <FormItem key={`form-field-${formField.fieldKey}`}>
              <LabeledDropDown
                data={Object.keys(formField.conditions).map(dataItem => ({
                  text: dataItem,
                  value: dataItem
                }))}
                onSelect={selectedItem =>
                  setUiWidgetsInfo(formField.fieldName, {
                    selectedItem: selectedItem.value
                  })
                }
                value={currentlySelectedCondition}
              />
            </FormItem>
            {renderFormMeta([formField.conditions[currentlySelectedCondition]])}
          </>
        );
      } else {
        return (
          <FormItem key={`form-field-${formField.fieldKey}`}>
            <Field name={formField.fieldKey}>
              {(fieldProps: FieldProps<string>) =>
                renderItem(formField, fieldProps)
              }
            </Field>
          </FormItem>
        );
      }
    });
  };

  return (
    <>
      {renderFormMeta(formFields)}
      {isLoadingSchema && (
        <LoaderContainer>
          <Spinner />
        </LoaderContainer>
      )}
    </>
  );
};

export default FormContent;
