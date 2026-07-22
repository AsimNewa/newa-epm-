import { useEffect } from 'react';
import { Controller, useForm, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { Combobox } from './Combobox';

/**
 * Blank text/select inputs submit as '' via react-hook-form, but class-validator's
 * @IsOptional() only skips validation for undefined/null — an empty string still gets
 * validated (e.g. @Length(3,3) rejects ''). Converting '' to undefined here means "left
 * blank" is treated as "field omitted" everywhere, instead of each page having to remember to.
 */
function normalizeEmptyStringsUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeEmptyStringsUnknown);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = entry === '' ? undefined : normalizeEmptyStringsUnknown(entry);
  }

  return result;
}

function normalizeEmptyStrings<T>(values: T): T {
  return normalizeEmptyStringsUnknown(values) as T;
}

export interface FormField {
  name: string;
  label: string;
  /** 'combobox' is a type-ahead single-select — prefer it over 'select' for long option lists (e.g. entities). */
  type?: 'text' | 'number' | 'date' | 'select' | 'combobox';
  options?: { label: string; value: string }[];
}

interface FormModalProps<T extends FieldValues> {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: T) => void;
  schema: ZodType<T>;
  fields: FormField[];
  defaultValues?: Partial<T>;
  submitLabel?: string;
}

export function FormModal<T extends FieldValues>({
  title,
  open,
  onClose,
  onSubmit,
  schema,
  fields,
  defaultValues,
  submitLabel = 'Save',
}: FormModalProps<T>): JSX.Element | null {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as never,
  });

  useEffect(() => {
    reset(defaultValues as never);
  }, [defaultValues, reset]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">{title}</h2>
        <form
          onSubmit={handleSubmit((values) => {
            onSubmit(normalizeEmptyStrings(values));
          })}
          className="space-y-3"
        >
          {fields.map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-sm font-medium text-slate-700">{field.label}</label>
              {field.type === 'combobox' ? (
                <Controller
                  name={field.name as never}
                  control={control}
                  render={({ field: rhfField }) => (
                    <Combobox
                      value={(rhfField.value as string | undefined) ?? ''}
                      onChange={rhfField.onChange}
                      options={field.options ?? []}
                      placeholder={field.label}
                    />
                  )}
                />
              ) : field.type === 'select' ? (
                <select
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  {...register(field.name as never)}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  step={field.type === 'number' ? 'any' : undefined}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  {...register(field.name as never, { valueAsNumber: field.type === 'number' })}
                />
              )}
              {errors[field.name] && (
                <p className="mt-1 text-xs text-red-600">{String(errors[field.name]?.message)}</p>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
