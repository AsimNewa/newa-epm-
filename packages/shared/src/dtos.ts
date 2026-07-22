import {
  IsNotEmpty,
  IsEmail,
  IsString,
  IsUUID,
  IsOptional,
  IsIn,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsArray,
  IsObject,
  Length,
  Min,
  Max,
} from 'class-validator';

// ==================== AUTHENTICATION DTOs ====================
export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'locked'])
  status?: 'active' | 'inactive' | 'locked';
}

// ==================== ROLE & PERMISSION DTOs ====================
export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class SetRolePermissionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}

export class AssignUserRoleDto {
  @IsNotEmpty()
  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entityScope?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  groupScope?: string[];
}

// ==================== TENANT DTOs ====================
export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  slug: string;
}

// ==================== CALENDAR & PERIOD DTOs ====================
export class CreateFiscalYearDto {
  @IsNotEmpty()
  @IsNumber()
  startYear: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  startMonth: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  regularPeriods?: number; // defaults to 12

  @IsOptional()
  @IsNumber()
  @Min(0)
  adjustmentPeriods?: number; // n additional adjustment periods
}

export class CreatePeriodDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  period?: string; // defaults to YYYY-NNN when omitted

  @IsOptional()
  @IsString()
  periodNumber?: string; // alphanumeric allowed for manually created periods

  @IsOptional()
  @IsBoolean()
  isAdjustment?: boolean;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsUUID()
  openingBalanceSourcePeriodId?: string;
}

export class UpdatePeriodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsIn(['draft', 'open', 'submitted', 'locked'])
  status?: 'draft' | 'open' | 'submitted' | 'locked';

  @IsOptional()
  @IsUUID()
  openingBalanceSourcePeriodId?: string;
}

export class CopyMasterDataDto {
  @IsNotEmpty()
  @IsUUID()
  sourcePeriodId: string;
}

// ==================== THEME DTOs ====================
export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  presetName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  surfaceColor?: string;

  @IsOptional()
  @IsString()
  textColor?: string;
}

// ==================== SYSTEM SETTINGS DTOs ====================
export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(64)
  passwordMinLength?: number;

  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireSymbol?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  passwordExpiryDays?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  lockoutThreshold?: number;

  @IsOptional()
  @IsBoolean()
  mfaRequiredByDefault?: boolean;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUsername?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string; // write-only; omit to leave unchanged

  @IsOptional()
  @IsEmail()
  smtpFromAddress?: string;

  @IsOptional()
  @IsString()
  smtpFromName?: string;

  @IsOptional()
  @IsString()
  emailHeaderText?: string;
}

// ==================== MASTER DATA DTOs ====================
export class CreateEntityDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsNotEmpty()
  @IsString()
  currency: string; // ISO currency code

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateEntityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class CreateChartOfAccountDto {
  @IsNotEmpty()
  @IsString()
  accountCode: string;

  @IsNotEmpty()
  @IsString()
  accountName: string;

  @IsNotEmpty()
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

  @IsNotEmpty()
  @IsIn(['DEBIT', 'CREDIT'])
  accountNature: 'DEBIT' | 'CREDIT';

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsNumber()
  rollupWeight?: number;

  @IsOptional()
  @IsIn(['BALANCE_SHEET', 'PROFIT_AND_LOSS', 'CASH_FLOW', 'EQUITY_STATEMENT'])
  statementType?: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'CASH_FLOW' | 'EQUITY_STATEMENT';

  @IsOptional()
  @IsIn(['OPERATING', 'INVESTING', 'FINANCING', 'NON_CASH'])
  cashFlowCategory?: 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH';

  @IsOptional()
  @IsString()
  ifrsReference?: string;

  @IsOptional()
  @IsBoolean()
  requiresIntercompanyRecon?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresOtherRecon?: boolean;

  @IsOptional()
  @IsString()
  rateType?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateChartOfAccountDto {
  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

  @IsOptional()
  @IsIn(['DEBIT', 'CREDIT'])
  accountNature?: 'DEBIT' | 'CREDIT';

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsNumber()
  rollupWeight?: number;

  @IsOptional()
  @IsIn(['BALANCE_SHEET', 'PROFIT_AND_LOSS', 'CASH_FLOW', 'EQUITY_STATEMENT'])
  statementType?: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'CASH_FLOW' | 'EQUITY_STATEMENT';

  @IsOptional()
  @IsIn(['OPERATING', 'INVESTING', 'FINANCING', 'NON_CASH'])
  cashFlowCategory?: 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH';

  @IsOptional()
  @IsString()
  ifrsReference?: string;

  @IsOptional()
  @IsBoolean()
  requiresIntercompanyRecon?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresOtherRecon?: boolean;

  @IsOptional()
  @IsString()
  rateType?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

// ==================== CURRENCY DTOs ====================
export class CreateCurrencyDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateCurrencyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class CreateExchangeRateDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  toCurrency: string;

  @IsNotEmpty()
  @IsDateString()
  rateDate: string;

  @IsNotEmpty()
  @IsNumber()
  rate: number;

  @IsOptional()
  @IsString()
  rateType?: string;
}

export class UpdateExchangeRateDto {
  @IsNotEmpty()
  @IsNumber()
  rate: number;
}

// ==================== RATE TYPE DTOs ====================
export class CreateRateTypeDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultAccountTypes?: string[];
}

