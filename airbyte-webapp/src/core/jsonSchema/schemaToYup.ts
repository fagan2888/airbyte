import { JSONSchema7 } from "json-schema";
import * as yup from "yup";

import { WidgetConfigMap } from "../form/types";

/**
 * Returns yup.schema for validation
 *
 * This method builds yup schema based on jsonSchema ${@link JSONSchema7} and widgetConfig ${@link WidgetConfigMap}.
 * Every property is walked through recursively in case it is condition | object | array.
 *
 * uiConfig is used to select currently selected oneOf conditions to build proper schema
 * As uiConfig widget paths are .dot based (key1.innerModule1.innerModule2) propertyKey is provided recursively
 * @param jsonSchema
 * @param uiConfig uiConfig of widget currently selected in form
 * @param parentSchema used in recursive schema building as required fields can be described in parentSchema
 * @param propertyKey used in recursive schema building for building path for uiConfig
 */

export const buildYupFormForJsonSchema = (
  jsonSchema: JSONSchema7,
  uiConfig?: WidgetConfigMap,
  parentSchema?: JSONSchema7,
  propertyKey?: string
): yup.Schema<any> => {
  let schema:
    | yup.NumberSchema
    | yup.StringSchema
    | yup.ObjectSchema
    | null = null;

  if (jsonSchema.oneOf && uiConfig && propertyKey) {
    const selectedSchema =
      jsonSchema.oneOf.find(condition => {
        if (typeof condition !== "boolean") {
          return uiConfig[propertyKey]?.selectedItem === condition.title;
        }
        return false;
      }) ?? jsonSchema.oneOf[0];
    if (selectedSchema && typeof selectedSchema !== "boolean") {
      return buildYupFormForJsonSchema(
        { type: jsonSchema.type, ...selectedSchema },
        uiConfig,
        jsonSchema,
        propertyKey
      );
    }
  }

  switch (jsonSchema.type) {
    case "string":
      schema = yup.string();
      break;
    case "integer":
      schema = yup.number();

      if (jsonSchema?.minimum !== undefined) {
        schema = schema.min(jsonSchema?.minimum);
      }

      if (jsonSchema?.maximum !== undefined) {
        schema = schema!.max(jsonSchema?.maximum);
      }
      break;
    case "object":
      schema = yup
        .object()
        .shape(
          Object.fromEntries(
            Object.entries(
              jsonSchema.properties || {}
            ).map(([propertyKey, condition]) => [
              propertyKey,
              typeof condition !== "boolean"
                ? buildYupFormForJsonSchema(
                    condition,
                    uiConfig,
                    jsonSchema,
                    propertyKey
                  )
                : yup.mixed()
            ])
          )
        );
  }

  if (schema && jsonSchema.default) {
    schema = schema.default(jsonSchema.default);
  }

  const isRequired =
    !jsonSchema?.default &&
    parentSchema &&
    Array.isArray(parentSchema?.required) &&
    parentSchema.required.find(item => item === propertyKey);

  if (isRequired && schema) {
    schema = schema.required("form.empty.error");
  }

  return schema || yup.mixed();
};
