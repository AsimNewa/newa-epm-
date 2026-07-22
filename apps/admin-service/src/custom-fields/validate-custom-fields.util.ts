import { BadRequestException } from '@nestjs/common';
import type { CustomFieldDefinition } from '@prisma/client';

export function validateCustomFieldValues(
  definitions: CustomFieldDefinition[],
  values: Record<string, unknown> | undefined,
): void {
  const provided = values ?? {};

  for (const def of definitions) {
    const value = provided[def.fieldKey];
    const isBlank = value === undefined || value === null || value === '';

    if (def.required && isBlank) {
      throw new BadRequestException(`Custom field "${def.label}" is required`);
    }

    if (isBlank) {
      continue;
    }

    switch (def.fieldType) {
      case 'NUMBER':
        if (typeof value !== 'number') {
          throw new BadRequestException(`Custom field "${def.label}" must be a number`);
        }
        break;
      case 'BOOLEAN':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`Custom field "${def.label}" must be true or false`);
        }
        break;
      case 'DATE':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          throw new BadRequestException(`Custom field "${def.label}" must be a valid date`);
        }
        break;
      case 'SELECT':
        if (typeof value !== 'string' || !def.selectOptions.includes(value)) {
          throw new BadRequestException(
            `Custom field "${def.label}" must be one of: ${def.selectOptions.join(', ')}`,
          );
        }
        break;
      case 'TEXT':
      default:
        if (typeof value !== 'string') {
          throw new BadRequestException(`Custom field "${def.label}" must be text`);
        }
        break;
    }
  }
}