export class UpdateRateTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultAccountTypes?: string[];
}

// ==================== DIMENSION DTOs ====================
export class CreateDimensionDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateDimensionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class CreateDimensionMemberDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class UpdateDimensionMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

/** Used for bulk member import that spans dimensions — each row names its own dimension (by Dimension name or type). */
export class CreateDimensionMemberImportDto extends CreateDimensionMemberDto {
  @IsNotEmpty()
  @IsString()
  dimension: string;
}

// ==================== DIMENSION ACCOUNT RULE DTOs ====================
export const DIMENSION_APPLICABILITY_VALUES = ['MANDATORY', 'OPTIONAL', 'PROHIBITED'] as const;
export type DimensionApplicability = (typeof DIMENSION_APPLICABILITY_VALUES)[number];

// One leg of a rule's source condition. sourceDimensionId omitted/undefined means Chart of Accounts;
// otherwise it's another Dimension's id to key off its members (e.g. Department -> Cost Center). A
// rule with 2+ conditions matches only when ALL of them match simultaneously (AND) — this is what
// enables combination rules across dimensions (e.g. Account range AND Department range together).
export interface DimensionRuleConditionInput {
  sourceDimensionId?: string;
  sourceRange: string;
}

export class CreateDimensionAccountRuleDto {
  // Target axis: the dimension being constrained.
  @IsNotEmpty()
  @IsUUID()
  dimensionId: string;

  @IsNotEmpty()
  @IsIn(DIMENSION_APPLICABILITY_VALUES)
  applicability: DimensionApplicability;

  // Which target-dimension member codes are allowed; omit to allow any member.
  @IsOptional()
  @IsString()
  memberRange?: string;

  @IsOptional()
  @IsString()
  defaultMemberCode?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  // One or more source conditions, ANDed together. Validated in the service (existence, range syntax,
  // no duplicate axes) rather than via decorators, since each entry isn't a registered DTO class.
  @IsArray()
  conditions: DimensionRuleConditionInput[];
}

export class UpdateDimensionAccountRuleDto {
  @IsOptional()
  @IsIn(DIMENSION_APPLICABILITY_VALUES)
  applicability?: DimensionApplicability;

  @IsOptional()
  @IsString()
  memberRange?: string;

  @IsOptional()
  @IsString()
  defaultMemberCode?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  // Omit to leave existing conditions unchanged; provide to replace the full set.
  @IsOptional()
  @IsArray()
  conditions?: DimensionRuleConditionInput[];
}

/** One (sourceDimensionId, code) fact used to evaluate a rule's conditions — sourceDimensionId
 * omitted/undefined means the code is a Chart of Accounts account code. */
export interface DimensionRuleContextEntry {
  sourceDimensionId?: string;
  code: string;
}

export class ResolveDimensionRuleDto {
  @IsNotEmpty()
  @IsUUID()
  dimensionId: string;

  @IsArray()
  context: DimensionRuleContextEntry[];
}

export class ResolveAllDimensionRulesDto {
  @IsArray()
  context: DimensionRuleContextEntry[];
}

