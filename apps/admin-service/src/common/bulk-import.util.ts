import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import type { ImportResult } from '@newa-epm/shared';

function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .join('; ');
}

/**
 * Validates each raw row against a DTO class (reusing the same class-validator rules the
 * regular create endpoint enforces) and creates it via createFn, collecting per-row errors
 * instead of failing the whole batch on the first bad row.
 */
export async function bulkImport<TDto extends object>(
  DtoClass: new () => TDto,
  rows: Record<string, unknown>[],
  createFn: (dto: TDto) => Promise<unknown>,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const dto = plainToInstance(DtoClass, rows[i]);
    const validationErrors = await validate(dto as object);

    if (validationErrors.length > 0) {
      result.errors.push({ row: i + 1, message: formatValidationErrors(validationErrors) });
      continue;
    }

    try {
      await createFn(dto);
      result.created++;
    } catch (error) {
      result.errors.push({ row: i + 1, message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return result;
}
