import type { CustomFieldDefinition, CustomFieldEntityType } from '@newa-epm/shared';
import type { FormField } from '../components/FormModal';
import { useCustomFieldDefinitions } from '../hooks/useCustomFields';

const FIELD_TYPE_TO_FORM_TYPE: Record<string, FormField['type']> = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'select',
  SELECT: 'select',
};

function buildFieldOptions(def: CustomFieldDefinition): FormField['options'] | undefined {
  if (def.fieldType === 'SELECT') {
    return def.selectOptions.map((v) => ({ label: v, value: v }));
  }
  if (def.fieldType === 'BOOLEAN') {
    return [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ];
  }
  return undefined;
}

export function useCustomFormFields(entityType: CustomFieldEntityType): FormField[] {
  const { data: defs } = useCustomFieldDefinitions(entityType);

  return (defs ?? []).map((def) => ({
    name: `customFields.${def.fieldKey}`,
    label: `${def.label}${def.required ? ' *' : ''}`,
    type: FIELD_TYPE_TO_FORM_TYPE[def.fieldType] ?? 'text',
    options: buildFieldOptions(def),
  }));
}

/**
 * Extracts the customFields from a persisted record (e.g. fetched Entity)
 * and returns them as prefixed form values for defaultValues.
 */
export function extractCustomFieldValues(
  record: { customFields?: Record<string, unknown> | null } | null | undefined,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const cf = record?.customFields;

  if (cf && typeof cf === 'object') {
    for (const [key, value] of Object.entries(cf)) {
      fields[`customFields.${key}`] = value;
    }
  }

  return fields;
}

/**
 * Extracts `customFields.*` values from react-hook-form's flat values object
 * (using dot-path nesting) back into a nested `{ customFields: { key: value } }` structure.
 * react-hook-form nests dot-path keys automatically in the submitted values object,
 * so the return from handleSubmit already has `{ customFields: { key: value } }` — no
 * manual extraction needed. This utility exists for documentation clarity only and is unused.
 */