// ==================== OWNERSHIP STRUCTURE DTOs ====================
export class CreateConsolidationGroupDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  reportingCurrency?: string;

  @IsOptional()
  @IsUUID()
  parentEntityId?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateConsolidationGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  reportingCurrency?: string;

  @IsOptional()
  @IsUUID()
  parentEntityId?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class CreateGroupMemberDto {
  @IsNotEmpty()
  @IsUUID()
  entityId: string;

  @IsNotEmpty()
  @IsIn(['FULL', 'EQUITY', 'PROPORTIONATE', 'COST'])
  consolidationMethod: 'FULL' | 'EQUITY' | 'PROPORTIONATE' | 'COST';

  @IsNotEmpty()
  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateGroupMemberDto {
  @IsOptional()
  @IsIn(['FULL', 'EQUITY', 'PROPORTIONATE', 'COST'])
  consolidationMethod?: 'FULL' | 'EQUITY' | 'PROPORTIONATE' | 'COST';

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class CreateOwnershipPeriodDto {
  @IsNotEmpty()
  @IsUUID()
  parentEntityId: string;

  @IsNotEmpty()
  @IsUUID()
  subsidiaryEntityId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  directPercentage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  effectivePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nciPercentage?: number;

  @IsNotEmpty()
  @IsUUID()
  effectiveFromPeriodId: string; // FK to a Period — the fiscal period this stake takes effect from

  @IsOptional()
  @IsUUID()
  effectiveToPeriodId?: string; // FK to a Period — the last period this stake applies to

  @IsOptional()
  @IsNumber()
  acquisitionCost?: number;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;
}

export class UpdateOwnershipPeriodDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  directPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  effectivePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nciPercentage?: number;

  @IsOptional()
  @IsUUID()
  effectiveToPeriodId?: string;
}

// Combines a GroupMember (consolidation method) and an OwnershipPeriod (percentages,
// effective periods, acquisition info) into one entry for the unified Ownership
// Structure screen. Identity fields (parent/subsidiary/effectiveFromPeriodId) are
// immutable after creation — see UpdateOwnershipStructureEntryDto.
export class CreateOwnershipStructureEntryDto {
  @IsNotEmpty()
  @IsUUID()
  parentEntityId: string;

  @IsNotEmpty()
  @IsUUID()
  subsidiaryEntityId: string;

  @IsNotEmpty()
  @IsIn(['FULL', 'EQUITY', 'PROPORTIONATE', 'COST'])
  consolidationMethod: 'FULL' | 'EQUITY' | 'PROPORTIONATE' | 'COST';

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  directPercentage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  effectivePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nciPercentage?: number;

  @IsNotEmpty()
  @IsUUID()
  effectiveFromPeriodId: string;

  @IsOptional()
  @IsUUID()
  effectiveToPeriodId?: string;

  @IsOptional()
  @IsNumber()
  acquisitionCost?: number;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;
}

export class UpdateOwnershipStructureEntryDto {
  @IsOptional()
  @IsIn(['FULL', 'EQUITY', 'PROPORTIONATE', 'COST'])
  consolidationMethod?: 'FULL' | 'EQUITY' | 'PROPORTIONATE' | 'COST';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  directPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  effectivePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nciPercentage?: number;

  @IsOptional()
  @IsUUID()
  effectiveToPeriodId?: string;

  @IsOptional()
  @IsNumber()
  acquisitionCost?: number;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;
}

// Row shape for bulk import — references entities/periods by business code (human-fillable
// in a spreadsheet) rather than raw UUIDs; resolved to ids server-side before creation.
export class ImportOwnershipStructureRowDto {
  @IsNotEmpty()
  @IsString()
  subsidiaryEntityCode: string;

  @IsNotEmpty()
  @IsString()
  parentEntityCode: string;

  @IsNotEmpty()
  @IsIn(['FULL', 'EQUITY', 'PROPORTIONATE', 'COST'])
  consolidationMethod: 'FULL' | 'EQUITY' | 'PROPORTIONATE' | 'COST';

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  directPercentage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  effectivePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nciPercentage?: number;

  @IsNotEmpty()
  @IsString()
  effectiveFromPeriod: string;

  @IsOptional()
  @IsString()
  effectiveToPeriod?: string;

  @IsOptional()
  @IsNumber()
  acquisitionCost?: number;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;
}

// ==================== TRIAL BALANCE DTOs ====================
export class CreateTrialBalanceDto {
  @IsNotEmpty()
  @IsUUID()
  periodId: string;

  @IsNotEmpty()
  @IsUUID()
  entityId: string;

  @IsNotEmpty()
  rows: TrialBalanceRowDto[];
}

export class TrialBalanceRowDto {
  @IsNotEmpty()
  @IsString()
  accountCode: string;

  @IsNotEmpty()
  @IsString()
  accountName: string;

  @IsNotEmpty()
  debit: number;

  @IsNotEmpty()
  credit: number;
}

// ==================== CUSTOM FIELD DTOs ====================
export const CUSTOM_FIELD_ENTITY_TYPES = [
  'ENTITY',
  'CHART_OF_ACCOUNT',
  'CURRENCY',
  'DIMENSION',
  'CONSOLIDATION_GROUP',
] as const;
export type CustomFieldEntityType = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number];

export const CUSTOM_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export class CreateCustomFieldDefinitionDto {
  @IsNotEmpty()
  @IsIn(CUSTOM_FIELD_ENTITY_TYPES)
  entityType: CustomFieldEntityType;

  @IsNotEmpty()
  @IsString()
  fieldKey: string;

  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNotEmpty()
  @IsIn(CUSTOM_FIELD_TYPES)
  fieldType: CustomFieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectOptions?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

export class UpdateCustomFieldDefinitionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectOptions?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

// ==================== BULK IMPORT DTOs ====================
export class BulkImportRowsDto {
  @IsArray()
  rows: Record<string, unknown>[];
}

// ==================== API RESPONSE DTOs ====================
export class ApiResponseDto<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
